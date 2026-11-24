import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda'
import type { BannerActionState } from '../../../shared/contracts/studentActions.js'
import { MemoryDocumentStore } from '../assistant/conversations/store.js'
import type { CatalogEntry } from './catalog/seed.js'
import { createCatalogStore } from './catalog/store.js'
import { createBannerActionHandler, type BannerActionRequest, type BannerConfirmation, type BannerConfirmationResult, type BannerIdentity } from './actions.js'
import { demoAcademicSnapshots, type BannerRecord } from './fixtures.js'

export interface AcademicStudent { id: string; personaId?: string; enrollment?: string; career?: string; campus?: string; semester?: number }
export interface BannerReader {
  readRecord(student: AcademicStudent): Promise<BannerRecord | null>
  readActions?(student: AcademicStudent): Promise<BannerActionState>
}
export interface BannerClient extends BannerReader {
  /** El catálogo de oportunidades: Banner lo guarda en su propia tabla de DynamoDB. */
  readCatalog(): Promise<CatalogEntry[]>
  readActions(student: AcademicStudent): Promise<BannerActionState>
  confirmAction(student: AcademicStudent, confirmation: BannerConfirmation): Promise<BannerConfirmationResult>
}

export function matchesBannerStudent(record: BannerRecord, student: Omit<AcademicStudent, 'id'>): boolean {
  return record.personaId === student.personaId && record.career === student.career && record.campus === student.campus &&
    (!student.semester || record.currentPeriod.number === student.semester) &&
    (!student.enrollment || record.enrollment === student.enrollment)
}

export const fixedBanner: BannerReader = {
  async readRecord(student) {
    const record = student.personaId && Object.hasOwn(demoAcademicSnapshots, student.personaId) ? demoAcademicSnapshots[student.personaId] : null
    return record && matchesBannerStudent(record, student) ? structuredClone(record) : null
  },
}

function actionIdentity(student: AcademicStudent): BannerIdentity | undefined {
  const { id, enrollment, personaId, campus, career, semester } = student
  if (enrollment && personaId && campus && career && semester === 1) return { subject: id, enrollment, personaId, campus, career, semester }
}

function withActions(reader: BannerReader, execute: (request: BannerActionRequest | { version: 1; operation: 'listOpportunities' }) => Promise<unknown>): BannerClient {
  return {
    ...reader,
    async readCatalog() {
      const reply = await execute({ version: 1, operation: 'listOpportunities' }) as { opportunities?: CatalogEntry[] }
      if (!Array.isArray(reply.opportunities)) throw new Error('BANNER_UNAVAILABLE')
      return reply.opportunities
    },
    async readActions(student) {
      const identity = actionIdentity(student)
      if (!identity) return {}
      const reply = await execute({ version: 1, operation: 'getEnrollmentActions', identity }) as { actions?: BannerActionState }
      if (!reply.actions || typeof reply.actions !== 'object') throw new Error('BANNER_UNAVAILABLE')
      return reply.actions
    },
    async confirmAction(student, confirmation) {
      const identity = actionIdentity(student)
      if (!identity) return { ok: false, code: 'ACTION_UNAVAILABLE' }
      const reply = await execute({ version: 1, operation: 'confirmEnrollmentAction', identity, ...confirmation }) as BannerConfirmationResult
      if (reply.ok === true ? reply.receipt?.kind === confirmation.proposal.kind : reply.ok === false &&
          ['ACTION_UNAVAILABLE', 'ACTION_CHANGED', 'MOTIVATION_LETTER_REQUIRED', 'INVALID_LETTER', 'ACTION_PENDING'].includes(reply.code)) return reply
      throw new Error('BANNER_UNAVAILABLE')
    },
  }
}

export function createFixedBannerClient(store = new MemoryDocumentStore(), now?: () => Date,
  catalog = createCatalogStore(new MemoryDocumentStore())): BannerClient {
  const actions = createBannerActionHandler(store, now, catalog)
  return withActions(fixedBanner, async request => request.operation === 'listOpportunities' ? { opportunities: await catalog.list() } : actions(request))
}

export function createBannerReader(env = process.env, client?: Pick<LambdaClient, 'send'>): BannerClient {
  const functionName = env.BANNER_FUNCTION_NAME?.trim()
  if (!functionName) {
    if (env.APP_STAGE || env.MCP_TRANSPORT) throw new Error('Falta BANNER_FUNCTION_NAME.')
    return createFixedBannerClient()
  }
  const lambda = client ?? new LambdaClient({ maxAttempts: 1, requestHandler: { requestTimeout: 4000, throwOnRequestTimeout: true } })
  const invoke = async (request: BannerActionRequest | { version: 1; operation: 'getStudentRecord'; enrollment: string; semester?: number } | { version: 1; operation: 'listOpportunities' }) => {
    try {
      const result = await lambda.send(new InvokeCommand({ FunctionName: functionName, InvocationType: 'RequestResponse',
        Payload: Buffer.from(JSON.stringify(request)) }))
      if (result.FunctionError || !result.Payload || result.StatusCode !== 200) throw new Error()
      return JSON.parse(Buffer.from(result.Payload).toString('utf8')) as unknown
    } catch {
      throw new Error('BANNER_UNAVAILABLE')
    }
  }
  const localActions = !env.APP_STAGE && env.AWS_ENDPOINT_URL === 'https://127.0.0.1:9297' && !client
  return withActions({
    async readRecord(student) {
      if (!student.enrollment || !student.personaId) return null
      const { record } = await invoke({ version: 1, operation: 'getStudentRecord', enrollment: student.enrollment, ...(student.semester ? { semester: student.semester } : {}) }) as { record?: BannerRecord | null }
      if (record === null) return null
      if (!record || typeof record.asOf !== 'string' || !record.currentPeriod ||
        !Number.isInteger(record.currentPeriod.number)) throw new Error('BANNER_UNAVAILABLE')
      return matchesBannerStudent(record, student) ? record : null
    },
  }, localActions ? async request => (await import('./lambda.js')).handler(request) : invoke)
}
