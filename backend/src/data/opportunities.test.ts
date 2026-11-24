import '../testing/seedCatalog.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogSeed } from '../banner/catalog/seed.js'

const opportunities = catalogSeed
const legacyOpportunities = catalogSeed.filter(item => item.collection === 'general')

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

test('recommendations respect each demo persona campus, level and period', async () => {
  const { readFileSync } = await import('node:fs')
  const { recommend } = await import('./recommendations.js')
  const { levelForCareer, campuses, programs } = await import('./academic.js')
  const academic = JSON.parse(readFileSync(new URL('../../../shared/academic.json', import.meta.url), 'utf8'))
  assert.deepEqual(campuses, academic.campuses)
  assert.deepEqual(programs, academic.programs)
  assert.equal(campuses.length, 14)
  assert.equal(programs.filter(program => program.level === 'licenciatura').length, 8)
  assert.equal(legacyOpportunities.length, 35)
  assert.equal(new Set(opportunities.map(item => item.id)).size, opportunities.length)
  assert.ok(opportunities.every(item => item.simulated))
  const personas = JSON.parse(readFileSync(new URL('../../../shared/personas.json', import.meta.url), 'utf8')) as {
    id: string; campus: string; career: string; period: number; interests: string[]; hasProfile: boolean
  }[]
  for (const persona of personas.filter(p => p.hasProfile)) {
    const results = recommend({ ...persona, semester: persona.period, today: new Date('2026-11-16T12:00:00Z') })
    assert.ok(results.length > 0, persona.id)
    assert.ok(results.some(({ opportunity }) => opportunity.type === 'course'), persona.id + ' course')
    for (const { opportunity } of results) {
      assert.ok(opportunity.career.includes(persona.career), persona.id)
      assert.ok(opportunity.campus.includes(persona.campus), persona.id)
      assert.ok(opportunity.level.includes(levelForCareer(persona.career)!), persona.id)
      assert.ok(!opportunity.semester || opportunity.semester.includes(persona.period), persona.id)
    }
  }
})

test('knowledge calendar references the catalog and the corpus has no operational dates or enrollments', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  const root = new URL('../../../knowledge/', import.meta.url)
  const calendar = readFileSync(new URL('calendario-academico.md', root), 'utf8')
  for (const item of legacyOpportunities.filter(item => item.deadline)) {
    assert.ok(calendar.includes('- ' + item.title + '.'), item.id)
  }
  const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8')) as { files: { path: string }[] }
  assert.deepEqual(manifest.files.map(file => file.path).sort(), readdirSync(root).filter(file => file.endsWith('.md')).sort())
  for (const file of manifest.files) {
    const content = readFileSync(new URL(file.path, root), 'utf8')
    assert.match(content, /^simulated: true$/m)
    assert.doesNotMatch(content, /\b(?:\d{2}\/\d{2}\/20\d{2}|20\d{2}-\d{2}-\d{2}|M\d{7})\b/, file.path)
  }
})
