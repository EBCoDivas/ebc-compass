import assert from 'node:assert/strict'
import { test } from 'node:test'
import { modelDisplayName } from './modelName.js'

test('modelDisplayName convierte identificadores en nombres legibles', () => {
  assert.equal(modelDisplayName('us.amazon.nova-2-lite-v1:0'), 'Nova 2 Lite')
  assert.equal(modelDisplayName('us.openai.gpt-5.5'), 'GPT-5.5')
  assert.equal(modelDisplayName('us.openai.gpt-6-sol'), 'GPT-6 Sol')
  assert.equal(modelDisplayName('openai.gpt-oss-120b-1:0'), 'GPT-OSS 120b')
  assert.equal(modelDisplayName('gpt-6-luna'), 'GPT-6 Luna')
  assert.equal(modelDisplayName('local-lunna'), 'Lunna')
  assert.equal(modelDisplayName(undefined), undefined)
})
