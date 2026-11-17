import test from 'node:test'
import assert from 'node:assert/strict'
import { bedrockUsage } from './usage.js'

test('OpenAI cached input is subtracted once for Bedrock and cache writes remain unknown', () => {
  const usage = bedrockUsage({ prompt_tokens: 1200, completion_tokens: 50, total_tokens: 1250, prompt_tokens_details: { cached_tokens: 1024 } })
  assert.deepEqual(usage, { inputTokens: 176, outputTokens: 50, totalTokens: 1250, cacheReadInputTokens: 1024 })
  assert.equal('cacheWriteInputTokens' in usage, false)
  assert.equal('cacheReadInputTokens' in bedrockUsage({ prompt_tokens: 100, completion_tokens: 5, total_tokens: 105 }), false)
})

test('reported cache writes are separated from uncached input without counting twice', () => {
  const usage = bedrockUsage({ prompt_tokens: 2200, completion_tokens: 50, total_tokens: 2250, prompt_tokens_details: { cached_tokens: 1024, cache_write_tokens: 1024 } })
  assert.deepEqual(usage, { inputTokens: 152, outputTokens: 50, totalTokens: 2250, cacheReadInputTokens: 1024, cacheWriteInputTokens: 1024 })
})
