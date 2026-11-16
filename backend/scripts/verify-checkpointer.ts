// Verificación manual del DynamoDBSaver contra el emulador de AWS (no es una suite de pruebas).
//   npm run verify:checkpointer     (el emulador debe estar en marcha y aprovisionado: npm run dev / provision)

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { emptyCheckpoint, uuid6 } from '@langchain/langgraph-checkpoint'
import { createAssistant, runTurn } from '../src/assistant/index.js'
import { DynamoDBSaver } from '../src/assistant/adapters/dynamoSaver.js'
import { loadAssistantConfig } from '../src/config/env.js'

const tableName = process.env.CONVERSATIONS_TABLE ?? 'ConversationCheckpoints'
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } })
const saver = new DynamoDBSaver({ client, tableName, ttlSeconds: 3600 })

let failures = 0
const check = (ok: boolean, label: string, detail = '') => {
  if (!ok) failures += 1
  console.log(`${ok ? '✔' : '✖'} ${label}${detail ? ` — ${detail}` : ''}`)
}

const suffix = Date.now()
const thread = `verify-${suffix}#conv-a`
const otherThread = `verify-${suffix}#conv-b`
const at = (id?: string) => ({ configurable: { thread_id: thread, checkpoint_ns: '', ...(id ? { checkpoint_id: id } : {}) } })

// --- Operaciones del checkpointer ---
const c1 = { ...emptyCheckpoint(), id: uuid6(-2) }
const c2 = { ...emptyCheckpoint(), id: uuid6(-2) }
await saver.put(at(), c1, { source: 'input', step: 0, parents: {} })
await saver.put(at(c1.id), c2, { source: 'loop', step: 1, parents: {} })

const latest = await saver.getTuple(at())
check(latest?.checkpoint.id === c2.id, 'getTuple sin checkpoint_id devuelve el más reciente')
check(latest?.parentConfig?.configurable?.checkpoint_id === c1.id, 'el checkpoint conserva su padre (parentConfig)')
const exact = await saver.getTuple(at(c1.id))
check(exact?.checkpoint.id === c1.id, 'getTuple con checkpoint_id devuelve ese checkpoint')

const listed: string[] = []
for await (const tuple of saver.list(at())) listed.push(tuple.checkpoint.id)
check(listed.length === 2 && listed[0] === c2.id && listed[1] === c1.id, 'list devuelve del más reciente al más antiguo', `${listed.length} checkpoints`)
let limited = 0
for await (const _ of saver.list(at(), { limit: 1 })) limited += 1
check(limited === 1, 'list respeta limit')

await saver.putWrites(at(c2.id), [['messages', { a: 1 }], ['summary', 'x']], 'task-1')
await saver.putWrites(at(c2.id), [['messages', { a: 999 }]], 'task-1') // repetido: debe ignorarse
const withWrites = await saver.getTuple(at(c2.id))
const messagesWrite = withWrites?.pendingWrites?.find((w) => w[1] === 'messages')
check(withWrites?.pendingWrites?.length === 2 && JSON.stringify(messagesWrite?.[2]) === '{"a":1}', 'putWrites guarda escrituras y no duplica las repetidas')

check((await saver.getTuple({ configurable: { thread_id: otherThread, checkpoint_ns: '' } })) === undefined, 'otra conversación no ve estos checkpoints (aislamiento por thread_id)')

// --- El asistente sobre DynamoDB: el estado sobrevive a "reiniciar" el backend ---
const config = { ...loadAssistantConfig(), mode: 'rules' as const }
const studentThread = `verify-${suffix}#conv-graph`
const first = createAssistant({ config, checkpointer: saver })
await runTurn(first.graph, { threadId: studentThread, message: '¿Qué becas hay disponibles?' })
const restarted = createAssistant({ config, checkpointer: new DynamoDBSaver({ client, tableName, ttlSeconds: 3600 }) }) // instancia nueva = backend reiniciado
const followUp = await runTurn(restarted.graph, { threadId: studentThread, message: '¿y la fecha límite?' })
check(followUp.intent === 'scholarship-info', 'tras reiniciar, el seguimiento hereda el tema anterior', `intent ${followUp.intent}`)
const state = await restarted.graph.getState({ configurable: { thread_id: studentThread } })
check((state.values.messages as unknown[]).length === 4, 'el historial guardado tiene los 4 mensajes de los 2 turnos')

// --- Borrado (NF-03.5) ---
await saver.deleteThread(thread)
await saver.deleteThread(studentThread)
check((await saver.getTuple(at())) === undefined, 'deleteThread elimina los checkpoints')
const leftovers = await client.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: 'PK = :pk', ExpressionAttributeValues: { ':pk': `WRITES_${thread}#ns#${c2.id}` } }))
const writesLeft = await client.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: 'PK = :pk', ExpressionAttributeValues: { ':pk': `WRITES_${thread}##${c2.id}` } }))
check((leftovers.Count ?? 0) === 0 && (writesLeft.Count ?? 0) === 0, 'deleteThread elimina también las escrituras pendientes')
check((await saver.getTuple({ configurable: { thread_id: studentThread, checkpoint_ns: '' } })) === undefined, 'la conversación del asistente también se borra')

console.log(failures === 0 ? '\nDynamoDBSaver verificado.' : `\n${failures} verificación(es) fallaron.`)
process.exit(failures === 0 ? 0 : 1)
