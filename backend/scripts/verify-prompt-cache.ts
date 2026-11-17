// Local measurements only: five model calls, no student records, no vector-store writes.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { MemorySaver } from '@langchain/langgraph'
import { loadAssistantConfig } from '../src/config/env.js'
import { buildAssistantGraph, runTurn } from '../src/assistant/graph/assistantGraph.js'
import { InMemoryCatalog, CatalogDates, ProfileRecommendations } from '../src/assistant/adapters/catalog.js'
import { KeywordRetriever } from '../src/assistant/adapters/retrievers.js'
import { BedrockLlmProvider } from '../src/assistant/adapters/bedrockLlm.js'
import type { LlmInput, LlmUsage, PromptCacheMode } from '../src/assistant/types.js'

const endpoint = process.env.AWS_ENDPOINT_URL_BEDROCK_RUNTIME
if (!endpoint || !['127.0.0.1', 'localhost'].includes(new URL(endpoint).hostname)) throw new Error('Esta verificación requiere el puente local. No se ejecuta contra AWS real.')
const config = loadAssistantConfig()
const health = await (await fetch(new URL('/health', endpoint))).json() as { model: string; reasoningEffort: string }
const rows: { label: string; usage: LlmUsage }[] = []
const provider = (mode: PromptCacheMode) => new BedrockLlmProvider({ modelId: config.bedrockModelId, region: config.region, cacheMode: mode })
const catalog = new InMemoryCatalog()
const graph = buildAssistantGraph({ catalog, dates: new CatalogDates(catalog), recommendations: new ProfileRecommendations(catalog),
  retriever: new KeywordRetriever(config.knowledgeDir), llm: provider('off'), now: () => new Date('2026-11-16T12:00:00Z') }, new MemorySaver())
const baseline = await runTurn(graph, { threadId: 'prompt-cache-benchmark', message: '¿Qué becas hay disponibles? Explica sus diferencias.',
  profile: { name: 'Estudiante demo', career: 'finance', campus: 'CDMX', currentSemester: 2 } })
assert.ok(baseline.usage, 'El proveedor debe devolver métricas reales')
rows.push({ label: 'baseline-off', usage: baseline.usage })
const prompt = (await graph.getState({ configurable: { thread_id: 'prompt-cache-benchmark' } })).values.prompt as Pick<LlmInput, 'system' | 'messages'>

async function measure(label: string, mode: PromptCacheMode, input: typeof prompt, stream = true) {
  let usage: LlmUsage | undefined
  const request = { ...input, timeoutMs: 60000, onUsage: (value: LlmUsage) => { usage = value } }
  if (stream) { for await (const _chunk of provider(mode).stream(request)) { /* consume to receive final usage */ } }
  else await provider(mode).generate(request)
  assert.ok(usage, 'No se recibieron métricas del proveedor')
  rows.push({ label, usage })
}

await measure('repeat-off', 'off', prompt)
await measure('after-system', 'system', prompt)
await measure('repeat-system', 'system', prompt)
// Includes a tiny question and message framing: an upper bound for the static system prefix.
await measure('system-prefix-upper-bound', 'off', { system: prompt.system, messages: [{ role: 'user', content: 'Responde solamente: OK.' }] }, false)
const report = { createdAt: new Date().toISOString(), scope: 'local-openai-automatic-cache',
  provider: { backendModelId: config.bedrockModelId, bridgeModel: health.model, reasoningEffort: health.reasoningEffort },
  promptHash: createHash('sha256').update(JSON.stringify(prompt)).digest('hex'), systemCharacters: prompt.system.length,
  note: 'Identical prompt for before/after. The bridge translates checkpoints on supported OpenAI models; cache hits are best effort. No claimed Bedrock or monetary savings.', rows }
const directory = new URL('../../local/.state/', import.meta.url)
mkdirSync(directory, { recursive: true })
writeFileSync(new URL('prompt-cache-report.json', directory), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 })
console.table(rows.map(({ label, usage }) => ({ label, totalInput: usage.totalInputTokens, uncached: usage.inputTokens, read: usage.cacheReadInputTokens ?? 'unknown', write: usage.cacheWriteInputTokens ?? 'unknown', output: usage.outputTokens, latencyMs: usage.latencyMs, firstTokenMs: usage.firstTokenMs ?? 'n/a' })))
console.log('✔ Medición guardada en local/.state/prompt-cache-report.json (solo métricas).')
