import type { DocumentStore } from '../assistant/conversations/store.js'

export const studentActionKeys = {
  scholarship: 'ACTION#scholarship-first-entry',
  enrollmentPayment: 'ACTION#enrollment-payment-slip',
} as const

export interface ConfirmedStudentActions {
  scholarshipInReview: boolean
  enrollmentPaymentGenerated: boolean
}

export async function readConfirmedStudentActions(store: Pick<DocumentStore, 'get'>, subject: string): Promise<ConfirmedStudentActions> {
  const [scholarship, payment] = await Promise.all([
    store.get(subject, studentActionKeys.scholarship),
    store.get(subject, studentActionKeys.enrollmentPayment),
  ])
  return {
    scholarshipInReview: scholarship?.status === 'in-review' && typeof scholarship.confirmedAt === 'string' && !!scholarship.confirmedAt,
    enrollmentPaymentGenerated: payment?.status === 'generated' && typeof payment.confirmedAt === 'string' && !!payment.confirmedAt,
  }
}
