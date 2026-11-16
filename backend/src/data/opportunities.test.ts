import test from 'node:test'
import assert from 'node:assert/strict'
import { opportunities } from './opportunities.js'

test('catalog contains the six documented opportunity types', () => {
  const types = new Set(opportunities.map((item) => item.type))
  assert.equal(opportunities.length >= 20, true)
  assert.deepEqual([...types].sort(), ['career-opportunity', 'course', 'event', 'procedure', 'professional-development', 'scholarship'])
})

test('semester-restricted opportunities expose valid semester ranges', () => {
  for (const opportunity of opportunities) {
    assert.equal(opportunity.semester?.every((semester) => semester >= 1 && semester <= 10) ?? true, true)
  }
})
