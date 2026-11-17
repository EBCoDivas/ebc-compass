// DynamoDB emulator only. No OpenAI calls; all model behavior is deterministic rules.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { DynamoDBClient, DescribeTimeToLiveCommand } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { createAssistant, maintainConversation, runTurn } from '../src/assistant/index.js'
import { loadAssistantConfig } from '../src/config/env.js'
import { forgetMemory } from '../src/assistant/conversations/memory.js'

const endpoint = process.env.AWS_ENDPOINT_URL
if (!endpoint || !['127.0.0.1', 'localhost'].includes(new URL(endpoint).hostname)) throw new Error('Esta verificación requiere el emulador local; no modifica AWS real.')
const config = loadAssistantConfig({ ...process.env, ASSISTANT_MODE: 'rules', ASSISTANT_STORE: 'dynamodb' })
const assistant = createAssistant({ config, profileReader: async () => undefined })
const repo = assistant.conversations!
const owner = randomUUID(); const other = randomUUID(); const id = randomUUID(); const second = randomUUID()
const threadId = owner + '#' + id
const requestId = randomUUID()
const client = new DynamoDBClient({})
const document = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } })
try {
  const ttl = await client.send(new DescribeTimeToLiveCommand({ TableName: config.historyTable }))
  assert.notEqual(ttl.TimeToLiveDescription?.TimeToLiveStatus, 'ENABLED')
  const first = await runTurn(assistant.graph, { threadId, requestId, message: 'Quiero hacer prácticas en banca.' })
  assert.equal(first.historyStatus, 'saved')
  await maintainConversation(assistant.graph, threadId)
  for (let i = 0; i < 13; i++) {
    await runTurn(assistant.graph, { threadId, message: '¿Qué becas hay disponibles?' })
    await maintainConversation(assistant.graph, threadId)
  }
  assert.equal((await repo.require(owner, id)).messageCount, 28)
  assert.equal((await repo.messages(owner, id, 100)).messages.length, 28)
  assert.ok((await repo.require(owner, id)).summary)
  const page = await repo.messages(owner, id, 5)
  assert.ok(page.nextCursor)
  assert.equal((await repo.messages(owner, id, 5, page.nextCursor)).messages.length, 5)
  await assert.rejects(repo.require(other, id))
  const checkpoint = await document.send(new QueryCommand({ TableName: config.conversationsTable,
    KeyConditionExpression: 'PK = :pk', ExpressionAttributeValues: { ':pk': 'CHECKPOINT_' + threadId }, ScanIndexForward: false, Limit: 1 }))
  assert.ok(checkpoint.Items?.[0])
  await document.send(new UpdateCommand({ TableName: config.conversationsTable, Key: { PK: checkpoint.Items[0].PK, SK: checkpoint.Items[0].SK },
    UpdateExpression: 'SET #ttl = :expired', ExpressionAttributeNames: { '#ttl': 'ttl' }, ExpressionAttributeValues: { ':expired': 1 } }))
  assert.equal(await assistant.checkpointer.getTuple({ configurable: { thread_id: threadId } }), undefined)
  const restarted = createAssistant({ config, profileReader: async () => undefined })
  const replay = await runTurn(restarted.graph, { threadId, requestId, requireExisting: true, message: 'Quiero hacer prácticas en banca.' })
  assert.equal(first.id, replay.id)
  assert.equal((await repo.require(owner, id)).messageCount, 28)
  const following = await runTurn(restarted.graph, { threadId, requireExisting: true, message: '¿Y la fecha límite?' })
  assert.equal(following.intent, 'scholarship-info')
  assert.equal((await repo.require(owner, id)).messageCount, 30)
  await runTurn(assistant.graph, { threadId: owner + '#' + second, message: 'Hola' })
  assert.equal((await repo.list(owner)).conversations.length, 2)
  assert.ok((await repo.memories(owner)).some(fact => fact.key === 'goal'))
  await forgetMemory(repo, owner)
  assert.equal((await repo.memories(owner)).filter(fact => !fact.suppressed).length, 0)
  console.log('✔ DynamoDB real del emulador: 30 mensajes sin TTL, paginación, aislamiento, idempotencia, recuperación tras expiración del checkpoint y memoria controlada. Cero llamadas a OpenAI.')
} finally {
  for (const conversationId of [id, second]) {
    if (await repo.get(owner, conversationId)) await repo.remove(owner, conversationId, () => assistant.checkpointer.deleteThread(owner + '#' + conversationId)).catch(() => {})
  }
  // Remove even ID tombstones and suppressed facts belonging exclusively to this temporary owner.
  for (const prefix of ['CONV#', 'MEM#']) {
    const page = await repo.store.page(owner, prefix, 100)
    await repo.store.remove(owner, page.items.map(item => item.key))
  }
  client.destroy()
}
