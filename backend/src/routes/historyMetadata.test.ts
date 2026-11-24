import '../testing/seedCatalog.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import { createAssistant } from '../assistant/index.js'
import { loadAssistantConfig } from '../config/env.js'
import { assistantRoutes } from './assistantRoutes.js'
import type { AuthRequest } from '../auth/identity.js'

test('JSON and streaming responses retain identical display metadata in the archive', async t => {
  const assistant = createAssistant({ config: loadAssistantConfig({ ASSISTANT_MODE: 'rules', ASSISTANT_STORE: 'memory' }) })
  const app = express()
  app.use(express.json(), (request, _response, next) => {
    (request as AuthRequest).verifiedClaims = { sub: '11111111-1111-4111-8111-111111111111' }
    next()
  }, assistantRoutes(assistant))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  const base = 'http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port
  for (const streaming of [false, true]) {
    const response = await fetch(base + (streaming ? '/messages/stream' : '/messages'), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: '¿Qué becas hay?' }),
    })
    assert.equal(response.status, 200)
    const reply = streaming ? JSON.parse((await response.text()).match(/event: done\ndata: ([^\n]+)/)![1]) : await response.json()
    const historyResponse = await fetch(base + '/conversations/' + reply.conversationId)
    assert.equal(historyResponse.status, 200)
    const history = await historyResponse.json() as { messages: { role: string; sources?: unknown[]; suggestions?: string[]; mode?: string; degraded?: boolean; latencyMs?: number }[] }
    const saved = history.messages.find(message => message.role === 'assistant')!
    assert.ok(reply.message.sources.length > 0)
    assert.ok(reply.message.suggestions.length > 0)
    assert.deepEqual(saved.sources, reply.message.sources)
    assert.deepEqual(saved.suggestions, reply.message.suggestions)
    assert.equal(saved.mode, reply.meta.mode)
    assert.equal(saved.degraded, reply.meta.degraded)
    assert.equal(saved.latencyMs, reply.meta.latencyMs)
    assert.ok(typeof saved.latencyMs === 'number' && saved.latencyMs >= 0)
  }
})
