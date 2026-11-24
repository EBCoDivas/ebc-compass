import assert from 'node:assert/strict'
import { test } from 'node:test'
import { demoAcademicSnapshots } from './fixtures.js'
import { completedCourses } from './curriculum.js'

test('every demo expediente lists exactly the courses its count says it completed', () => {
  for (const [personaId, record] of Object.entries(demoAcademicSnapshots)) {
    if (!record) continue
    assert.equal(record.completedCourses?.length ?? 0, record.courses?.completed ?? 0, personaId)
    assert.ok(record.fullName.length > 0, personaId)
    const semesters = (record.courses?.completed ?? 0) / 6
    assert.ok(semesters < record.currentPeriod.number, 'solo cursó semestres anteriores al actual: ' + personaId)
  }
  assert.deepEqual(demoAcademicSnapshots['ana-ingreso']?.completedCourses, [])
  assert.equal(demoAcademicSnapshots.ana?.completedCourses?.[35].code, 'CON-606')
  assert.equal(demoAcademicSnapshots.sofia?.completedCourses?.length, 48)
  assert.deepEqual(completedCourses('unknown', 3), [])
})
