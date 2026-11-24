import type { createBannerActionHandler, BannerActionRequest } from './actions.js'
import { fixtureByEnrollment } from './fixtures.js'

const enrollment = /^M\d{7}$/
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const date = /^\d{4}-\d{2}-\d{2}$/
const object = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined

function actionRequest(request: Record<string, unknown>): BannerActionRequest | undefined {
  const { operation } = request
  const identity = object(request.identity)
  if (!identity || typeof identity.subject !== 'string' || !uuid.test(identity.subject) ||
      typeof identity.enrollment !== 'string' || !enrollment.test(identity.enrollment) ||
      typeof identity.campus !== 'string' || typeof identity.career !== 'string' || typeof identity.personaId !== 'string' ||
      typeof identity.semester !== 'number' || !Number.isInteger(identity.semester) || Object.keys(identity).length !== 6) return
  if (operation === 'getEnrollmentActions' && Object.keys(request).length === 3) return request as unknown as BannerActionRequest
  const letter = request.motivationLetter === undefined ? undefined : object(request.motivationLetter)
  if (operation !== 'confirmEnrollmentAction' ||
      Object.entries(request).filter(([, value]) => value !== undefined).length !== (letter ? 5 : 4) || (request.motivationLetter !== undefined && (!letter || Object.keys(letter).length !== 2 ||
      typeof letter.name !== 'string' || typeof letter.contentBase64 !== 'string'))) return
  const proposal = object(request.proposal)
  if (!proposal || typeof proposal.id !== 'string' || !uuid.test(proposal.id) ||
      typeof proposal.conversationId !== 'string' || !uuid.test(proposal.conversationId)) return
  if (proposal.kind === 'request-scholarship' && typeof proposal.dueDate === 'string' && date.test(proposal.dueDate)) return request as unknown as BannerActionRequest
  const payment = object(proposal.payment)
  if (proposal.kind === 'pay-enrollment' && payment && typeof payment.amount === 'number' && Number.isFinite(payment.amount) &&
      payment.currency === 'MXN' && typeof payment.dueDate === 'string' && date.test(payment.dueDate) &&
      object(proposal.paymentMethod) && typeof object(proposal.paymentMethod)!.last4 === 'string') return request as unknown as BannerActionRequest
}

type ActionHandler = ReturnType<typeof createBannerActionHandler>

export function createBannerHandler(performAction: ActionHandler, listCatalog: () => Promise<unknown[]>) {
  return async (event: unknown) => {
    const request = object(event)
    if (request?.version === 1) {
      if (request.operation === 'getStudentRecord' && typeof request.enrollment === 'string' &&
          enrollment.test(request.enrollment) && Object.keys(request).length === 3) return { record: fixtureByEnrollment(request.enrollment) }
      if (request.operation === 'listOpportunities' && Object.keys(request).length === 2) return { opportunities: await listCatalog() }
      const action = actionRequest(request)
      if (action) return performAction(action)
    }
    throw new Error('INVALID_BANNER_REQUEST')
  }
}

let runtime: Promise<ReturnType<typeof import('./dynamo.js').createBannerRuntime>> | undefined
const bannerRuntime = () => runtime ??= import('./dynamo.js').then(({ createBannerRuntime }) => createBannerRuntime())
export const handler = createBannerHandler(
  async action => (await bannerRuntime()).actions(action),
  async () => (await bannerRuntime()).catalog.list(),
)
