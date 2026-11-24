import { createHash } from 'node:crypto'
import type { ActionReceipt, BannerActionProposal, BannerActionState, MotivationLetterUpload } from '../../../shared/contracts/studentActions.js'
import type { DocumentStore, Value } from '../assistant/conversations/store.js'
import { Conflict, MemoryDocumentStore } from '../assistant/conversations/store.js'
import { createCatalogStore, type CatalogStore } from './catalog/store.js'
import { evaluateScholarship, planningDate, quoteEnrollmentPayment } from '../planning/rules.js'
import { fixtureByEnrollment } from './fixtures.js'

export const LOCAL_BANNER_ACTIONS_TABLE = 'BannerActions'
export const enrollmentActionIds = { scholarship: 'scholarship-first-entry', payment: 'procedure-first-enrollment-payment' } as const

export type BannerIdentity = { subject: string; enrollment: string; personaId: string; campus: string; career: string; semester: number }
export type BannerConfirmation = { proposal: BannerActionProposal; motivationLetter?: MotivationLetterUpload }
export const MAX_LETTER_BYTES = 1_500_000
const letterFormats = [{ ext: '.pdf', magic: '%PDF-' }, { ext: '.docx', magic: 'PK' }]

/** Banner no confía en el navegador: revisa el nombre, el tamaño y que el contenido corresponda a un PDF o Word. */
export function inspectLetter(upload: MotivationLetterUpload | undefined) {
  if (!upload || typeof upload.name !== 'string' || typeof upload.contentBase64 !== 'string' || upload.name.length > 120) return
  const format = letterFormats.find(item => upload.name.toLowerCase().endsWith(item.ext))
  const content = Buffer.from(upload.contentBase64, 'base64')
  if (!format || content.length < 100 || content.length > MAX_LETTER_BYTES || content.subarray(0, format.magic.length).toString('latin1') !== format.magic) return
  return { name: upload.name.replace(/[\u0000-\u001f\\/]/g, '_'), size: content.length, sha256: createHash('sha256').update(content).digest('hex') }
}
export type BannerActionErrorCode = 'ACTION_UNAVAILABLE' | 'ACTION_CHANGED' | 'MOTIVATION_LETTER_REQUIRED' | 'INVALID_LETTER' | 'ACTION_PENDING'
export type BannerConfirmationResult = { ok: true; receipt: ActionReceipt } | { ok: false; code: BannerActionErrorCode }

export type BannerActionRequest =
  | { version: 1; operation: 'getEnrollmentActions'; identity: BannerIdentity }
  | ({ version: 1; operation: 'confirmEnrollmentAction'; identity: BannerIdentity } & BannerConfirmation)

const unavailable = { ok: false, code: 'ACTION_UNAVAILABLE' } as const
const changed = { ok: false, code: 'ACTION_CHANGED' } as const
type SavedState = BannerActionState & { version: number }

function canonicalRecord(identity: BannerIdentity) {
  const record = fixtureByEnrollment(identity.enrollment, identity.semester)
  return record && record.firstEntry && record.personaId === identity.personaId && record.campus === identity.campus
    && record.career === identity.career && record.currentPeriod.number === identity.semester && identity.semester === 1 ? record : undefined
}

export function createBannerActionHandler(store: Pick<DocumentStore, 'get' | 'write'>, now = () => new Date(),
  catalog: Pick<CatalogStore, 'list'> = createCatalogStore(new MemoryDocumentStore())) {
  return async (request: BannerActionRequest): Promise<{ actions: BannerActionState } | BannerConfirmationResult> => {
    const { identity } = request
    const record = canonicalRecord(identity)
    if (!record) return request.operation === 'getEnrollmentActions' ? { actions: {} } : unavailable

    const key = 'ENROLLMENT#' + identity.enrollment
    const read = () => store.get(identity.subject, key) as Promise<SavedState | undefined>
    if (request.operation === 'getEnrollmentActions') {
      const state = await read()
      return { actions: { scholarship: state?.scholarship, payment: state?.payment } }
    }

    const { proposal } = request
    const scholarship = proposal.kind === 'request-scholarship'
    const slot = scholarship ? 'scholarship' : 'payment'
    // Las fechas, tarifas y requisitos salen del catálogo que Banner guarda en DynamoDB.
    const opportunity = (await catalog.list()).find(item => item.id === enrollmentActionIds[slot])
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = await read()
      const existing = current?.[slot]
      if (existing) return { ok: true, receipt: existing }

      const stamp = now()
      const today = planningDate(stamp)
      const confirmedAt = stamp.toISOString()
      let letter: ReturnType<typeof inspectLetter>
      let receipt: ActionReceipt
      if (scholarship) {
        const eligibility = evaluateScholarship(opportunity, record.firstEntry, today)
        if (eligibility?.status !== 'eligible' || !opportunity?.deadline || eligibility.missingDocuments.includes('admission-letter')) return unavailable
        if (opportunity.deadline !== proposal.dueDate) return changed
        if (eligibility.missingDocuments.includes('motivation-letter')) {
          if (!request.motivationLetter) return { ok: false, code: 'MOTIVATION_LETTER_REQUIRED' }
          letter = inspectLetter(request.motivationLetter)
          if (!letter) return { ok: false, code: 'INVALID_LETTER' }
        }
        const folio = 'BEC-' + String(stamp.getFullYear()).slice(2) + '-' + createHash('sha256').update(identity.subject + proposal.id).digest('hex').slice(0, 4).toUpperCase()
        receipt = { kind: proposal.kind, status: 'in-review', dueDate: opportunity.deadline, confirmedAt, folio,
          ...(letter ? { motivationLetter: { name: letter.name, size: letter.size } } : {}) }
      } else {
        const quote = quoteEnrollmentPayment(identity.subject, opportunity, today)
        if (!quote?.canPay) return unavailable
        const { amount, currency, dueDate, reference } = quote
        if (amount !== proposal.payment.amount || currency !== proposal.payment.currency || dueDate !== proposal.payment.dueDate) return changed
        const card = record.paymentMethod
        if (!card) return unavailable
        if (proposal.paymentMethod?.last4 !== card.last4) return changed
        receipt = { kind: proposal.kind, status: 'paid', payment: { amount, currency, dueDate, reference },
          paymentMethod: { brand: card.brand, last4: card.last4 }, confirmedAt }
      }

      const audit = { actor: identity.subject, conversationId: proposal.conversationId, proposalId: proposal.id, confirmedAt,
        event: scholarship ? 'banner.scholarship.requested' : 'banner.enrollment.paid',
        ...(letter ? { motivationLetter: { name: letter.name, size: letter.size, sha256: letter.sha256 } } : {}) }
      const value: Value = { ...current, [slot]: receipt, [slot + 'Audit']: audit, version: (current?.version ?? -1) + 1 }
      try {
        await store.write(identity.subject, [{ key, value, version: current?.version }])
        return { ok: true, receipt }
      } catch (error) {
        if (!(error instanceof Conflict)) throw error
      }
    }
    return { ok: false, code: 'ACTION_PENDING' }
  }
}
