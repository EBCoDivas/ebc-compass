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

test('Ana shares one enrollment number across her two moments and Banner tells them apart by semester', async () => {
  const { fixtureByEnrollment } = await import('./fixtures.js')
  assert.equal(demoAcademicSnapshots['ana-ingreso']?.enrollment, demoAcademicSnapshots.ana?.enrollment)
  const enrollment = demoAcademicSnapshots.ana!.enrollment
  assert.equal(fixtureByEnrollment(enrollment, 1)?.personaId, 'ana-ingreso')
  assert.equal(fixtureByEnrollment(enrollment, 7)?.personaId, 'ana')
  assert.equal(fixtureByEnrollment(enrollment, 3), null)
})
