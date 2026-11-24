import assert from 'node:assert/strict'
import { test } from 'node:test'
import express from 'express'
import { MemoryDocumentStore } from '../assistant/conversations/store.js'
import { adminRoutes } from '../routes/adminRoutes.js'
import { auditLogFor, auditSources, auditUser, clip, createAuditLog, type NewAuditRecord } from './audit.js'

const base: NewAuditRecord = {
  owner: 'owner-1', user: { name: 'Ana', personaId: 'ana' }, conversationId: 'c1', messageId: 'm1', agent: 'Compass', tools: ['get_requirements'],
  usefulInfo: [], latencyMs: 10, guardrail: 'Permitido', mode: 'rules', question: '¿Cuándo vence la beca?', answer: 'Cierra el 26 de noviembre.',
}

test('the audit shows who ran the action without exposing the student identifier', async () => {
  assert.deepEqual(auditUser({ name: 'Ana Lucía Torres', 'custom:personaId': 'ana-ingreso', email: 'a@x' }), { name: 'Ana Lucía Torres', personaId: 'ana-ingreso' })
  assert.deepEqual(auditUser({ email: 'sofia@demo.ebc.invalid' }), { name: 'sofia@demo.ebc.invalid' })
  assert.deepEqual(auditUser(undefined), { name: 'Usuario sin nombre' })
  const log = createAuditLog(new MemoryDocumentStore())
  await log.record({ ...base, owner: 'sub-secret' })
  const [record] = await log.list()
  assert.deepEqual(record.user, { name: 'Ana', personaId: 'ana' })
  assert.deepEqual(record.tools, ['get_requirements'])
  assert.equal(JSON.stringify(record).includes('sub-secret'), false)
})

test('executions persist in the store, newest first, and survive a new log instance', async () => {
  const store = new MemoryDocumentStore()
  await createAuditLog(store).record({ ...base, messageId: 'old', question: 'primera' })
  await new Promise(resolve => setTimeout(resolve, 5))
  await createAuditLog(store).record({ ...base, messageId: 'new', question: 'segunda' })
  const records = await createAuditLog(store).list()
  assert.deepEqual(records.map(item => item.question), ['segunda', 'primera'])
  assert.equal((await createAuditLog(store).list(1)).length, 1)
})

test('the same message is recorded once, so repeated confirmations do not duplicate the trace', async () => {
  const log = createAuditLog(new MemoryDocumentStore())
  await log.record({ ...base, messageId: 'action-1', agent: 'Banner' })
  await log.record({ ...base, messageId: 'action-1', agent: 'Banner' })
  assert.equal((await log.list()).length, 1)
})

test('a rating is stored on the matching execution, can be cleared, and only its owner can change it', async () => {
  const log = createAuditLog(new MemoryDocumentStore())
  await log.record({ ...base, messageId: 'm-1' })
  await log.record({ ...base, messageId: 'm-2' })
  const rating = async (messageId: string) => (await log.list()).find(item => item.messageId === messageId)?.rating
  await log.rate('owner-1', 'c1', 'm-2', 'negative')
  assert.equal(await rating('m-2'), 'negative')
  assert.equal(await rating('m-1'), undefined)
  await log.rate('someone-else', 'c1', 'm-2', 'positive')
  await log.rate('owner-1', 'otra-conversacion', 'm-2', 'positive')
  assert.equal(await rating('m-2'), 'negative')
  await log.rate('owner-1', 'c1', 'm-2', 'positive')
  assert.equal(await rating('m-2'), 'positive')
  await log.rate('owner-1', 'c1', 'm-2', null)
  assert.equal(await rating('m-2'), undefined)
})

test('a failing store never breaks the chat: the audit swallows the error', async () => {
  const broken = new MemoryDocumentStore()
  broken.write = async () => { throw new Error('boom') }
  broken.page = async () => { throw new Error('boom') }
  const log = createAuditLog(broken)
  await assert.doesNotReject(log.record(base))
  assert.deepEqual(await log.list(), [])
})

test('the audit clips long messages', () => {
  const long = 'a'.repeat(2000)
  assert.equal(clip('hola'), 'hola')
  assert.equal(clip(long).length, 600)
  assert.ok(clip(long).endsWith('…'))
})

test('the admin endpoint reads the persisted trace and is only open to admins', async () => {
  const store = new MemoryDocumentStore()
  const log = createAuditLog(store)
  await log.record({ ...base, owner: 'owner-2', user: { name: 'Diego', personaId: 'diego' }, conversationId: 'c-api', messageId: 'm-api' })
  await log.rate('owner-2', 'c-api', 'm-api', 'positive')
  const get = async (claims?: Record<string, unknown>) => {
    const app = express()
    app.use((request, _response, next) => { (request as unknown as { verifiedClaims?: unknown }).verifiedClaims = claims; next() })
    app.use('/api/admin', adminRoutes(store))
    const server = app.listen(0)
    try {
      const response = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/api/admin/audit`)
      return { status: response.status, body: await response.json() as { records?: { conversationId: string; user: unknown; rating?: string; owner?: string; tools: string[] }[] } }
    } finally { server.close() }
  }
  assert.equal((await get()).status, 403)
  assert.equal((await get({ 'cognito:groups': ['students'] })).status, 403)
  assert.equal((await get({ 'cognito:groups': '[admin]' })).status, 200)
  assert.equal((await get({ 'cognito:groups': '[students]' })).status, 403)
  const allowed = await get({ 'cognito:groups': ['admin'] })
  assert.equal(allowed.status, 200)
  const record = allowed.body.records?.find(item => item.conversationId === 'c-api')
  assert.deepEqual(record?.user, { name: 'Diego', personaId: 'diego' })
  assert.deepEqual(record?.tools, ['get_requirements'])
  assert.equal(record?.rating, 'positive')
  assert.equal('owner' in (record ?? {}), false)
})

test('the audit keeps each source with its type, how it was retrieved and its similarity', async () => {
  const log = createAuditLog(new MemoryDocumentStore())
  const sources = auditSources([
    { kind: 'opportunity', id: 'scholarship-first-entry', title: 'Beca de primer ingreso' },
    { kind: 'document', id: 'solicitud-beca.md', title: 'Cómo solicitar una beca', origin: 'vector', score: 0.87 },
    { kind: 'document', id: 'reinscripcion.md', title: 'Reinscripción', origin: 'keyword', score: 0.5 },
  ])
  await log.record({ ...base, messageId: 'm-src', sources })
  const [record] = await log.list()
  assert.deepEqual(record.sources, sources)
  assert.deepEqual(record.sources?.filter(item => item.kind === 'document').map(item => item.origin), ['vector', 'keyword'])
  assert.equal(auditSources(Array.from({ length: 10 }, (_, index) => ({ kind: 'record' as const, id: 'r' + index, title: 'T' }))).length, 6)
})

test('la traza de un turno con modelo guarda el selector y el modelo de Bedrock; con reglas no guarda modelo', async () => {
  const { recordTurnAudit } = await import('./turnAudit.js')
  const store = new MemoryDocumentStore()
  process.env.BEDROCK_TERRA_MODEL_ID = 'us.amazon.nova-2-lite-v1:0'
  const base = { id: 'm', createdAt: '2026-01-01T00:00:00Z', role: 'assistant', content: 'ok', language: 'es', intent: 'unknown', suggestions: [], sources: [], degraded: false } as never
  await recordTurnAudit(store, { owner: 'o', claims: undefined, conversationId: 'c', message: 'hola', reply: { ...(base as object), id: 'm1', generatedBy: 'llm' } as never, latencyMs: 5, model: 'terra' })
  await recordTurnAudit(store, { owner: 'o', claims: undefined, conversationId: 'c', message: 'hola', reply: { ...(base as object), id: 'm2', generatedBy: 'rules' } as never, latencyMs: 5 })
  const records = await auditLogFor(store).list()
  assert.equal(records.find(item => item.mode === 'llm')?.model, 'Terra · us.amazon.nova-2-lite-v1:0')
  assert.equal(records.find(item => item.mode === 'rules')?.model, undefined)
})
