// Streaming HTTP real: Cognito local + SSE + grafo + SDK ConverseStream + puente OpenAI.
// Una consulta al LLM; no escribe conversaciones demo ni imprime credenciales.
import { readFileSync } from 'node:fs'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import assert from 'node:assert/strict'
import express from 'express'
import { createAuthenticatedLocalApp } from '../src/auth/localAuth.js'
import { createAssistant } from '../src/assistant/index.js'
import { loadAssistantConfig } from '../src/config/env.js'
import { assistantRoutes } from '../src/routes/assistantRoutes.js'
const state = JSON.parse(readFileSync(new URL('../../local/.state/cognito.json', import.meta.url), 'utf8'))
const assistant = createAssistant({ config: { ...loadAssistantConfig(), mode: 'llm' } })
const business = express()
business.use(express.json())
business.use('/api/assistant', assistantRoutes(assistant))
const app = await createAuthenticatedLocalApp(business, state)
const server = app.listen(0, '127.0.0.1')
await once(server, 'listening')
const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
try {
  const login = await fetch(base + '/api/dev/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state.users.valerie) })
  assert.equal(login.status, 200)
  const { idToken } = await login.json() as { idToken: string }
  const response = await fetch(base + '/api/assistant/messages/stream', { method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + idToken },
    body: JSON.stringify({ message: '¿Qué becas hay disponibles? Explica sus diferencias.' }),
  })
  assert.equal(response.status, 200)
  assert.ok(response.headers.get('content-type')?.includes('text/event-stream'))
  let text = ''
  let reads = 0
  const decoder = new TextDecoder()
  for await (const chunk of response.body!) { text += decoder.decode(chunk, { stream: true }); reads++ }
  const frames = text.split(/\r?\n\r?\n/).filter(frame => frame.startsWith('event:'))
  const tokens = frames.filter(frame => frame.startsWith('event: token'))
  assert.ok(tokens.length > 0, 'ConverseStream debe emitir fragmentos')
  assert.ok(!frames.some(frame => frame.startsWith('event: error')))
  const frame = frames.find(frame => frame.startsWith('event: done'))
  assert.ok(frame)
  const done = JSON.parse(frame.split('data: ')[1])
  assert.ok(done.message.content.length > 0)
  assert.equal(done.message.failure, undefined, 'El turno debe completarse sin respaldo ni rechazo')
  assert.ok(done.meta.usage?.totalInputTokens > 0, 'SSE debe incluir métricas reales del proveedor')
  assert.equal(done.meta.usage.totalInputTokens, done.meta.usage.inputTokens + (done.meta.usage.cacheReadInputTokens ?? 0) + (done.meta.usage.cacheWriteInputTokens ?? 0))
  const history = await fetch(base + '/api/assistant/conversations/' + done.conversationId, { headers: { authorization: 'Bearer ' + idToken } })
  assert.equal(history.status, 200)
  assert.equal((await history.json() as { messages: unknown[] }).messages.length, 2)
  const cleanup = await fetch(base + '/api/assistant/conversations/' + done.conversationId, { method: 'DELETE', headers: { authorization: 'Bearer ' + idToken } })
  assert.equal(cleanup.status, 204)
  console.log('✔ Streaming real: ' + tokens.length + ' fragmentos, ' + reads + ' lecturas HTTP; respuesta final e historial verificados (' + done.meta.mode + ').')
} finally { server.closeAllConnections(); server.close() }
