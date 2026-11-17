import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { MemorySaver } from '@langchain/langgraph'
import { buildAssistantGraph, runTurn, runTurnStreaming } from './assistant/graph/assistantGraph.js'
import { maintainConversation, ensureConversation } from './assistant/conversations/lifecycle.js'
import { ConversationRepository } from './assistant/conversations/repository.js'
import { MemoryDocumentStore, type Write } from './assistant/conversations/store.js'
import { extractMemories, forgetMemory, seedMemories } from './assistant/conversations/memory.js'
import { InMemoryCatalog, CatalogDates, ProfileRecommendations } from './assistant/adapters/catalog.js'
import { buildPrompt } from './assistant/domain/prompt.js'
import { validateGeneration } from './assistant/domain/guardrail.js'
import type { AssistantProfile, LlmInput, LlmProvider } from './assistant/types.js'

const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
function setup(repo = new ConversationRepository(new MemoryDocumentStore()), llm?: LlmProvider, profileReader?: (owner: string) => Promise<AssistantProfile | undefined>) {
  const catalog = new InMemoryCatalog()
  const saver = new MemorySaver()
  const graph = buildAssistantGraph({ catalog, dates: new CatalogDates(catalog), recommendations: new ProfileRecommendations(catalog), conversations: repo, llm, profileReader }, saver)
  return { graph, saver, repo }
}

test('full history survives the 20-message checkpoint window and restores context after checkpoint loss', async () => {
  const inputs: LlmInput[] = []
  const llm = { generate: async (input: LlmInput) => { inputs.push(input); return 'Consulta Servicios Escolares.' } }
  const { graph, saver, repo } = setup(undefined, llm)
  const id = randomUUID(); const threadId = owner + '#' + id
  for (let i = 0; i < 15; i++) {
    await runTurn(graph, { threadId, message: '¿Qué becas hay? Consulta ' + i })
    await maintainConversation(graph, threadId)
  }
  assert.equal((await repo.messages(owner, id, 100)).messages.length, 30)
  assert.equal((await graph.getState({ configurable: { thread_id: threadId } })).values.messages.length, 20)
  const metadata = await repo.require(owner, id)
  assert.ok(metadata.summary.includes('becas'))
  assert.ok(!/[0-9$%]/.test(metadata.summary))
  assert.ok(inputs.at(-1)!.messages.length <= 8)
  await saver.deleteThread(threadId)
  const restarted = setup(repo, llm)
  const reply = await runTurn(restarted.graph, { threadId, requireExisting: true, message: '¿Y la fecha límite?' })
  assert.equal(reply.intent, 'scholarship-info')
  assert.ok(inputs.at(-1)!.messages.some(message => message.content.includes('<RESUMEN>')))
  assert.equal((await repo.require(owner, id)).messageCount, 32)
})

test('request IDs replay a completed turn without another model call or duplicate archive entries', async () => {
  let calls = 0
  const { graph, repo } = setup(undefined, { generate: async () => { calls++; return 'Consulta Servicios Escolares.' } })
  const id = randomUUID(); const threadId = owner + '#' + id; const requestId = randomUUID()
  const input = { threadId, requestId, message: '¿Qué becas hay?' }
  const first = await runTurn(graph, input)
  const second = await runTurnStreaming(graph, input, new AbortController().signal, async () => {})
  assert.equal(first.id, second.id)
  assert.equal(calls, 1)
  assert.equal((await repo.require(owner, id)).messageCount, 2)
  await assert.rejects(runTurn(graph, { ...input, message: '¿Qué cursos hay?' }), /requestId/)
})

test('an archive outage keeps the answer and a checkpoint outbox; retry saves the same turn', async () => {
  class FailingStore extends MemoryDocumentStore {
    fail = true
    override async write(owner: string, writes: Write[]) {
      if (this.fail && writes.some(item => item.key.startsWith('TURN#'))) throw new Error('temporary write failure')
      await super.write(owner, writes)
    }
  }
  const store = new FailingStore()
  const { graph, repo } = setup(new ConversationRepository(store))
  const id = randomUUID(); const threadId = owner + '#' + id; const requestId = randomUUID()
  const first = await runTurn(graph, { threadId, requestId, message: 'Hola' })
  assert.equal(first.historyStatus, 'pending')
  assert.equal((await repo.require(owner, id)).messageCount, 0)
  store.fail = false
  const retry = await runTurn(graph, { threadId, requestId, requireExisting: true, message: 'Hola' })
  assert.equal(first.id, retry.id)
  assert.equal(retry.historyStatus, 'saved')
  assert.equal((await repo.require(owner, id)).messageCount, 2)
})

test('separate conversations share only controlled memory, verified profile wins, and forgetting persists', async () => {
  const inputs: LlmInput[] = []
  const { graph, repo } = setup(undefined, { generate: async input => { inputs.push(input); return 'Consulta Servicios Escolares.' } }, async () => ({ career: 'finance', campus: 'CDMX', currentSemester: 2 }))
  const first = randomUUID(); const second = randomUUID()
  await runTurn(graph, { threadId: owner + '#' + first, message: 'Quiero hacer prácticas en banca. Solo puedo por las tardes.' })
  await maintainConversation(graph, owner + '#' + first)
  assert.ok((await repo.memories(owner)).some(fact => fact.key === 'goal' && fact.value === 'banking-internship'))
  await runTurn(graph, { threadId: owner + '#' + second, profile: { career: 'law' }, message: '¿Qué becas hay?' })
  const prompt = inputs.at(-1)!
  assert.ok(prompt.messages.some(message => message.content.includes('banking-internship')))
  assert.ok(prompt.messages.at(-1)!.content.includes('Finanzas y Banca'))
  assert.ok(!prompt.messages.some(message => message.content.includes('Quiero hacer prácticas')))
  assert.equal((await repo.memories(other)).length, 0)
  await assert.rejects(runTurn(graph, { threadId: other + '#' + first, requireExisting: true, message: 'Hola' }), /No encontramos/)
  await repo.remove(owner, first, async () => {})
  assert.ok((await repo.memories(owner)).some(fact => fact.key === 'goal'))
  await forgetMemory(repo, owner)
  await runTurn(graph, { threadId: owner + '#' + second, message: 'Quiero hacer prácticas en banca.' })
  await maintainConversation(graph, owner + '#' + second)
  assert.equal((await repo.memories(owner)).filter(fact => !fact.suppressed).length, 0)
  await assert.rejects(ensureConversation(graph, owner, first), /No encontramos/)
})

test('only explicit first-person statements produce allowed categorical memories', () => {
  assert.deepEqual(extractMemories('Mi contraseña es secreto. Mi cuenta es 123456. Tengo una enfermedad.'), [])
  assert.deepEqual(extractMemories('Mi amiga dice que quiero hacer prácticas en banca.'), [])
  assert.deepEqual(extractMemories('No quiero hacer prácticas en banca.'), [])
  assert.deepEqual(extractMemories('Quiero hacer prácticas, pero no en banca.'), [])
  assert.deepEqual(extractMemories('Quiero hacer prácticas en banca.'), [{ key: 'goal', value: 'banking-internship' }])
})

test('reaffirming a memory preserves the newest provenance against a delayed older update', async () => {
  const repo = new ConversationRepository(new MemoryDocumentStore())
  await repo.saveMemory(owner, { key: 'goal', value: 'banking-internship', origin: 'conversation', observedAt: '2026-11-16T10:00:00Z' })
  await repo.saveMemory(owner, { key: 'goal', value: 'banking-internship', origin: 'conversation', observedAt: '2026-11-16T12:00:00Z' })
  await repo.saveMemory(owner, { key: 'goal', value: 'marketing-internship', origin: 'conversation', observedAt: '2026-11-16T11:00:00Z' })
  assert.equal((await repo.memories(owner))[0].value, 'banking-internship')
})

test('clearing an optional profile preference removes its stale memory and allows a newer conversation fact', async () => {
  const repo = new ConversationRepository(new MemoryDocumentStore())
  await seedMemories(repo, owner, { career: 'finance', goals: 'hacer prácticas en banca' })
  assert.equal((await repo.memories(owner)).find(fact => fact.key === 'goal')?.value, 'banking-internship')
  await seedMemories(repo, owner, { career: 'finance', goals: '' })
  assert.equal((await repo.memories(owner)).find(fact => fact.key === 'goal')?.value, '')
  await repo.saveMemory(owner, { key: 'goal', value: 'marketing-internship', origin: 'conversation', observedAt: new Date(Date.now() + 1000).toISOString() })
  assert.equal((await repo.memories(owner)).find(fact => fact.key === 'goal')?.value, 'marketing-internship')
})

test('memory and summary never authorize a generated amount', () => {
  const prompt = buildPrompt({ system: 'Sistema', language: 'es', question: '¿Qué becas hay?', profile: undefined, history: [], passages: [],
    facts: { intent: 'scholarship-info', language: 'es', items: [], missingProfileFields: [], completeness: 0, notes: [] },
    summary: '$999999', memories: [{ key: 'goal', value: '$999999', origin: 'conversation', version: 0, updatedAt: '' }] })
  assert.ok(!prompt.allowed.includes('$999999'))
  assert.equal(validateGeneration('La beca otorga $999999.', { language: 'es', allowed: prompt.allowed }).ok, false)
})

test('a distributed conversation lease excludes concurrent generation from another graph instance', async () => {
  const repo = new ConversationRepository(new MemoryDocumentStore())
  let enter!: () => void; let finish!: () => void
  const entered = new Promise<void>(resolve => { enter = resolve })
  const finished = new Promise<void>(resolve => { finish = resolve })
  const one = setup(repo, { generate: async () => { enter(); await finished; return 'Consulta Servicios Escolares.' } })
  const two = setup(repo)
  const id = randomUUID(); const threadId = owner + '#' + id
  const first = runTurn(one.graph, { threadId, message: '¿Qué becas hay?' })
  await entered
  try { await assert.rejects(runTurn(two.graph, { threadId, message: 'Hola', requireExisting: true }), /respuesta en curso/) }
  finally { finish(); await first }
})

test('stopping a streamed turn also archives the validated partial answer once', async () => {
  const abort = new AbortController()
  const { graph, repo } = setup(undefined, { generate: async () => '', async *stream(input) {
    yield 'Consulta'
    await new Promise<void>(resolve => setImmediate(resolve))
    input.signal?.throwIfAborted()
  } })
  const id = randomUUID()
  const reply = await runTurnStreaming(graph, { threadId: owner + '#' + id, message: '¿Qué becas hay?' }, abort.signal,
    async event => { if (event.event === 'token') abort.abort() })
  assert.equal(reply.interrupted, true)
  const page = await repo.messages(owner, id)
  assert.equal(page.messages.length, 2)
  assert.equal(page.messages[1].content, 'Consulta')
  assert.equal(page.messages[1].interrupted, true)
})

test('legacy checkpoints migrate their available messages without claiming a complete older archive', async () => {
  const saver = new MemorySaver()
  const catalog = new InMemoryCatalog()
  const dependencies = { catalog, dates: new CatalogDates(catalog), recommendations: new ProfileRecommendations(catalog) }
  const old = buildAssistantGraph(dependencies, saver)
  const id = randomUUID(); const threadId = owner + '#' + id
  await runTurn(old, { threadId, message: 'Hola' })
  await runTurn(old, { threadId, message: '¿Qué becas hay?' })
  const repo = new ConversationRepository(new MemoryDocumentStore())
  const upgraded = buildAssistantGraph({ ...dependencies, conversations: repo }, saver)
  await ensureConversation(upgraded, owner, id)
  assert.equal((await repo.require(owner, id)).messageCount, 4)
  await ensureConversation(upgraded, owner, id)
  assert.equal((await repo.messages(owner, id)).messages.length, 4)
})
