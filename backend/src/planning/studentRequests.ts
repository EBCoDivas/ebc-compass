import type { BannerActionState } from '../../../shared/contracts/studentActions.js'
import type { StudentRequest } from '../../../shared/contracts/studentRequests.js'
import type { BannerRecord } from '../banner/fixtures.js'
import { planningDate } from './rules.js'

const SCHOLARSHIP = { title: 'Beca de primer ingreso', owner: 'Servicios Escolares · Becas' }
const PAYMENT = { title: 'Pago de inscripción', owner: 'Servicios Escolares · Pagos' }
const RESPONSE_DAYS = 5

/** Suma días hábiles (sin sábado ni domingo) a una fecha aaaa-mm-dd. */
export function addBusinessDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const current = new Date(Date.UTC(year, month - 1, day))
  for (let added = 0; added < days;) {
    current.setUTCDate(current.getUTCDate() + 1)
    if (current.getUTCDay() !== 0 && current.getUTCDay() !== 6) added++
  }
  return current.toISOString().slice(0, 10)
}

const dayOf = (iso: string) => planningDate(new Date(iso))

/**
 * Las solicitudes del alumno salen de lo que Banner registra: lo que confirmó en Compass (beca y pago de inscripción)
 * y las solicitudes de semestres anteriores que ya están resueltas.
 */
export function buildStudentRequests(record: BannerRecord | null, actions: BannerActionState): StudentRequest[] {
  const requests: StudentRequest[] = []

  const scholarship = actions.scholarship
  if (scholarship) {
    const submittedAt = dayOf(scholarship.confirmedAt)
    requests.push({
      id: 'scholarship-current', kind: 'scholarship', ...SCHOLARSHIP, folio: scholarship.folio ?? 'BEC-' + submittedAt.slice(2, 4) + '-0001',
      status: 'in-review', submittedAt, estimatedResponse: addBusinessDays(submittedAt, RESPONSE_DAYS),
      detail: scholarship.motivationLetter ? `Carta de motivos: ${scholarship.motivationLetter.name}` : undefined,
      steps: [{ label: 'Enviada', at: submittedAt, done: true }, { label: 'En revisión', at: submittedAt, done: true }, { label: 'Resuelta', done: false }],
    })
  }

  const payment = actions.payment
  if (payment) {
    const paidAt = dayOf(payment.confirmedAt)
    const card = payment.paymentMethod ? `${payment.paymentMethod.brand} •••• ${payment.paymentMethod.last4}` : undefined
    requests.push({
      id: 'payment-current', kind: 'enrollment-payment', ...PAYMENT, folio: payment.payment.reference, status: 'resolved', outcome: 'Pagada',
      submittedAt: paidAt, resolvedAt: paidAt, detail: card ? `Pagado con ${card}` : undefined,
      steps: [{ label: 'Enviada', at: paidAt, done: true }, { label: 'Pagada', at: paidAt, done: true }],
    })
  }

  for (const item of record?.requestHistory ?? []) {
    const info = item.kind === 'scholarship' ? SCHOLARSHIP : PAYMENT
    const steps = item.kind === 'scholarship'
      ? [{ label: 'Enviada', at: item.submittedAt, done: true }, { label: 'En revisión', at: item.submittedAt, done: true }, { label: item.outcome, at: item.resolvedAt, done: true }]
      : [{ label: 'Enviada', at: item.submittedAt, done: true }, { label: item.outcome, at: item.resolvedAt, done: true }]
    requests.push({ id: `${item.kind}-${item.folio}`, kind: item.kind, ...info, folio: item.folio, status: 'resolved', outcome: item.outcome,
      submittedAt: item.submittedAt, resolvedAt: item.resolvedAt, steps })
  }

  return requests.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || a.id.localeCompare(b.id))
}
