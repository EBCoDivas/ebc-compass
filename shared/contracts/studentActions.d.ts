import type { EnrollmentPaymentQuote } from './studentPlanning.js'

export interface PaymentMethod { brand: string; last4: string; holder: string; expires: string }
export interface MotivationLetterUpload { name: string; contentBase64: string }
export type StudentActionKind = 'request-scholarship' | 'pay-enrollment' | 'generate-enrollment-slip'
export type BannerActionKind = Exclude<StudentActionKind, 'generate-enrollment-slip'>

type Scholarship = { kind: 'request-scholarship'; dueDate: string }
type PaymentKind = 'pay-enrollment' | 'generate-enrollment-slip'
type Payment<K extends PaymentKind> = { kind: K; payment: Omit<EnrollmentPaymentQuote, 'canPay'> }
type PaidWith = { paymentMethod?: Pick<PaymentMethod, 'brand' | 'last4'> }
type ProposalId = { id: string; conversationId: string }
type ScholarshipProposal = Scholarship & ProposalId & { requiresMotivationLetter?: true }
type PaymentProposal<K extends PaymentKind> = { kind: K; paymentMethod?: PaymentMethod; payment: Omit<EnrollmentPaymentQuote, 'canPay' | 'reference'>; requiresMotivationLetter?: never } & ProposalId

export type BannerActionProposal = ScholarshipProposal | PaymentProposal<'pay-enrollment'>
export type ActionProposal = BannerActionProposal | PaymentProposal<'generate-enrollment-slip'>
export type ActionReceipt = (
  | (Scholarship & { status?: 'in-review'; motivationLetter?: { name: string; size: number } })
  | (Payment<'pay-enrollment'> & PaidWith & { status: 'paid' })
  | Payment<'generate-enrollment-slip'>
) & { confirmedAt: string }

export interface BannerActionState {
  scholarship?: Extract<ActionReceipt, { kind: 'request-scholarship' }>
  payment?: Extract<ActionReceipt, { kind: 'pay-enrollment' }>
}
