import type { ActionProposal, ActionReceipt, BannerActionKind, MotivationLetterUpload } from '../../../shared/contracts/studentActions.js'
import type { ConversationRepository } from '../assistant/conversations/repository.js'
import { enrollmentActionIds, type BannerActionErrorCode } from '../banner/actions.js'
import type { BannerClient } from '../banner/reader.js'
import { readConfirmedStudentActions, studentActionKeys } from './confirmedActions.js'
import { readStudentJourney, type StudentContext } from './readStudentJourney.js'
import { planningDate } from './rules.js'

export const actionOpportunity = {
  'request-scholarship': enrollmentActionIds.scholarship,
  'pay-enrollment': enrollmentActionIds.payment,
} as const satisfies Record<BannerActionKind, string>

const asAcademicStudent = (student: StudentContext) => ({ ...student, id: student.subject })

class ActionError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message) }
}

const errorMessages: Record<BannerActionErrorCode, string> = {
  ACTION_UNAVAILABLE: 'Consulta con Servicios Escolares cómo continuar con ese trámite.',
  ACTION_CHANGED: 'Los datos del trámite cambiaron. Pide al asistente que lo prepare de nuevo.',
  ACTION_PENDING: 'El trámite se está actualizando. Vuelve a intentar la confirmación.',
  MOTIVATION_LETTER_REQUIRED: 'Sube tu carta de motivos antes de confirmar.',
  INVALID_LETTER: 'No pudimos leer tu carta. Súbela en PDF o Word (.docx) de hasta 1.5 MB.',
}

export class StudentActions {
  constructor(private readonly repo: ConversationRepository, private readonly banner: BannerClient, private readonly now = () => new Date()) {}

  async prepare(student: StudentContext, kind: BannerActionKind) {
    const journey = await readStudentJourney(student, this.banner, this.repo.store, planningDate(this.now()))
    if (journey.stage !== 'entry' || !journey.firstEntry) return
    const pending = journey.pending.find(item => item.opportunityId === actionOpportunity[kind])
    if (kind === 'request-scholarship') {
      const eligibility = journey.calculations.scholarship
      if (pending?.status !== 'pending' || eligibility?.status !== 'eligible' || eligibility.missingDocuments.includes('admission-letter')) return
      return { kind, dueDate: pending.dueDate,
        ...(eligibility.missingDocuments.includes('motivation-letter') ? { requiresMotivationLetter: true as const } : {}) }
    }
    const quote = journey.calculations.enrollmentPayment
    const paymentMethod = (await this.banner.readRecord(asAcademicStudent(student)))?.paymentMethod
    if (quote?.canPay && paymentMethod && (pending?.status === 'pending' || pending?.status === 'in-progress')) {
      const { amount, currency, dueDate } = quote
      return { kind, payment: { amount, currency, dueDate }, paymentMethod }
    }
  }

  private async proposal(student: StudentContext, conversationId: string, id: string): Promise<ActionProposal> {
    await this.repo.require(student.subject, conversationId)
    const { reply } = await this.repo.turn(student.subject, conversationId, id) ?? {}
    const proposal = reply?.actionProposal
    if (!proposal || reply?.inputBlock || reply?.failure || reply?.interrupted || proposal.id !== id || proposal.conversationId !== conversationId) {
      throw new ActionError(404, 'ACTION_NOT_FOUND', 'No encontramos esa propuesta. Pide al asistente que la prepare de nuevo.')
    }
    return proposal
  }

  private async legacyReceipt(student: StudentContext, kind: 'request-scholarship' | 'generate-enrollment-slip') {
    const key = kind === 'request-scholarship' ? studentActionKeys.scholarship : studentActionKeys.enrollmentPayment
    const record = await this.repo.store.get(student.subject, key)
    const receipt = record?.receipt as ActionReceipt | undefined
    return receipt?.kind === kind ? receipt : null
  }

  async confirmedPayment(student: StudentContext) {
    return (await this.banner.readActions(asAcademicStudent(student))).payment?.payment
  }

  async status(student: StudentContext, conversationId: string, id: string): Promise<ActionReceipt | null> {
    const proposal = await this.proposal(student, conversationId, id)
    if (proposal.kind === 'generate-enrollment-slip') return this.legacyReceipt(student, proposal.kind)
    const actions = await this.banner.readActions(asAcademicStudent(student))
    return proposal.kind === 'request-scholarship'
      ? actions.scholarship ?? await this.legacyReceipt(student, proposal.kind)
      : actions.payment ?? null
  }

  async confirm(student: StudentContext, conversationId: string, id: string, motivationLetter?: MotivationLetterUpload): Promise<ActionReceipt> {
    const proposal = await this.proposal(student, conversationId, id)
    if (proposal.kind === 'generate-enrollment-slip') {
      const receipt = await this.legacyReceipt(student, proposal.kind)
      if (receipt) return receipt
      throw new ActionError(409, 'ACTION_CHANGED', 'Pide al asistente que prepare el pago de inscripción.')
    }
    if (proposal.kind === 'request-scholarship' && (await readConfirmedStudentActions(this.repo.store, student.subject)).scholarshipInReview) {
      const receipt = await this.legacyReceipt(student, proposal.kind)
      if (receipt) return receipt
      throw new ActionError(409, 'ACTION_UNAVAILABLE', 'Tu solicitud ya está en revisión. Consulta su estado con Servicios Escolares.')
    }
    const result = await this.banner.confirmAction(asAcademicStudent(student), { proposal, motivationLetter })
    if (!result.ok) throw new ActionError(409, result.code, errorMessages[result.code])
    return result.receipt
  }
}
