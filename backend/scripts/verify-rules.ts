// Verificación manual del asistente en modo "rules" (sin LLM ni red): corre una lista de preguntas de ejemplo
// (máximo 5 en español y 5 en inglés) a través del grafo real y muestra intent, idioma y latencia de cada respuesta.
//   npm run verify:rules             resumen (✔/✖ por pregunta)
//   npm run verify:rules -- --verbose   además imprime cada respuesta para revisarla
// No es una suite de pruebas: sirve para revisar a ojo las respuestas y comprobar que cada una tarda < 2 s (RF-05.12).

import { MemorySaver } from '@langchain/langgraph'
import { CatalogDates, InMemoryCatalog, ProfileRecommendations } from '../src/assistant/adapters/catalog.js'
import { buildAssistantGraph, runTurn } from '../src/assistant/graph/assistantGraph.js'
import type { AssistantProfile, Intent, Language } from '../src/assistant/types.js'

const verbose = process.argv.includes('--verbose')
const today = new Date(2026, 10, 16) // fecha fija para que los días restantes sean reproducibles

const finance: AssistantProfile = { name: 'María', campus: 'CMS', career: 'finance', currentSemester: 5, completedCourses: ['FIN-301'], interests: ['inversiones'] }

interface Case {
  thread: string
  message: string
  profile?: AssistantProfile
  intent: Intent
  language: Language
}

const cases: Case[] = [
  // Español (5): conversación A con perfil de Finanzas, semestre 5
  { thread: 'A', message: '¿Qué becas hay disponibles?', profile: finance, intent: 'scholarship-info', language: 'es' },
  { thread: 'A', message: '¿y la fecha límite?', profile: finance, intent: 'scholarship-info', language: 'es' },
  { thread: 'A', message: '¿Cuáles son los prerrequisitos de FIN-301?', profile: finance, intent: 'course-info', language: 'es' },
  { thread: 'A', message: '¿Cómo me reinscribo?', profile: finance, intent: 'procedure-info', language: 'es' },
  { thread: 'A', message: 'asdfgh qwerty', profile: finance, intent: 'unknown', language: 'es' },
  // Inglés (5): conversación B sin perfil
  { thread: 'B', message: 'What scholarships can I get?', intent: 'scholarship-info', language: 'en' },
  { thread: 'B', message: 'and the deadline?', intent: 'scholarship-info', language: 'en' },
  { thread: 'B', message: 'How do I enroll?', intent: 'procedure-info', language: 'en' },
  { thread: 'B', message: 'What are the upcoming deadlines?', intent: 'deadline-query', language: 'en' },
  { thread: 'B', message: 'what can you do?', intent: 'help', language: 'en' },
]

const graph = buildAssistantGraph(
  (() => {
    const catalog = new InMemoryCatalog()
    return { catalog, recommendations: new ProfileRecommendations(catalog, () => today), dates: new CatalogDates(catalog), now: () => today }
  })(),
  new MemorySaver(),
)

let failures = 0
let slowest = 0
for (const item of cases) {
  const started = performance.now()
  const reply = await runTurn(graph, { threadId: `verify-${item.thread}`, message: item.message, profile: item.profile })
  const ms = Math.round(performance.now() - started)
  slowest = Math.max(slowest, ms)
  const ok = reply.intent === item.intent && reply.language === item.language && ms < 2000
  if (!ok) failures += 1
  console.log(`${ok ? '✔' : '✖'} [${item.thread}] "${item.message}" → ${reply.intent}/${reply.language} ${ms}ms${ok ? '' : `   (esperado ${item.intent}/${item.language})`}`)
  if (verbose || !ok) console.log(reply.content.split('\n').map((line) => `     │ ${line}`).join('\n') + '\n')
}

console.log(`\n${cases.length - failures}/${cases.length} como se esperaba · respuesta más lenta: ${slowest} ms (límite RF-05.12: 2000 ms)`)
process.exit(failures === 0 ? 0 : 1)
