// Checkpointer de LangGraph sobre DynamoDB (port a TypeScript del DynamoDBSaver de AWS, hoy solo disponible en Python:
// langgraph-checkpoint-aws). Persiste el estado de cada conversación por `thread_id`.
//
// Una sola tabla con clave de partición PK (string) y de ordenación SK (string), y TTL en el atributo `ttl`:
//   Checkpoint : PK = CHECKPOINT_<thread_id>                    SK = <ns>#<checkpoint_id>
//   Writes     : PK = WRITES_<thread_id>#<ns>#<checkpoint_id>   SK = <task_id>#<idx>
//
// Diferencias deliberadas con la versión de AWS:
//   - El checkpoint y sus metadatos se guardan en el mismo ítem (binario), no en "ítems de chunk" separados.
//   - No hay offload a S3: el estado del asistente es pequeño. Si un ítem se acerca al límite de 400 KB se lanza un error.

import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb'
import type { RunnableConfig } from '@langchain/core/runnables'
import {
  BaseCheckpointSaver,
  WRITES_IDX_MAP,
  compareWritesSortKeys,
  copyCheckpoint,
  getCheckpointId,
  writesSortKey,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointTuple,
  type PendingWrite,
} from '@langchain/langgraph-checkpoint'

const MAX_ITEM_BYTES = 350 * 1024
const BATCH_SIZE = 25

const checkpointPk = (threadId: string) => `CHECKPOINT_${threadId}`
const checkpointSk = (ns: string, id: string) => `${ns}#${id}`
const writesPk = (threadId: string, ns: string, id: string) => `WRITES_${threadId}#${ns}#${id}`
const writesSk = (taskId: string, idx: number) => `${taskId}#${idx}`

interface CheckpointItem {
  PK: string
  SK: string
  id: string
  ns: string
  checkpoint_type: string
  checkpoint: Uint8Array
  metadata_type: string
  metadata: Uint8Array
  parent_checkpoint_id?: string
  ttl?: number
}

interface WriteItem {
  PK: string
  SK: string
  task_id: string
  task_path: string
  channel: string
  idx: number
  type: string
  value: Uint8Array
  ttl?: number
}

export interface DynamoDBSaverOptions {
  client: DynamoDBDocumentClient
  tableName: string
  /** Vida de cada checkpoint en segundos (atributo `ttl`). Sin valor = no expiran. */
  ttlSeconds?: number
}

export class DynamoDBSaver extends BaseCheckpointSaver {
  private readonly client: DynamoDBDocumentClient
  private readonly tableName: string
  private readonly ttlSeconds?: number

  constructor(options: DynamoDBSaverOptions) {
    super()
    this.client = options.client
    this.tableName = options.tableName
    this.ttlSeconds = options.ttlSeconds
  }

  private ttl(): { ttl?: number } {
    return this.ttlSeconds ? { ttl: Math.floor(Date.now() / 1000) + this.ttlSeconds } : {}
  }

  private async queryAll(input: Omit<QueryCommandInput, 'TableName'>): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = []
    let startKey: Record<string, unknown> | undefined
    do {
      const page = await this.client.send(new QueryCommand({ TableName: this.tableName, ConsistentRead: true, ...input, ExclusiveStartKey: startKey }))
      items.push(...(page.Items ?? []))
      startKey = page.LastEvaluatedKey
    } while (startKey)
    return items
  }

  private async pendingWrites(threadId: string, ns: string, checkpointId: string): Promise<[string, string, unknown][]> {
    const items = (await this.queryAll({
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': writesPk(threadId, ns, checkpointId) },
    })) as unknown as WriteItem[]
    // LangGraph exige devolverlas en el orden de writesSortKey (ruta de tarea, id de tarea e índice).
    const ordered = items
      .map((item) => ({ item, key: writesSortKey(item.task_path ?? '', item.task_id, Number(item.idx)) }))
      .sort((a, b) => compareWritesSortKeys(a.key, b.key))
    return Promise.all(ordered.map(async ({ item }) => [item.task_id, item.channel, await this.serde.loadsTyped(item.type, item.value)] as [string, string, unknown]))
  }

  private async toTuple(item: CheckpointItem, threadId: string): Promise<CheckpointTuple> {
    const checkpoint = (await this.serde.loadsTyped(item.checkpoint_type, item.checkpoint)) as Checkpoint
    const metadata = (await this.serde.loadsTyped(item.metadata_type, item.metadata)) as CheckpointMetadata
    const tuple: CheckpointTuple = {
      config: { configurable: { thread_id: threadId, checkpoint_ns: item.ns, checkpoint_id: item.id } },
      checkpoint,
      metadata,
      pendingWrites: await this.pendingWrites(threadId, item.ns, item.id),
    }
    if (item.parent_checkpoint_id) {
      tuple.parentConfig = { configurable: { thread_id: threadId, checkpoint_ns: item.ns, checkpoint_id: item.parent_checkpoint_id } }
    }
    return tuple
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id as string | undefined
    if (threadId === undefined) return undefined
    const ns = (config.configurable?.checkpoint_ns as string | undefined) ?? ''
    const checkpointId = getCheckpointId(config)

    if (checkpointId) {
      const response = await this.client.send(
        new GetCommand({ TableName: this.tableName, Key: { PK: checkpointPk(threadId), SK: checkpointSk(ns, checkpointId) }, ConsistentRead: true }),
      )
      const item = response.Item as CheckpointItem | undefined
      return item && (item.ttl === undefined || item.ttl > Date.now() / 1000) ? this.toTuple(item, threadId) : undefined
    }

    // Último checkpoint: consulta descendente por SK dentro del namespace.
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': checkpointPk(threadId), ':prefix': `${ns}#` },
        ScanIndexForward: false,
        Limit: 1,
        ConsistentRead: true,
      }),
    )
    const item = response.Items?.[0] as CheckpointItem | undefined
    return item && (item.ttl === undefined || item.ttl > Date.now() / 1000) ? this.toTuple(item, threadId) : undefined
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id as string | undefined
    if (threadId === undefined) return
    const ns = config.configurable?.checkpoint_ns as string | undefined
    const { before, limit, filter } = options ?? {}
    const beforeId = before?.configurable?.checkpoint_id as string | undefined

    const items = (await this.queryAll({
      KeyConditionExpression: ns === undefined ? 'PK = :pk' : 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: ns === undefined ? { ':pk': checkpointPk(threadId) } : { ':pk': checkpointPk(threadId), ':prefix': `${ns}#` },
      ScanIndexForward: false,
    })) as unknown as CheckpointItem[]

    let remaining = limit
    for (const item of items) {
      if (item.ttl !== undefined && item.ttl <= Date.now() / 1000) continue
      if (beforeId && item.id >= beforeId) continue
      if (filter) {
        const metadata = (await this.serde.loadsTyped(item.metadata_type, item.metadata)) as Record<string, unknown>
        if (!Object.entries(filter).every(([key, value]) => metadata[key] === value)) continue
      }
      if (remaining !== undefined) {
        if (remaining <= 0) break
        remaining -= 1
      }
      yield await this.toTuple(item, threadId)
    }
  }

  async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string | undefined
    if (threadId === undefined) throw new Error('Falta "thread_id" en config.configurable al guardar el checkpoint.')
    const ns = (config.configurable?.checkpoint_ns as string | undefined) ?? ''
    const prepared = copyCheckpoint(checkpoint)
    const [checkpointType, checkpointData] = await this.serde.dumpsTyped(prepared)
    const [metadataType, metadataData] = await this.serde.dumpsTyped(metadata)
    if (checkpointData.byteLength + metadataData.byteLength > MAX_ITEM_BYTES) {
      throw new Error('El checkpoint excede el tamaño máximo por ítem de DynamoDB (el offload a S3 no está implementado).')
    }

    const parent = config.configurable?.checkpoint_id as string | undefined
    const item: CheckpointItem = {
      PK: checkpointPk(threadId),
      SK: checkpointSk(ns, checkpoint.id),
      id: checkpoint.id,
      ns,
      checkpoint_type: checkpointType,
      checkpoint: checkpointData,
      metadata_type: metadataType,
      metadata: metadataData,
      ...(parent ? { parent_checkpoint_id: parent } : {}),
      ...this.ttl(),
    }
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: item }))
    return { configurable: { thread_id: threadId, checkpoint_ns: ns, checkpoint_id: checkpoint.id } }
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string, taskPath?: string): Promise<void> {
    const threadId = config.configurable?.thread_id as string | undefined
    const checkpointId = config.configurable?.checkpoint_id as string | undefined
    if (threadId === undefined) throw new Error('Falta "thread_id" en config.configurable al guardar las escrituras.')
    if (checkpointId === undefined) throw new Error('Falta "checkpoint_id" en config.configurable al guardar las escrituras.')
    const ns = (config.configurable?.checkpoint_ns as string | undefined) ?? ''

    for (const [position, [channel, value]] of writes.entries()) {
      const idx = WRITES_IDX_MAP[channel] ?? position
      const [type, data] = await this.serde.dumpsTyped(value)
      if (data.byteLength > MAX_ITEM_BYTES) throw new Error('Una escritura pendiente excede el tamaño máximo por ítem de DynamoDB.')
      const item: WriteItem = {
        PK: writesPk(threadId, ns, checkpointId),
        SK: writesSk(taskId, idx),
        task_id: taskId,
        task_path: taskPath ?? '',
        channel,
        idx,
        type,
        value: data,
        ...this.ttl(),
      }
      try {
        // Escrituras normales (idx >= 0): solo se insertan una vez. Las especiales (error, interrupt…) se sobrescriben.
        await this.client.send(new PutCommand({ TableName: this.tableName, Item: item, ...(idx >= 0 ? { ConditionExpression: 'attribute_not_exists(PK)' } : {}) }))
      } catch (error) {
        if ((error as { name?: string }).name !== 'ConditionalCheckFailedException') throw error
      }
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    const checkpoints = (await this.queryAll({
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': checkpointPk(threadId) },
      ProjectionExpression: 'PK, SK, id, ns',
    })) as unknown as Pick<CheckpointItem, 'PK' | 'SK' | 'id' | 'ns'>[]

    const keys: { PK: string; SK: string }[] = []
    for (const checkpoint of checkpoints) {
      keys.push({ PK: checkpoint.PK, SK: checkpoint.SK })
      const writes = (await this.queryAll({
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': writesPk(threadId, checkpoint.ns, checkpoint.id) },
        ProjectionExpression: 'PK, SK',
      })) as unknown as { PK: string; SK: string }[]
      keys.push(...writes)
    }

    for (let start = 0; start < keys.length; start += BATCH_SIZE) {
      let pending = keys.slice(start, start + BATCH_SIZE).map((Key) => ({ DeleteRequest: { Key } }))
      for (let attempt = 0; pending.length > 0 && attempt < 5; attempt += 1) {
        const response = await this.client.send(new BatchWriteCommand({ RequestItems: { [this.tableName]: pending } }))
        pending = (response.UnprocessedItems?.[this.tableName] ?? []) as typeof pending
      }
      if (pending.length > 0) throw new Error('No se pudieron borrar todos los checkpoints de la conversación.')
    }
  }
}
