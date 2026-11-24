import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { BedrockLlmProvider } from './assistant/adapters/bedrockLlm.js'
import { effectiveCacheMode } from './assistant/adapters/promptCache.js'
import { normalizeUsage } from './assistant/adapters/llmUsage.js'
import { loadAssistantConfig } from './config/env.js'
import type { LlmUsage } from './assistant/types.js'

test('prompt caching defaults to the stable system prefix and unknown models never receive explicit checkpoints', () => {
  assert.equal(loadAssistantConfig({}).promptCacheMode, 'system')
  assert.throws(() => loadAssistantConfig({ ASSISTANT_PROMPT_CACHE: 'typo' }))
  assert.equal(effectiveCacheMode('us.amazon.nova-lite-v1:0', 'system-history'), 'system-history')
  assert.equal(effectiveCacheMode('anthropic.claude-3-haiku-20240307-v1:0', 'system'), 'off')
  assert.equal(effectiveCacheMode('custom-model', 'system-history'), 'off')
})

test('cache accounting separates uncached input from reads and writes without inventing metrics', () => {
  const result = normalizeUsage({ input_tokens: 175, output_tokens: 5, total_tokens: 180, input_token_details: { cache_read: 50, cache_creation: 25 } }, { latencyMs: 100 }, 'system')
  assert.equal(result.inputTokens, 100)
  assert.equal(result.totalInputTokens, 175)
  assert.equal(result.cacheReadInputTokens, 50)
  assert.equal(result.cacheWriteInputTokens, 25)
  const absent = normalizeUsage({ input_tokens: 10, output_tokens: 2, total_tokens: 12 }, { latencyMs: 100 }, 'off')
  assert.equal(absent.cacheReadInputTokens, undefined)
  assert.equal(absent.cacheWriteInputTokens, undefined)
})

test('real SDK serializes checkpoints before variable data and reports usage without double counting', async t => {
  const requests: { system: unknown[]; messages: { content: unknown[] }[] }[] = []
  const server = createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk
    requests.push(JSON.parse(body))
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ output: { message: { role: 'assistant', content: [{ text: 'Consulta Servicios Escolares.' }] } }, stopReason: 'end_turn',
      usage: { inputTokens: 100, cacheReadInputTokens: 50, cacheWriteInputTokens: 25, outputTokens: 5, totalTokens: 180 } }))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const client = new BedrockRuntimeClient({ region: 'us-east-1', requestHandler: new NodeHttpHandler(), endpoint: 'http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' } })
  t.after(() => { client.destroy(); server.closeAllConnections(); server.close() })
  const provider = new BedrockLlmProvider({ modelId: 'amazon.nova-lite-v1:0', region: 'us-east-1', cacheMode: 'system-history', client })
  let usage: LlmUsage | undefined
  await provider.generate({ system: 'Instrucciones estables.', messages: [
    { role: 'user', content: 'Pregunta anterior.' }, { role: 'assistant', content: 'Respuesta anterior.' }, { role: 'user', content: 'Datos variables.' },
  ], timeoutMs: 2000, onUsage: value => { usage = value } })
  assert.deepEqual(requests[0].system[1], { cachePoint: { type: 'default' } })
  assert.deepEqual(requests[0].system.at(-1), { text: 'Idioma de la respuesta: español. No menciones ni repitas esta indicación.' })
  assert.deepEqual(requests[0].messages[1].content.at(-1), { cachePoint: { type: 'default' } })
  assert.deepEqual(requests[0].messages[2].content, [{ text: 'Datos variables.' }])
  assert.equal(usage?.inputTokens, 100)
  assert.equal(usage?.totalInputTokens, 175)
  assert.equal(usage?.totalTokens, 180)
})
