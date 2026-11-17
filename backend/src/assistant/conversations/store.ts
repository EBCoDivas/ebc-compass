import { GetCommand, PutCommand, QueryCommand, TransactWriteCommand, BatchWriteCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'

export type Value = Record<string, unknown>
export interface Write { key: string; value: Value; version?: number }
export interface Page<T> { items: T[]; cursor?: string }
export interface DocumentStore {
  get(owner: string, key: string): Promise<Value | undefined>
  page(owner: string, prefix: string, limit: number, cursor?: string, reverse?: boolean): Promise<Page<{ key: string; value: Value }>>
  write(owner: string, writes: Write[]): Promise<void>
  remove(owner: string, keys: string[]): Promise<void>
}
export class Conflict extends Error { readonly status = 409; readonly code = 'TURN_PENDING' }
export class NotFound extends Error { readonly status = 404; readonly code = 'CONVERSATION_NOT_FOUND' }
/** Una respuesta se valora una sola vez: no se puede cambiar ni quitar la valoración. */
export class FeedbackLocked extends Error { readonly status = 409; readonly code = 'FEEDBACK_ALREADY_SET' }
export class HistoryUnavailable extends Error { readonly status = 503; readonly code = 'HISTORY_UNAVAILABLE' }

export function decodeCursor(cursor: string | undefined, prefix: string): string | undefined {
  if (!cursor) return undefined
  const key = Buffer.from(cursor, 'base64url').toString('utf8')
  if (!key.startsWith(prefix) || cursor.length > 2048) throw Object.assign(new Error('Cursor inválido.'), { status: 400, code: 'INVALID_INPUT' })
  return key
}
const encodeCursor = (key: string) => Buffer.from(key).toString('base64url')

export class DynamoDocumentStore implements DocumentStore {
  constructor(private readonly client: DynamoDBDocumentClient, private readonly tableName: string) {}
  async get(owner: string, key: string) {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { PK: owner, SK: key }, ConsistentRead: true }))
    return result.Item?.data as Value | undefined
  }
  async page(owner: string, prefix: string, limit: number, cursor?: string, reverse = false) {
    const start = decodeCursor(cursor, prefix)
    const result = await this.client.send(new QueryCommand({ TableName: this.tableName, ConsistentRead: true,
      KeyConditionExpression: 'PK = :owner AND begins_with(SK, :prefix)', ExpressionAttributeValues: { ':owner': owner, ':prefix': prefix },
      Limit: limit, ScanIndexForward: !reverse, ...(start ? { ExclusiveStartKey: { PK: owner, SK: start } } : {}),
    }))
    return { items: (result.Items ?? []).map(item => ({ key: item.SK as string, value: item.data as Value })),
      ...(result.LastEvaluatedKey ? { cursor: encodeCursor(result.LastEvaluatedKey.SK as string) } : {}) }
  }
  async write(owner: string, writes: Write[]) {
    const puts = writes.map(({ key, value, version }) => ({ TableName: this.tableName,
      Item: { PK: owner, SK: key, version: value.version ?? 0, data: value },
      ConditionExpression: version === undefined ? 'attribute_not_exists(PK)' : '#version = :version',
      ...(version !== undefined ? { ExpressionAttributeNames: { '#version': 'version' }, ExpressionAttributeValues: { ':version': version } } : {}),
    }))
    try {
      if (puts.length === 1) await this.client.send(new PutCommand(puts[0]))
      else await this.client.send(new TransactWriteCommand({ TransactItems: puts.map(Put => ({ Put })) }))
    } catch (error) {
      const e = error as { name?: string; CancellationReasons?: { Code?: string }[] }
      if (e.name === 'ConditionalCheckFailedException' || (e.name === 'TransactionCanceledException' && e.CancellationReasons?.some(reason => reason.Code === 'ConditionalCheckFailed'))) throw new Conflict('La conversación cambió. Intenta nuevamente.')
      throw error
    }
  }
  async remove(owner: string, keys: string[]) {
    for (let i = 0; i < keys.length; i += 25) {
      let pending = keys.slice(i, i + 25).map(SK => ({ DeleteRequest: { Key: { PK: owner, SK } } }))
      for (let attempt = 0; pending.length && attempt < 5; attempt++) {
        const result = await this.client.send(new BatchWriteCommand({ RequestItems: { [this.tableName]: pending } }))
        pending = (result.UnprocessedItems?.[this.tableName] ?? []) as typeof pending
      }
      if (pending.length) throw new Error('No se completó el borrado del historial.')
    }
  }
}

/** Same conditions and pagination as DynamoDB, for offline development and contract tests. */
export class MemoryDocumentStore implements DocumentStore {
  private readonly values = new Map<string, Value>()
  async get(owner: string, key: string) { return structuredClone(this.values.get(owner + '#' + key)) }
  async page(owner: string, prefix: string, limit: number, cursor?: string, reverse = false) {
    const start = decodeCursor(cursor, prefix)
    const items = [...this.values.entries()].filter(([key]) => key.startsWith(owner + '#' + prefix))
      .map(([key, value]) => ({ key: key.slice(owner.length + 1), value: structuredClone(value) })).sort((a, b) => a.key.localeCompare(b.key))
    if (reverse) items.reverse()
    const remaining = start ? items.filter(item => reverse ? item.key < start : item.key > start) : items
    const page = remaining.slice(0, limit)
    return { items: page, ...(remaining.length > page.length && page.length ? { cursor: encodeCursor(page.at(-1)!.key) } : {}) }
  }
  async write(owner: string, writes: Write[]) {
    for (const { key, version } of writes) {
      const current = this.values.get(owner + '#' + key)
      if (version === undefined ? current !== undefined : current?.version !== version) throw new Conflict('La conversación cambió. Intenta nuevamente.')
    }
    for (const { key, value } of writes) this.values.set(owner + '#' + key, structuredClone(value))
  }
  async remove(owner: string, keys: string[]) { for (const key of keys) this.values.delete(owner + '#' + key) }
}
