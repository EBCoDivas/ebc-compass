// Verifica el handler de Lambda (backend/src/lambda.ts) invocándolo con eventos de API Gateway HTTP API (payload v2),
// igual que lo hará AWS, sin necesidad de nube: modo reglas y conversaciones en memoria.
//   npm run verify:lambda

process.env.ASSISTANT_MODE = 'rules'
process.env.ASSISTANT_STORE = 'memory'

const { handler } = await import('../src/lambda.js')

let failures = 0
const check = (ok: boolean, label: string, detail = '') => {
  if (!ok) failures += 1
  console.log(`${ok ? '✔' : '✖'} ${label}${detail ? ` — ${detail}` : ''}`)
}

const alice = '11111111-1111-4111-8111-111111111111'
const mallory = '22222222-2222-4222-8222-222222222222'

function event(method: string, path: string, options: { query?: string; body?: unknown; sub?: string } = {}) {
  return {
    version: '2.0',
    routeKey: `${method} ${path}`,
    rawPath: path,
    rawQueryString: options.query ?? '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      http: { method, path, sourceIp: '127.0.0.1', userAgent: 'verify-lambda' },
      ...(options.sub ? { authorizer: { jwt: { claims: { sub: options.sub } } } } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    isBase64Encoded: false,
  }
}

async function invoke(method: string, path: string, options: { query?: string; body?: unknown; sub?: string } = {}) {
  const result = (await handler(event(method, path, options), {} as never)) as { statusCode: number; body: string }
  return { status: result.statusCode, json: result.body ? JSON.parse(result.body) : undefined }
}

const health = await invoke('GET', '/api/health')
check(health.status === 200, 'GET /api/health', health.json?.service)

const catalog = await invoke('GET', '/api/opportunities', { query: 'career=finance' })
check(catalog.status === 200 && catalog.json.length > 0, 'GET /api/opportunities', `${catalog.json.length} oportunidades`)

// La identidad sale del token verificado (sub), no del studentId del cuerpo.
const reply = await invoke('POST', '/api/assistant/messages', { sub: alice, body: { studentId: mallory, message: '¿Qué becas hay disponibles?' } })
const conversationId = reply.json.conversationId
check(reply.status === 200 && reply.json.message.intent === 'scholarship-info', 'POST /api/assistant/messages con token', `${reply.json.meta.mode}, ${reply.json.meta.latencyMs} ms`)

const own = await invoke('GET', `/api/assistant/conversations/${conversationId}`, { sub: alice })
check(own.status === 200 && own.json.messages.length === 2, 'El dueño (sub del token) lee su conversación sin enviar studentId', `${own.json.messages?.length} mensajes`)

const foreign = await invoke('GET', `/api/assistant/conversations/${conversationId}`, { sub: mallory })
check(foreign.status === 404, 'Otro usuario autenticado no puede leerla (404)')

const spoof = await invoke('GET', `/api/assistant/conversations/${conversationId}`, { sub: mallory, query: `studentId=${alice}` })
check(spoof.status === 404, 'Enviar el studentId ajeno no sirve de nada: manda el token')

const removed = await invoke('DELETE', `/api/assistant/conversations/${conversationId}`, { sub: alice })
check(removed.status === 204, 'DELETE de la conversación')

const bad = await invoke('POST', '/api/assistant/messages', { sub: alice, body: { message: '' } })
check(bad.status === 400 && bad.json.code === 'INVALID_INPUT', 'Mensaje vacío → 400 INVALID_INPUT')

console.log(failures === 0 ? '\nHandler de Lambda verificado.' : `\n${failures} verificación(es) fallaron.`)
process.exit(failures === 0 ? 0 : 1)
