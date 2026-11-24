import './testing/seedCatalog.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { recommend } from './data/recommendations.js'
import type { Opportunity } from './data/opportunities.js'

test('a lower ranked category survives more than ten higher ranked opportunities', () => {
  const base: Opportunity = { id: 'base', title: 'Finanzas', description: 'Curso de finanzas', type: 'course', stage: 'all', career: ['finance'], campus: ['CDMX'], level: ['licenciatura'], simulated: true }
  const courses = Array.from({ length: 12 }, (_, index) => ({ ...base, id: `course-${index}` }))
  const scholarship: Opportunity = { ...base, id: 'scholarship', type: 'scholarship', title: 'Beca', description: 'Apoyo académico' }
  const results = recommend({ career: 'finance', campus: 'CDMX', interests: ['finanzas'] }, [...courses, scholarship])
  assert.equal(results.length, 13)
  assert.equal(results.at(-1)?.opportunity.id, 'scholarship')
  assert.equal(results.filter(item => item.opportunity.type === 'course')[0]?.opportunity.id, 'course-0')
  assert.equal(results.filter(item => item.opportunity.type === 'scholarship')[0]?.opportunity.id, 'scholarship')
})
