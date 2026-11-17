import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemorySaver } from '@langchain/langgraph'
import { buildAssistantGraph, runTurn } from './assistant/graph/assistantGraph.js'
import { loadSystemPrompt } from './assistant/domain/systemPrompt.js'
import { converseMessages } from './assistant/adapters/promptCache.js'
import { InMemoryCatalog, CatalogDates, ProfileRecommendations } from './assistant/adapters/catalog.js'

test('the shared Spanish Markdown prompt is available and missing assets fail at initialization', () => {
  const prompt = loadSystemPrompt()
  assert.match(prompt, /Responde en inglés/)
  assert.doesNotMatch(prompt, /\bdemo\b|datos simulados|\bMVP\b/i)
  assert.throws(() => loadSystemPrompt('/missing-assistant-prompts'))
})

test('a graph loads one prompt once and passes the response language separately', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'compass-prompts-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  writeFileSync(join(directory, 'assistant.md'), 'Sistema en español.')
  const catalog = new InMemoryCatalog()
  const seen: string[] = []
  const graph = buildAssistantGraph({ systemPromptsDir: directory, catalog, dates: new CatalogDates(catalog), recommendations: new ProfileRecommendations(catalog),
    llm: { generate: async input => {
      seen.push(input.system)
      return input.language === 'en' ? 'Please visit Academic Services.' : 'Consulta Servicios Escolares.'
    } } }, new MemorySaver())
  // Removing the files after initialization proves turns do not read them again.
  rmSync(directory, { recursive: true })
  const es = await runTurn(graph, { threadId: 'language', message: '¿Qué becas hay?' })
  const en = await runTurn(graph, { threadId: 'language', message: 'Which scholarships are available?' })
  const explicit = await runTurn(graph, { threadId: 'language', message: 'Which scholarships are available?', language: 'es' })
  assert.equal(es.language, 'es')
  assert.equal(en.language, 'en')
  assert.equal(explicit.language, 'es')
  assert.deepEqual(seen, ['Sistema en español.', 'Sistema en español.', 'Sistema en español.'])
  for (const reply of [es, en, explicit]) assert.equal(reply.failure, undefined)
})

test('the language directive follows the cache checkpoint and does not change the reusable system prefix', () => {
  const input = { system: 'Sistema estable.', messages: [{ role: 'user' as const, content: 'Pregunta.' }] }
  const es = converseMessages({ ...input, language: 'es' }, 'system')
  const en = converseMessages({ ...input, language: 'en' }, 'system')
  assert.deepEqual(es[0].content, en[0].content)
  assert.deepEqual(es[0].content, [{ type: 'text', text: 'Sistema estable.' }, { type: 'cache_point', cachePoint: { type: 'default' } }])
  assert.equal(es[1].content, 'Responde en español.')
  assert.equal(en[1].content, 'Responde en inglés.')
})
