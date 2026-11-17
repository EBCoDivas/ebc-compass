import test from 'node:test'
import assert from 'node:assert/strict'
import { openAiPrompt } from './prompt.js'

const body = {
  system: [{ text: 'Instrucciones estables.' }, { cachePoint: { type: 'default' } }, { text: 'Responde en inglés.' }],
  messages: [{ role: 'user' as const, content: [{ text: 'Pregunta variable.' }] }],
}

test('GPT-6 receives an explicit system boundary without caching variable student data', () => {
  const prompt = openAiPrompt(body, 'gpt-6-luna')
  assert.deepEqual(prompt.prompt_cache_options, { mode: 'explicit', ttl: '30m' })
  assert.deepEqual(prompt.messages, [
    { role: 'system', content: [{ type: 'text', text: 'Instrucciones estables.', prompt_cache_breakpoint: { mode: 'explicit' } }, { type: 'text', text: 'Responde en inglés.' }] },
    { role: 'user', content: [{ type: 'text', text: 'Pregunta variable.' }] },
  ])
})

test('older or unknown models do not receive unsupported cache parameters', () => {
  for (const model of ['gpt-4o-mini', 'gpt-5.4', 'unknown-model']) {
    const prompt = openAiPrompt(body, model)
    assert.equal(prompt.prompt_cache_options, undefined)
    assert.ok(!JSON.stringify(prompt.messages).includes('prompt_cache_breakpoint'))
  }
})
