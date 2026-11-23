import { assessInput } from '../assistant/domain/inputGuardrail.js'
import { memoryContext } from '../assistant/conversations/memory.js'
import type { ConversationRepository } from '../assistant/conversations/repository.js'
import type { DocumentStore } from '../assistant/conversations/store.js'
import type { AssistantProfile, KnowledgeRetriever } from '../assistant/types.js'
import type { BannerReader } from '../banner/reader.js'
import { academicProgressReader } from '../data/studentAcademicProgress.js'
import { planningOpportunities } from '../data/studentPlanning.js'
import { readStudentJourney, type StudentContext } from '../planning/readStudentJourney.js'
import { asObject, opportunityTypes, toolList, type ToolReply } from './contract.js'

export interface ToolDependencies {
  banner: BannerReader
  store: Pick<DocumentStore, 'get'>
  memories: Pick<ConversationRepository, 'memories'>
  knowledge: KnowledgeRetriever
  today?: () => string
}

const invalid = { ok: false, code: 'INVALID_INPUT' } as const
const unavailable = { ok: false, code: 'UNAVAILABLE' } as const

export function makeToolHandler(dependencies: ToolDependencies) {
  return async (name: string, input: unknown, student?: StudentContext): Promise<ToolReply> => {
    if (!student) return { ok: false, code: 'UNAUTHORIZED' }
    const tool = toolList.find(item => item.name === name)
    const args = asObject(input ?? {})
    if (!tool || !args || Object.keys(args).some(key =>
      !Object.hasOwn(tool.inputSchema.properties, key) || typeof args[key] !== 'string')) return invalid
    if (tool.inputSchema.required?.some(key => typeof args[key] !== 'string' || !String(args[key]).trim())) return invalid

    try {
      switch (name) {
        case 'get_student_context': {
          const [journey, stored] = await Promise.all([
            readStudentJourney(student, dependencies.banner, dependencies.store, dependencies.today?.()),
            dependencies.memories.memories(student.subject),
          ])
          const profile: AssistantProfile = { career: student.career as AssistantProfile['career'], campus: student.campus, currentSemester: student.semester }
          const memory = memoryContext(stored, profile).map(({ key, value, origin }) => ({ key, value, origin }))
          if (student.personaId === 'ana' && student.career === 'accounting' && student.campus === 'QRO' && student.semester === 7 &&
              !stored.some(fact => fact.key === 'workSchedule')) memory.unshift({ key: 'workSchedule', value: 'works-afternoons', origin: 'demo' })
          const { stage, pending, route, achievements, calculations } = journey
          return { ok: true, data: { stage, pending, route, achievements, calculations, memory } }
        }
        case 'get_requirements': {
          const item = planningOpportunities(student).find(opportunity => opportunity.id === args.opportunityId)
          if (!item) return { ok: false, code: 'NOT_FOUND' }
          const { id, type, title, description, requirements, deadline, scholarshipCriteria, enrollmentFee, serviceHoursRequired } = item
          return { ok: true, data: { id, type, title, description, requirements: requirements ?? [], deadline, scholarshipCriteria, enrollmentFee, serviceHoursRequired } }
        }
        case 'list_opportunities': {
          if (args.type !== undefined && !opportunityTypes.some(type => args.type === type)) return invalid
          return { ok: true, data: { opportunities: planningOpportunities(student).filter(item => !args.type || item.type === args.type) } }
        }
        case 'get_academic_progress': {
          const progress = await academicProgressReader(dependencies.banner).read({ ...student, id: student.subject })
          return { ok: true, data: { progress } }
        }
        case 'search_knowledge': {
          const query = String(args.query).trim()
          if (query.length > 300 || (args.language !== 'es' && args.language !== 'en') ||
              /@|\bM\d{7}\b|\b\d{7,}\b|\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/i.test(query) ||
              assessInput(query)) return invalid
          const passages = await dependencies.knowledge.retrieve(query, { language: args.language, limit: 3 })
          return { ok: true, data: { passages: passages.slice(0, 3) } }
        }
      }
      return invalid
    } catch { return unavailable }
  }
}

export type ToolHandler = ReturnType<typeof makeToolHandler>
