import assert from 'node:assert/strict'
import test from 'node:test'
import { MemoryDocumentStore } from '../assistant/conversations/store.js'
import { studentPlanning } from '../data/studentPlanning.js'
import { readConfirmedStudentActions, studentActionKeys } from './confirmedActions.js'
import { evaluateScholarship, planningDate, projectSocialService, quoteEnrollmentPayment } from './rules.js'
import { buildStudentJourney } from './studentJourney.js'

const today = '2026-11-22'
const subject = 'ebc-student-entry'
const noActions = { scholarshipInReview: false, enrollmentPaymentGenerated: false }
const firstEntry = studentPlanning({ semester: 1, career: 'accounting', campus: 'QRO', personaId: 'ana-ingreso' })
const scholarship = firstEntry.catalog.find(item => item.id === 'scholarship-first-entry')!
const payment = firstEntry.catalog.find(item => item.id === 'procedure-first-enrollment-payment')!
const anaClosing = studentPlanning({ semester: 7, career: 'accounting', campus: 'QRO', personaId: 'ana' })

test('academic eligibility, missing documents and the last day to apply are distinct', () => {
  const original = firstEntry.firstEntry!
  assert.deepEqual(evaluateScholarship(scholarship, original, today), {
    status: 'eligible', missingDocuments: ['motivation-letter'], canSubmit: false,
  })
  assert.deepEqual(evaluateScholarship(scholarship, { ...original, highSchoolGpa: 8.5, motivationLetter: true }, '2026-11-26'), {
    status: 'eligible', missingDocuments: [], canSubmit: true,
  })
  assert.deepEqual(evaluateScholarship(scholarship, { ...original, highSchoolGpa: 8.49, admissionLetter: false }, today), {
    status: 'not-eligible', missingDocuments: ['admission-letter', 'motivation-letter'], canSubmit: false,
  })
  assert.equal(evaluateScholarship(scholarship, undefined, today)?.status, 'missing-data')
  assert.equal(evaluateScholarship(scholarship, original, '2026-11-27')?.status, 'closed')
  assert.equal(evaluateScholarship(undefined, original, today), undefined)
})

test('the payment quote uses the catalog, a stable reference per student and the campus date', () => {
  const beforeMidnight = planningDate(new Date('2026-12-02T05:59:59Z'))
  const afterMidnight = planningDate(new Date('2026-12-02T06:00:00Z'))
  const draft = quoteEnrollmentPayment(subject, payment, beforeMidnight, false)!
  assert.equal(draft.amount, 4800)
  assert.equal(draft.currency, 'MXN')
  assert.equal(draft.dueDate, '2026-12-01')
  assert.match(draft.reference, /^EBC-[A-F0-9]{16}$/)
  assert.equal(draft.canGenerate, true)
  assert.equal(quoteEnrollmentPayment(subject, payment, afterMidnight, false)?.canGenerate, false)
  const afterScholarship = quoteEnrollmentPayment(subject, payment, today, true)!
  assert.equal(afterScholarship.reference, draft.reference)
  assert.equal(afterScholarship.amount, draft.amount)
  assert.equal(afterScholarship.scholarshipInReview, true)
  assert.notEqual(quoteEnrollmentPayment('other-student', payment, today, true)?.reference, draft.reference)
  assert.notEqual(quoteEnrollmentPayment(subject, { ...payment, deadline: '2027-06-01' }, today, true)?.reference, draft.reference)
})

test('social service projections use the current pace, registered hours and the actual number of days left', () => {
  const progress = anaClosing.socialService!
  assert.deepEqual(projectSocialService(progress, today), { projectedHours: 303, shortfallHours: 177, onTrack: false })
  assert.deepEqual(projectSocialService({ ...progress, completedHours: 470, weeklyHours: 10 }, '2027-01-05'),
    { projectedHours: 480, shortfallHours: 0, onTrack: true })
  assert.deepEqual(projectSocialService(progress, '2027-01-13'), { projectedHours: 260, shortfallHours: 220, onTrack: false })
  assert.equal(projectSocialService({ ...progress, completedHours: 480, weeklyHours: 0 }, '2027-01-12').onTrack, true)
})

test('the route keeps required items first and uses the stage limit to fill remaining slots', () => {
  const stages = [
    { student: { semester: 1, career: 'accounting', campus: 'QRO' }, limit: 4 },
    { student: { semester: 5, career: 'marketing', campus: 'GDL' }, limit: 3 },
    { student: { semester: 7, career: 'accounting', campus: 'QRO' }, limit: 3 },
    { student: {}, limit: 1 },
  ]
  for (const { student, limit } of stages) {
    const planning = studentPlanning(student)
    const optional = Array.from({ length: 5 }, (_, index) => ({ ...planning.catalog[0], id: 'optional-' + index, deadline: '2026-11-22' }))
    const enriched = {
      ...planning, catalog: [...planning.catalog, ...optional],
      pending: [...planning.pending, ...optional.map(item => ({ opportunityId: item.id, dueDate: item.deadline, status: 'pending' as const }))],
    }
    const baseline = buildStudentJourney(planning, subject, noActions, today)
    const { route } = buildStudentJourney(enriched, subject, noActions, today)
    assert.equal(route.length, limit)
    assert.deepEqual(route.filter(item => item.required), baseline.route.filter(item => item.required))
    assert.deepEqual(route.slice().sort((a, b) => Number(b.required) - Number(a.required)), route)
    assert.ok(route.every(item => item.nextStep))
  }
  const complete = { ...firstEntry, pending: firstEntry.pending.map(item => ({ ...item, status: 'completed' as const })) }
  assert.deepEqual(buildStudentJourney(complete, subject, noActions, today).route, [])
})

test('only confirmed records owned by the student change the route and unlock action achievements', async () => {
  const store = new MemoryDocumentStore()
  await store.write('someone-else', [{ key: studentActionKeys.scholarship, value: { status: 'in-review', confirmedAt: today } }])
  await store.write(subject, [{ key: studentActionKeys.enrollmentPayment, value: { status: 'proposed', version: 0 } }])
  const before = buildStudentJourney(firstEntry, subject, await readConfirmedStudentActions(store, subject), today)
  assert.ok(before.achievements.every(item => !item.earned))
  assert.match(before.route.find(item => item.opportunityId === scholarship.id)!.nextStep, /carta de motivos/)

  await store.write(subject, [
    { key: studentActionKeys.scholarship, value: { status: 'in-review', confirmedAt: today } },
    { key: studentActionKeys.enrollmentPayment, value: { status: 'generated', confirmedAt: today, version: 1 }, version: 0 },
  ])
  const after = buildStudentJourney(firstEntry, subject, await readConfirmedStudentActions(store, subject), today)
  assert.deepEqual(after.achievements.filter(item => item.earned).map(item => item.id), ['scholarship-requested', 'payment-slip-generated'])
  assert.equal(after.route.find(item => item.opportunityId === scholarship.id)?.status, 'in-review')
  assert.equal(after.route.find(item => item.opportunityId === payment.id)?.status, 'in-progress')
})

test('the service achievement uses recorded hours and unlocks at half of the requirement', () => {
  const progress = anaClosing.socialService!
  for (const [hours, earned] of [[239, false], [240, true]] as const) {
    const planning = { ...anaClosing, socialService: { ...progress, completedHours: hours } }
    const journey = buildStudentJourney(planning, subject, noActions, today)
    assert.deepEqual(journey.achievements.filter(item => !item.earnedAt), [{ id: 'social-service-progress', earned }])
  }
})

test('achievements from an earlier stage stay visible, in order and without duplicates', () => {
  const journey = buildStudentJourney(anaClosing, subject, noActions, today)
  assert.deepEqual(journey.achievements, [
    { id: 'payment-slip-generated', earned: true, earnedAt: '2023-07-24' },
    { id: 'scholarship-requested', earned: true, earnedAt: '2023-08-04' },
    { id: 'social-service-progress', earned: true },
  ])
  const repeated = buildStudentJourney({ ...firstEntry, achievementHistory: [{ id: 'scholarship-requested', earnedAt: '2026-08-01' }] }, subject, noActions, today)
  assert.equal(repeated.achievements.filter(item => item.id === 'scholarship-requested').length, 1)
  assert.equal(firstEntry.achievementHistory, undefined)
})
