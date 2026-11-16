// Verificación del flujo completo de la demo contra el backend en marcha (script de API, no una suite de pruebas):
// catálogo -> recomendaciones -> alertas -> asistente en español e inglés con perfil -> historial -> borrado.
//   npm run dev            (en otra terminal)
//   npm run verify:flow    (usa 3 preguntas al asistente: 2 en español y 1 en inglés)

import { randomUUID } from 'node:crypto'

const API = process.env.VERIFY_API_URL ?? 'http://localhost:3000'
const studentId = randomUUID()
const profile = { name: 'María', campus: 'CMS', career: 'finance', currentSemester: 5, completedCourses: ['FIN-301'], interests: ['inversiones'] }

let failures = 0
const check = (ok: boolean, label: string, detail = '') => {
  if (!ok) failures += 1
  console.log(`${ok ? '✔' : '✖'} ${label}${detail ? ` — ${detail}` : ''}`)
}

async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T; ms: number }> {
  const started = performance.now()
  const response = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await response.text()
  return { status: response.status, data: (text ? JSON.parse(text) : undefined) as T, ms: Math.round(performance.now() - started) }
}

interface Reply {
  conversationId: string
  message: { content: string; intent: string; language: string; sources: { id: string }[]; suggestions: string[] }
  meta: { mode: string; latencyMs: number; degraded: boolean }
}

try {
  const health = await call('GET', '/api/health')
  check(health.status === 200, 'Backend responde', `${health.ms} ms`)
} catch {
  console.error(`✖ No hay backend en ${API}. Levántalo con: npm run dev`)
  process.exit(1)
}

// 1) Catálogo, recomendaciones y alertas (lo que ve el estudiante en Inicio y Oportunidades)
const catalog = await call<{ type: string }[]>('GET', '/api/opportunities?career=finance')
check(catalog.status === 200 && catalog.data.length > 0, 'Catálogo de oportunidades para Finanzas', `${catalog.data.length} oportunidades, ${new Set(catalog.data.map((o) => o.type)).size} tipos`)
const recommendations = await call<unknown[]>('GET', '/api/recommendations?career=finance&semester=5&interests=inversiones')
check(recommendations.status === 200 && recommendations.data.length > 0, 'Recomendaciones del motor', `${recommendations.data.length} resultados`)
const alerts = await call<unknown[]>('GET', '/api/alerts')
check(alerts.status === 200 && alerts.data.length <= 5, 'Alertas próximas (máximo 5)', `${alerts.data.length}`)

// 2) Asistente en español, con perfil y seguimiento
const first = await call<Reply>('POST', '/api/assistant/messages', { studentId, message: '¿Qué becas hay para mi carrera?', profile })
const conversationId = first.data.conversationId
check(first.status === 200 && first.data.message.intent === 'scholarship-info' && first.data.message.language === 'es', 'Asistente (ES): becas para mi carrera', `${first.data.meta.mode}, ${first.data.meta.latencyMs} ms${first.data.meta.degraded ? ', DEGRADADO' : ''}`)
check(first.data.message.sources.some((s) => s.id.startsWith('scholarship-')), 'La respuesta cita las becas del catálogo', first.data.message.sources.map((s) => s.id).join(', '))
check(first.data.message.suggestions.length > 0, 'La respuesta trae preguntas sugeridas')

const followUp = await call<Reply>('POST', '/api/assistant/messages', { studentId, conversationId, message: '¿y la fecha límite?', profile })
check(followUp.status === 200 && followUp.data.message.intent === 'scholarship-info', 'Asistente (ES): el seguimiento conserva el tema', `${followUp.data.meta.mode}, ${followUp.data.meta.latencyMs} ms`)

// 3) Asistente en inglés (otra conversación del mismo estudiante)
const english = await call<Reply>('POST', '/api/assistant/messages', { studentId, message: 'Which certifications do you recommend?', profile })
check(english.status === 200 && english.data.message.language === 'en' && english.data.message.intent === 'career-info', 'Asistente (EN): responde en inglés', `${english.data.meta.mode}, ${english.data.meta.latencyMs} ms`)

// 4) RF-05.12: en modo rules cada respuesta debe tardar menos de 2 s
const rulesTimes = [first, followUp, english].filter((r) => r.data.meta.mode === 'rules').map((r) => r.data.meta.latencyMs)
check(rulesTimes.every((ms) => ms < 2000), 'RF-05.12 (< 2 s) en respuestas por reglas', rulesTimes.length ? `${Math.max(...rulesTimes)} ms máx.` : 'sin respuestas por reglas en esta corrida (modo llm)')

// 5) Historial y borrado (NF-03.5)
const history = await call<{ messages: unknown[] }>('GET', `/api/assistant/conversations/${conversationId}?studentId=${studentId}`)
check(history.status === 200 && history.data.messages.length === 4, 'El historial guarda los 2 turnos', `${history.data.messages.length} mensajes`)
const removed = await call('DELETE', `/api/assistant/conversations/${conversationId}?studentId=${studentId}`)
const gone = await call('GET', `/api/assistant/conversations/${conversationId}?studentId=${studentId}`)
check(removed.status === 204 && gone.status === 404, 'Borrar la conversación la elimina')
await call('DELETE', `/api/assistant/conversations/${english.data.conversationId}?studentId=${studentId}`)

console.log(failures === 0 ? '\nFlujo completo verificado.' : `\n${failures} verificación(es) fallaron.`)
process.exit(failures === 0 ? 0 : 1)
