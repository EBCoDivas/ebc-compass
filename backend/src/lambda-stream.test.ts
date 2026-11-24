import test from 'node:test'
import assert from 'node:assert/strict'
import { Writable } from 'node:stream'
process.env.ASSISTANT_MODE = 'rules'
process.env.ASSISTANT_STORE = 'memory'
type Invoke = (event: unknown, stream: Writable) => Promise<void>
let metadata: { statusCode: number; headers: Record<string, string> }
;(globalThis as unknown as { awslambda: unknown }).awslambda = {
  streamifyResponse: (fn: Invoke) => fn,
  HttpResponseStream: { from: (stream: Writable, meta: typeof metadata) => { metadata = meta; return stream } },
}
test('Lambda streaming accepts REST authorizer claims and emits SSE with the runtime stream', async () => {
  const { handler } = await import('./lambda-stream.js')
  let text = ''
  const output = new Writable({ write(chunk, _encoding, done) { text += chunk.toString(); done() } })
  await (handler as Invoke)({ httpMethod: 'POST', path: '/api/assistant/messages/stream',
    requestContext: { authorizer: { claims: { sub: '11111111-1111-4111-8111-111111111111' } } },
    body: JSON.stringify({ message: 'Hola' }),
  }, output)
  assert.equal(metadata.statusCode, 200)
  assert.match(metadata.headers['Content-Type'], /text\/event-stream/)
  assert.match(text, /event: meta/)
  assert.match(text, /event: done/)
  assert.ok(output.writableEnded)
})
test('Lambda streaming rejects missing identity before opening an SSE response', async () => {
  const { handler } = await import('./lambda-stream.js')
  let text = ''
  const output = new Writable({ write(chunk, _encoding, done) { text += chunk.toString(); done() } })
  await (handler as Invoke)({ httpMethod: 'POST', path: '/api/assistant/messages/stream', body: '{}' }, output)
  assert.equal(metadata.statusCode, 401)
  assert.match(text, /UNAUTHORIZED/)
})

test('Lambda streaming leaves each turn in the admin trace with who asked, the answer and the tools', async () => {
  const { handler, assistant } = await import('./lambda-stream.js')
  const { auditLogFor } = await import('./admin/audit.js')
  const output = new Writable({ write(_chunk, _encoding, done) { done() } })
  await (handler as Invoke)({ httpMethod: 'POST', path: '/api/assistant/messages/stream',
    requestContext: { authorizer: { claims: { sub: '22222222-2222-4222-8222-222222222222', name: 'Ana Lucía Torres', 'custom:personaId': 'ana' } } },
    body: JSON.stringify({ message: '¿Qué becas hay disponibles?' }),
  }, output)
  const records = await auditLogFor(assistant.conversations?.store).list()
  const record = records.find(item => item.question === '¿Qué becas hay disponibles?')
  assert.ok(record, 'el turno por streaming debe quedar en la traza')
  assert.deepEqual(record.user, { name: 'Ana Lucía Torres', personaId: 'ana' })
  assert.equal(record.agent, 'Compass')
  assert.ok(record.answer.length > 0)
  assert.equal(record.guardrail, 'Permitido')
  assert.equal('owner' in record, false)
})
