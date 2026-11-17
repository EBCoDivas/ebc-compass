// Verificación manual del asistente en modo "llm": usa el grafo real con Bedrock Converse y Retrieve a través del
// puente local (OpenAI). CONSUME API de OpenAI: son pocas preguntas a propósito (2 en español y 2 en inglés).
//   Requisitos: `npm run bridge` corriendo y el corpus cargado (`npm run kb:upload`).
//   npm run verify:llm

import { MemorySaver } from '@langchain/langgraph'
import { loadAssistantConfig } from '../src/config/env.js'
import { createAssistant, runTurn, type AssistantProfile } from '../src/assistant/index.js'

const bridge = process.env.AWS_ENDPOINT_URL_BEDROCK_RUNTIME ?? 'http://127.0.0.1:8787'
try {
  const health = (await (await fetch(`${bridge}/health?deep=1`)).json()) as { upstream?: string; vectorStoreLoaded?: boolean; model?: string; detail?: string }
  if (health.upstream !== 'ok') throw new Error(health.detail ?? 'OpenAI no responde')
  console.log(`Puente OK · modelo ${health.model} · base de conocimiento ${health.vectorStoreLoaded ? 'cargada' : 'SIN CARGAR (npm run kb:upload)'}\n`)
} catch (error) {
  console.error(`✖ El puente no está disponible en ${bridge}: ${(error as Error).message}\n  Levántalo con: npm run bridge`)
  process.exit(1)
}

const finance: AssistantProfile = { name: 'María', campus: 'CMS', career: 'finance', currentSemester: 5, completedCourses: ['FIN-301'] }
const cases: { thread: string; message: string; profile?: AssistantProfile }[] = [
  { thread: 'ES', message: '¿Qué requisitos pide la Beca de Excelencia Académica BEA?', profile: finance },
  { thread: 'ES', message: '¿y la fecha límite?', profile: finance },
  { thread: 'EN', message: 'How do I apply for a scholarship?' },
  { thread: 'EN', message: 'Until when can I re-enroll?' },
]

const { graph } = createAssistant({ config: { ...loadAssistantConfig(), mode: 'llm', store: 'memory' }, checkpointer: new MemorySaver() })
for (const item of cases) {
  const started = performance.now()
  const reply = await runTurn(graph, { threadId: `verify-llm#${item.thread}`, message: item.message, profile: item.profile })
  const seconds = ((performance.now() - started) / 1000).toFixed(1)
  console.log(`[${item.thread}] "${item.message}"`)
  console.log(`   intent ${reply.intent} · ${reply.language} · generado por ${reply.generatedBy}${reply.degraded ? ' · DEGRADADO' : ''} · ${seconds} s`)
  console.log(reply.content.split('\n').map((line) => `   │ ${line}`).join('\n'))
  console.log(`   fuentes: ${reply.sources.map((s) => s.id).join(', ') || '(ninguna)'}\n`)
}
