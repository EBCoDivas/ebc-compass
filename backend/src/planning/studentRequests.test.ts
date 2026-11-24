import '../testing/seedCatalog.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { demoAcademicSnapshots } from '../banner/fixtures.js'
import { addBusinessDays, buildStudentRequests } from './studentRequests.js'

const receipt = (confirmedAt: string) => ({
  scholarship: { kind: 'request-scholarship' as const, status: 'in-review' as const, dueDate: '2026-11-26', confirmedAt, folio: 'BEC-26-3FA2', motivationLetter: { name: 'carta.pdf', size: 1700 } },
  payment: { kind: 'pay-enrollment' as const, status: 'paid' as const, confirmedAt, payment: { amount: 4800, currency: 'MXN' as const, dueDate: '2026-12-01', reference: 'EBC-ABC123' }, paymentMethod: { brand: 'Visa', last4: '4242' } },
})

test('business days skip weekends', () => {
  assert.equal(addBusinessDays('2026-11-23', 5), '2026-11-30') // lunes + 5 hábiles = lunes siguiente
  assert.equal(addBusinessDays('2026-11-27', 1), '2026-11-30') // viernes + 1 = lunes
})

test('a scholarship in review shows its folio, owner, steps and the estimated answer', () => {
  const [request] = buildStudentRequests(null, { scholarship: receipt('2026-11-23T18:00:00.000Z').scholarship })
  assert.equal(request.kind, 'scholarship')
  assert.equal(request.folio, 'BEC-26-3FA2')
  assert.equal(request.owner, 'Servicios Escolares · Becas')
  assert.equal(request.status, 'in-review')
  assert.equal(request.estimatedResponse, '2026-11-30')
  assert.deepEqual(request.steps.map(step => [step.label, step.done]), [['Enviada', true], ['En revisión', true], ['Resuelta', false]])
  assert.equal(request.detail, 'Carta de motivos: carta.pdf')
})

test('a paid enrollment is already resolved and its folio is the receipt', () => {
  const [request] = buildStudentRequests(null, { payment: receipt('2026-11-23T18:00:00.000Z').payment })
  assert.equal(request.status, 'resolved')
  assert.equal(request.outcome, 'Pagada')
  assert.equal(request.folio, 'EBC-ABC123')
  assert.equal(request.detail, 'Pagado con Visa •••• 4242')
})

test('Ana in 7th semester has her first-semester requests already resolved, newest first', () => {
  const requests = buildStudentRequests(demoAcademicSnapshots.ana, {})
  assert.deepEqual(requests.map(request => [request.kind, request.status, request.outcome]), [['scholarship', 'resolved', 'Aprobada'], ['enrollment-payment', 'resolved', 'Pagada']])
  assert.equal(requests[0].resolvedAt, '2023-08-29')
  assert.ok(requests[0].steps.every(step => step.done))
})

test('students with nothing requested get an empty list, and current requests come before history', () => {
  assert.deepEqual(buildStudentRequests(demoAcademicSnapshots.diego, {}), [])
  const mixed = buildStudentRequests(demoAcademicSnapshots.ana, { scholarship: receipt('2026-11-23T18:00:00.000Z').scholarship })
  assert.equal(mixed[0].id, 'scholarship-current')
  assert.equal(mixed.length, 3)
})
