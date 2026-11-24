import '../testing/seedCatalog.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import { createAssistant } from '../assistant/index.js'
import { loadAssistantConfig } from '../config/env.js'
import { assistantRoutes } from './assistantRoutes.js'
import type { AuthRequest } from '../auth/identity.js'

const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
test('conversation and memory API enforce verified ownership, pagination, edits and separate forgetting', async t => {
  const assistant = createAssistant({ config: loadAssistantConfig({ ASSISTANT_MODE: 'rules', ASSISTANT_STORE: 'memory' }),
    profileReader: async owner => owner === alice ? { career: 'law', campus: 'CDMX', currentSemester: 2 } : undefined })
  const app = express()
  app.use(express.json(), (request, _response, next) => {
    const owner = request.headers['x-test-owner']
    if (owner === alice || owner === bob) (request as AuthRequest).verifiedClaims = { sub: owner, ...(owner === alice ? { 'custom:career': 'finance' } : {}) }
    next()
  }, assistantRoutes(assistant))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  const base = 'http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port
  const call = async (method: string, path: string, owner?: string, body?: unknown) => fetch(base + path, { method,
    headers: { 'content-type': 'application/json', ...(owner ? { 'x-test-owner': owner } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  assert.equal((await call('GET', '/conversations')).status, 401)
  const created = await call('POST', '/conversations', alice)
  assert.equal(created.status, 201)
  const { conversationId } = await created.json() as { conversationId: string }
  const first = await call('POST', '/messages', alice, { conversationId, studentId: bob, message: 'Hola' })
  assert.equal(first.status, 200)
  assert.equal((await first.json() as { meta: { historyStatus: string } }).meta.historyStatus, 'saved')
  assert.equal((await call('GET', '/conversations/' + conversationId, bob)).status, 404)
  assert.equal((await call('POST', '/messages', bob, { conversationId, studentId: alice, message: 'Hola' })).status, 404)
  const one = await (await call('GET', '/conversations/' + conversationId + '?limit=1', alice)).json() as { messages: unknown[]; nextCursor: string }
  assert.equal(one.messages.length, 1)
  assert.ok(one.nextCursor)
  const two = await (await call('GET', '/conversations/' + conversationId + '?limit=1&cursor=' + encodeURIComponent(one.nextCursor), alice)).json() as { messages: { id: string; role: string }[] }
  assert.equal(two.messages[0].role, 'assistant')
  const feedbackPath = `/conversations/${conversationId}/messages/${two.messages[0].id}/feedback`
  assert.equal((await call('PUT', feedbackPath, undefined, { rating: 'positive' })).status, 401)
  assert.equal((await call('PUT', feedbackPath, bob, { rating: 'positive' })).status, 404)
  assert.equal((await call('PUT', feedbackPath, alice, { rating: 'invalid' })).status, 400)
  const savedFeedback = async () => (await call('GET', '/conversations/' + conversationId, alice).then(r => r.json()) as { messages: { role: string; feedback?: string }[] })
    .messages.find(m => m.role === 'assistant')?.feedback ?? null
  assert.equal((await call('PUT', `/conversations/${conversationId}/messages/${alice}/feedback`, alice, { rating: 'positive' })).status, 404)

  // Si el almacenamiento falla, no queda valoración guardada y se puede reintentar.
  const originalWrite = assistant.conversations!.store.write.bind(assistant.conversations!.store)
  assistant.conversations!.store.write = async () => { throw new Error('storage unavailable') }
  assert.equal((await call('PUT', feedbackPath, alice, { rating: 'positive' })).status, 503)
  assistant.conversations!.store.write = originalWrite
  assert.equal(await savedFeedback(), null)

  // Una respuesta se valora una sola vez: repetir la misma valoración es inofensivo; cambiarla o quitarla no.
  assert.equal((await call('PUT', feedbackPath, alice, { rating: 'positive' })).status, 204)
  assert.equal((await call('PUT', feedbackPath, alice, { rating: 'positive' })).status, 204)
  for (const rating of ['negative', null]) {
    const response = await call('PUT', feedbackPath, alice, { rating })
    assert.equal(response.status, 409)
    assert.equal((await response.json() as { code: string }).code, 'FEEDBACK_ALREADY_SET')
  }
  assert.equal(await savedFeedback(), 'positive')
  assert.equal((await call('GET', '/conversations/' + conversationId + '?cursor=Zm9v', alice)).status, 400)
  assert.equal((await call('PATCH', '/conversations/' + conversationId, alice, { title: 'Mi orientación' })).status, 204)
  const list = await (await call('GET', '/conversations', alice)).json() as { conversations: { title: string }[] }
  assert.equal(list.conversations[0].title, 'Mi orientación')
  assert.equal((await call('PUT', '/memory/goal', alice, { value: 'banking-internship' })).status, 204)
  assert.equal((await call('PUT', '/memory/health', alice, { value: 'datos sensibles' })).status, 400)
  assert.equal((await call('PUT', '/memory/career', alice, { value: 'law' })).status, 409)
  const memory = await call('GET', '/memory', alice).then(response => response.json()) as { facts: { key: string; value: string }[] }
  assert.equal(memory.facts.find(fact => fact.key === 'career')?.value, 'finance')
  assert.equal((await call('GET', '/memory', bob).then(response => response.json()) as { facts: unknown[] }).facts.length, 0)
  assert.equal((await call('DELETE', '/conversations/' + conversationId, alice)).status, 204)
  assert.equal((await call('GET', '/conversations/' + conversationId, alice)).status, 404)
  assert.equal((await assistant.conversations!.store.page(alice, 'FEEDBACK#' + conversationId + '#', 100)).items.length, 0)
  assert.ok((await call('GET', '/memory', alice).then(response => response.json()) as { facts: { key: string }[] }).facts.some(fact => fact.key === 'goal'))
  assert.equal((await call('DELETE', '/memory', alice)).status, 204)
  assert.equal((await call('GET', '/memory', alice).then(response => response.json()) as { facts: unknown[] }).facts.length, 0)
})
