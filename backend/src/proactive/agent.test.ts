import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import express from 'express'
import { ConversationRepository } from '../assistant/conversations/repository.js'
import { MemoryDocumentStore } from '../assistant/conversations/store.js'
import { fixedBanner } from '../banner/reader.js'
import { createProactiveAgent } from './agent.js'
import { createProactiveRoutes } from '../routes/proactiveRoutes.js'

const entry = { subject: 'e0bc0000-0000-4000-8000-000000000010', personaId: 'ana-ingreso', enrollment: 'M0100018', career: 'accounting', campus: 'QRO', semester: 1 }
const closing = { subject: 'e0bc0000-0000-4000-8000-000000000003', personaId: 'ana', enrollment: 'M0100012', career: 'accounting', campus: 'QRO', semester: 7 }

function setup(llm?: { generate: () => Promise<string> }) {
  const store = new MemoryDocumentStore()
  const memories = new ConversationRepository(store)
  return { store, conversations: memories, agent: createProactiveAgent({ store, memories, banner: fixedBanner, llm, today: () => '2026-11-22', now: () => new Date('2026-11-22T12:00:00Z') }) }
}

test('first entry gets a deterministic scholarship notice with the valid catalog opportunity', async () => {
  const { agent } = setup()
  const notices = await agent.ensure(entry)
  assert.deepEqual(notices.map(item => [item.kind, item.opportunityId, item.priority]), [['scholarship', 'scholarship-first-entry', 'high']])
  assert.match(notices[0].message, /carta de motivos/)
})

test('closing student gets social service notice using an afternoon catalog option from memory', async () => {
  const { agent } = setup()
  const notices = await agent.ensure(closing)
  assert.equal(notices[0].kind, 'social-service')
  assert.equal(notices[0].opportunityId, 'accounting-service-community')
  assert.match(notices[0].message, /no completar tus horas/)
})

test('model text is ignored, invalid output falls back, and unchanged context is not generated twice', async () => {
  let calls = 0
  const { agent } = setup({ generate: async () => { calls++; return JSON.stringify({ notices: [{ candidateId: 'scholarship-first-entry', title: 'Vence mañana', message: 'Paga un trámite inventado.', priority: 'low' }] }) } })
  const first = await agent.ensure(entry)
  const second = await agent.ensure(entry)
  assert.equal(calls, 1)
  assert.equal(first[0].opportunityId, 'scholarship-first-entry')
  assert.equal(first[0].title, 'Tu beca de primer ingreso')
  assert.doesNotMatch(first[0].message, /Paga un trámite/)
  assert.deepEqual(second, first)

  const failed = setup({ generate: async () => { throw new Error('timeout') } })
  assert.equal((await failed.agent.ensure(closing))[0].kind, 'social-service')
})

test('concurrent generation makes one model call and both callers receive a valid notice', async () => {
  let calls = 0
  const { agent } = setup({ generate: async () => {
    calls++
    await new Promise(resolve => setTimeout(resolve, 20))
    return JSON.stringify({ notices: [{ candidateId: 'scholarship-first-entry' }] })
  } })
  const [first, second] = await Promise.all([agent.ensure(entry), agent.ensure(entry)])
  assert.equal(calls, 1)
  assert.equal(first[0].opportunityId, 'scholarship-first-entry')
  assert.equal(second[0].opportunityId, 'scholarship-first-entry')
})

test('a changed relevant memory invalidates the stored result', async () => {
  let calls = 0
  const { store, agent } = setup({ generate: async () => { calls++; return JSON.stringify({ notices: [{ candidateId: 'social-service-pace', title: 'Servicio social', message: 'Revisa tus opciones vigentes.', priority: 'high' }] }) } })
  await agent.ensure(closing)
  await store.write(closing.subject, [{ key: 'MEM#workSchedule', value: { key: 'workSchedule', value: 'works-mornings', origin: 'user', version: 0 } }])
  await agent.ensure(closing)
  assert.equal(calls, 2)
})

test('routes derive identity from claims and only read notices owned by that student', async t => {
  const { agent, conversations } = setup()
  let claims: Record<string, unknown> | undefined
  const app = express()
  app.use((request, _response, next) => { (request as express.Request & { verifiedClaims?: Record<string, unknown> }).verifiedClaims = claims; next() })
  app.use('/proactive', createProactiveRoutes(agent, conversations))
  const server = app.listen(0, '127.0.0.1')
  t.after(() => { server.closeAllConnections(); server.close() })
  await once(server, 'listening')
  const url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/proactive/notices'

  assert.equal((await fetch(url)).status, 401)
  claims = { sub: entry.subject, 'custom:personaId': entry.personaId, 'custom:matricula': entry.enrollment,
    'custom:career': entry.career, 'custom:campusCode': entry.campus, 'custom:semestre': String(entry.semester) }
  const generated = await fetch(url + '/ensure', { method: 'POST', body: JSON.stringify({ studentId: closing.subject }), headers: { 'Content-Type': 'application/json' } })
  assert.equal(generated.status, 200)
  assert.equal((await generated.json() as { notices: { opportunityId?: string }[] }).notices[0].opportunityId, 'scholarship-first-entry')
  const firstConversation = await fetch(url + '/scholarship-first-entry/conversation', { method: 'POST' })
  const { conversationId } = await firstConversation.json() as { conversationId: string }
  const repeatedConversation = await fetch(url + '/scholarship-first-entry/conversation', { method: 'POST' })
  assert.equal((await repeatedConversation.json() as { conversationId: string }).conversationId, conversationId)
  const messages = await conversations.messages(entry.subject, conversationId)
  assert.equal(messages.messages.length, 1)
  assert.equal(messages.messages[0].role, 'assistant')
  assert.match(messages.messages[0].content, /carta de motivos/)
  assert.deepEqual(messages.messages[0].suggestions, ['¿Qué me falta para solicitar la beca?', '¿Cuáles son los requisitos de la beca?'])
  claims = { sub: closing.subject, 'custom:personaId': closing.personaId, 'custom:matricula': closing.enrollment,
    'custom:career': closing.career, 'custom:campusCode': closing.campus, 'custom:semestre': String(closing.semester) }
  assert.deepEqual(await (await fetch(url)).json(), { notices: [] })
})
