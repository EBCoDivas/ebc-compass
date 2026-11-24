import './testing/seedCatalog.js'
import { once } from 'node:events'
import test from 'node:test'
import assert from 'node:assert/strict'
import { MemorySaver } from '@langchain/langgraph'
import { buildAssistantGraph, runTurn, runTurnStreaming, type TurnStreamEvent } from './assistant/graph/assistantGraph.js'
import { InMemoryCatalog, CatalogDates, ProfileRecommendations } from './assistant/adapters/catalog.js'
import type { LlmProvider } from './assistant/types.js'
const catalog = new InMemoryCatalog()
function setup(llm?: LlmProvider) {
  return buildAssistantGraph({ catalog, dates: new CatalogDates(catalog), recommendations: new ProfileRecommendations(catalog),
    now: () => new Date('2026-11-16T12:00:00Z'), llm }, new MemorySaver())
}
test('stream emits actual deltas before returning and stores the validated final answer', async () => {
  const graph = setup({ generate: async () => '', async *stream() { yield 'Consulta '; yield 'Servicios Escolares.' } })
  const events: TurnStreamEvent[] = []
  const reply = await runTurnStreaming(graph, { threadId: 'stream', message: '¿Qué becas hay?' }, new AbortController().signal, async event => { events.push(event) })
  assert.deepEqual(events.filter(event => event.event === 'token').map(event => event.text), ['Consulta ', 'Servicios Escolares.'])
  assert.equal(reply.content, 'Consulta Servicios Escolares.')
  const state = await graph.getState({ configurable: { thread_id: 'stream' } })
  assert.equal(state.values.messages.length, 2)
})
test('unsupported generated figures are replaced by a validation error; catalog results stay separate', async () => {
  const graph = setup({ generate: async () => '', async *stream() { yield 'La beca garantiza $999999.' } })
  const events: TurnStreamEvent[] = []
  const reply = await runTurnStreaming(graph, { threadId: 'guard', message: '¿Qué becas hay?' }, new AbortController().signal, async event => { events.push(event) })
  assert.ok(events.some(event => event.event === 'replace'))
  assert.equal(reply.generatedBy, 'error')
  assert.equal(reply.failure, 'VALIDATION_FAILED')
  assert.match(reply.content, /No pudimos verificar/)
  assert.equal(reply.sources.length, 0)
  assert.ok(reply.catalogFallback?.sources.every(source => source.kind === 'opportunity'))
  assert.ok(reply.catalogFallback?.content.includes('beca'))
  assert.ok(!reply.content.includes('$999999'))
  const replacement = events.find(event => event.event === 'replace')
  assert.ok(replacement?.event === 'replace' && replacement.text === reply.content)
})

test('model failure is explicit in streaming, buffered replies and persisted history', async () => {
  const graph = setup({ generate: async () => { throw new Error('provider unavailable') }, async *stream() { yield 'Texto sin terminar'; throw new Error('provider unavailable') } })
  const events: TurnStreamEvent[] = []
  const reply = await runTurnStreaming(graph, { threadId: 'failure', message: '¿Qué becas hay?' }, new AbortController().signal, async event => { events.push(event) })
  assert.equal(reply.failure, 'MODEL_UNAVAILABLE')
  assert.equal(reply.generatedBy, 'error')
  assert.match(reply.content, /No pudimos generar/)
  assert.ok(!reply.content.includes('Texto sin terminar'))
  assert.ok(reply.catalogFallback?.content)
  assert.ok(events.some(event => event.event === 'replace' && event.text === reply.content))
  const state = await graph.getState({ configurable: { thread_id: 'failure' } })
  assert.equal(state.values.messages[1].failure, 'MODEL_UNAVAILABLE')
  assert.equal(state.values.messages[1].catalogFallback.content, reply.catalogFallback?.content)
  const buffered = await runTurn(graph, { threadId: 'buffered-failure', message: '¿Qué becas hay?' })
  assert.equal(buffered.failure, 'MODEL_UNAVAILABLE')
  assert.equal(buffered.generatedBy, 'error')
})

test('a failed question with an empty catalog does not offer invented catalog results', async () => {
  const empty = { list: async () => [], findByCode: async () => undefined }
  const graph = buildAssistantGraph({ catalog: empty, dates: new CatalogDates(empty), recommendations: new ProfileRecommendations(empty),
    llm: { generate: async () => { throw new Error('unavailable') } } }, new MemorySaver())
  const reply = await runTurn(graph, { threadId: 'no-catalog', message: '¿Qué cursos hay?' })
  assert.equal(reply.failure, 'MODEL_UNAVAILABLE')
  assert.equal(reply.catalogFallback, undefined)
})

test('API exposes explicit failures and optional catalog results consistently in JSON, SSE and history', async t => {
  const { default: express } = await import('express')
  const { assistantRoutes } = await import('./routes/assistantRoutes.js')
  const { loadAssistantConfig } = await import('./config/env.js')
  const saver = new MemorySaver()
  const graph = buildAssistantGraph({ catalog, dates: new CatalogDates(catalog), recommendations: new ProfileRecommendations(catalog),
    llm: { generate: async () => { throw new Error('unavailable') } } }, saver)
  const app = express()
  app.use((request, _response, next) => { (request as import('./auth/identity.js').AuthRequest).verifiedClaims = { sub: '11111111-1111-4111-8111-111111111111' }; next() })
  app.use(express.json(), assistantRoutes({ graph, checkpointer: saver, config: loadAssistantConfig({ ASSISTANT_MODE: 'llm', ASSISTANT_STORE: 'memory' }) }))
  const server = app.listen(0, '127.0.0.1')
  t.after(() => { server.closeAllConnections(); server.close() })
  await once(server, 'listening')
  const base = 'http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port
  const studentId = '11111111-1111-4111-8111-111111111111'
  const body = { studentId, message: '¿Qué becas hay?' }
  const response = await fetch(base + '/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const buffered = await response.json() as { conversationId: string; message: Record<string, unknown>; meta: { mode: string } }
  assert.equal(buffered.message.failure, 'MODEL_UNAVAILABLE')
  assert.equal(buffered.meta.mode, 'error')
  assert.ok(buffered.message.catalogFallback)
  const stream = await fetch(base + '/messages/stream', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...body, conversationId: buffered.conversationId }) })
  const wire = await stream.text()
  const done = JSON.parse(wire.match(/event: done\ndata: ([^\n]+)/)![1])
  assert.equal(done.message.failure, 'MODEL_UNAVAILABLE')
  assert.equal(done.meta.mode, 'error')
  assert.ok(done.message.catalogFallback)
  const history = await (await fetch(base + '/conversations/' + buffered.conversationId + '?studentId=' + studentId)).json() as { messages: { failure?: string; catalogFallback?: unknown }[] }
  assert.equal(history.messages.at(-1)?.failure, 'MODEL_UNAVAILABLE')
  assert.deepEqual(history.messages.at(-1)?.catalogFallback, done.message.catalogFallback)
})
test('stopping generation saves one student turn and a partial assistant message marked interrupted', async () => {
  const abort = new AbortController()
  const graph = setup({ generate: async () => '', async *stream(input) { yield 'Consulta'; await new Promise<void>(resolve => setImmediate(resolve)); input.signal?.throwIfAborted(); yield ' el resto.' } })
  const reply = await runTurnStreaming(graph, { threadId: 'stopped', message: '¿Qué becas hay?' }, abort.signal, async event => { if (event.event === 'token') abort.abort() })
  assert.equal(reply.interrupted, true)
  const state = await graph.getState({ configurable: { thread_id: 'stopped' } })
  assert.equal(state.values.messages.length, 2)
  assert.equal(state.values.messages[1].interrupted, true)
})
test('rules mode returns a complete reply without requiring a model', async () => {
  const reply = await runTurnStreaming(setup(), { threadId: 'rules', message: 'Hola' }, new AbortController().signal, async () => {})
  assert.equal(reply.generatedBy, 'rules')
  assert.ok(reply.content.length > 0)
})

test('usage belongs to one turn and remains available when validation rejects a generation', async () => {
  const usage = { inputTokens: 100, totalInputTokens: 150, cacheReadInputTokens: 50, outputTokens: 10, totalTokens: 160, latencyMs: 30, checkpointMode: 'system' as const }
  const graph = setup({ generate: async input => { input.onUsage?.(usage); return 'La beca garantiza $999999.' } })
  const rejected = await runTurn(graph, { threadId: 'metrics', message: '¿Qué becas hay?' })
  assert.equal(rejected.failure, 'VALIDATION_FAILED')
  assert.deepEqual(rejected.usage, usage)
  const greeting = await runTurn(graph, { threadId: 'metrics', message: 'Hola' })
  assert.equal(greeting.usage, undefined)
})

test('closing the HTTP stream cancels the provider and persists the partial turn', { timeout: 5000 }, async t => {
  const { default: express } = await import('express')
  const { assistantRoutes } = await import('./routes/assistantRoutes.js')
  const { loadAssistantConfig } = await import('./config/env.js')
  const saver = new MemorySaver()
  const graph = buildAssistantGraph({ catalog, dates: new CatalogDates(catalog), recommendations: new ProfileRecommendations(catalog),
    llm: { generate: async () => '', async *stream(input) {
      yield 'Consulta'
      input.signal?.throwIfAborted()
      await new Promise<void>((_resolve, reject) => input.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }))
    } },
  }, saver)
  const app = express()
  app.use((request, _response, next) => { (request as import('./auth/identity.js').AuthRequest).verifiedClaims = { sub: '11111111-1111-4111-8111-111111111111' }; next() })
  app.use(express.json(), assistantRoutes({ graph, checkpointer: saver, config: loadAssistantConfig({ ASSISTANT_MODE: 'llm', ASSISTANT_STORE: 'memory' }) }))
  const server = app.listen(0, '127.0.0.1')
  const abort = new AbortController()
  t.after(() => { abort.abort(); server.closeAllConnections(); server.close() })
  await once(server, 'listening')
  const port = (server.address() as import('node:net').AddressInfo).port
  const studentId = '11111111-1111-4111-8111-111111111111'
  const conversationId = '22222222-2222-4222-8222-222222222222'
  const response = await fetch('http://127.0.0.1:' + port + '/messages/stream', { method: 'POST', signal: abort.signal,
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ studentId, conversationId, message: '¿Qué becas hay?' }) })
  const reader = response.body!.getReader()
  let text = ''
  while (!text.includes('event: token')) {
    const { value, done } = await reader.read()
    if (done) break
    text += new TextDecoder().decode(value)
  }
  assert.match(text, /event: token/)
  abort.abort()
  await reader.cancel().catch(() => {})
  reader.releaseLock()
  let messages: import('./assistant/types.js').ChatMessage[] = []
  for (let attempt = 0; attempt < 100; attempt++) {
    messages = (await graph.getState({ configurable: { thread_id: studentId + '#' + conversationId } })).values.messages ?? []
    if (messages.length === 2) break
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  assert.equal(messages.length, 2)
  assert.equal(messages[1].interrupted, true)
  assert.equal(messages[1].content, 'Consulta')
})
