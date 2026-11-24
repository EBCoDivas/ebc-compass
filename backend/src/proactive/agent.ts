import { createHash, randomUUID } from 'node:crypto'
import type { ConversationRepository } from '../assistant/conversations/repository.js'
import type { DocumentStore } from '../assistant/conversations/store.js'
import type { LlmProvider } from '../assistant/types.js'
import type { BannerReader } from '../banner/reader.js'
import { readStudentContext } from '../mcp/studentContext.js'
import type { StudentContext } from '../planning/readStudentJourney.js'
import { planningDate } from '../planning/rules.js'
import { proactiveCandidates } from './fallback.js'
import { ProactiveNoticeRepository } from './repository.js'
import type { ProactiveCandidate, ProactiveContext, ProactiveNotice } from './types.js'

function fingerprint(context: ProactiveContext) {
  return createHash('sha256').update(JSON.stringify({ stage: context.journey.stage, pending: context.journey.pending,
    calculations: context.journey.calculations, memory: context.memory.filter(item => item.key === 'workSchedule'),
    catalog: context.catalog.map(item => ({ id: item.id, schedule: item.schedule, deadline: item.deadline })) })).digest('hex')
}

function orderedCandidates(value: string, candidates: ProactiveCandidate[]): ProactiveCandidate[] | undefined {
  let parsed: unknown
  try { parsed = JSON.parse(value) } catch { return undefined }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { notices?: unknown }).notices)) return undefined
  const notices = (parsed as { notices: unknown[] }).notices
  if (notices.length !== candidates.length || notices.length > 3) return undefined
  const allowed = new Map(candidates.map(candidate => [candidate.id, candidate]))
  const seen = new Set<string>()
  const result: ProactiveCandidate[] = []
  for (const value of notices) {
    if (!value || typeof value !== 'object') return undefined
    const item = value as { candidateId?: unknown }
    if (typeof item.candidateId !== 'string' || seen.has(item.candidateId)) return undefined
    const candidate = allowed.get(item.candidateId)
    if (!candidate) return undefined
    seen.add(item.candidateId)
    result.push(candidate)
  }
  return seen.size === candidates.length ? result : undefined
}

function fallback(candidates: ProactiveCandidate[], createdAt: string): ProactiveNotice[] {
  return candidates.map(candidate => ({ ...candidate, id: candidate.id, createdAt }))
}

export function createProactiveAgent(dependencies: { store: DocumentStore; banner: BannerReader; memories: Pick<ConversationRepository, 'memories'>;
  llm?: LlmProvider; llmTimeoutMs?: number; today?: () => string; now?: () => Date }) {
  const repository = new ProactiveNoticeRepository(dependencies.store)
  async function context(student: StudentContext): Promise<ProactiveContext> {
    const today = dependencies.today?.() ?? planningDate()
    const { journey, memory } = await readStudentContext(student, { banner: dependencies.banner, store: dependencies.store, memories: dependencies.memories, today })
    return { journey, memory, catalog: journey.catalog, today }
  }
  return {
    read: (student: StudentContext) => repository.get(student.subject),
    async ensure(student: StudentContext) {
      const current = await context(student)
      const hash = fingerprint(current)
      const existing = await repository.get(student.subject)
      if (existing?.fingerprint === hash) return existing.notices
      const candidates = proactiveCandidates(current)
      const createdAt = (dependencies.now?.() ?? new Date()).toISOString()
      let notices = fallback(candidates, createdAt)
      const token = randomUUID()
      if (!(await repository.acquire(student.subject, token))) {
        const saved = await repository.get(student.subject)
        return saved?.fingerprint === hash ? saved.notices : notices
      }
      try {
      if (dependencies.llm && candidates.length) {
        try {
          const answer = await dependencies.llm.generate({ system: 'Eres el agente proactivo de EBC Compass. Devuelve JSON estricto {"notices":[{"candidateId":"..."}]}. Ordena exclusivamente los candidateId proporcionados. Las reglas ya redactaron los avisos oficiales: no agregues texto, fechas, trámites, montos u oportunidades.',
            language: 'es', messages: [{ role: 'user', content: JSON.stringify({ stage: current.journey.stage, pending: current.journey.pending, calculations: current.journey.calculations, memory: current.memory, allowedOpportunities: current.catalog.map(item => ({ id: item.id, title: item.title, schedule: item.schedule })), candidates }) }], timeoutMs: dependencies.llmTimeoutMs ?? 10_000 })
          const ordered = orderedCandidates(answer, candidates)
          if (ordered) notices = fallback(ordered, createdAt)
        } catch { /* El fallback determinista es el resultado seguro. */ }
      }
      await repository.save(student.subject, { fingerprint: hash, notices })
      return notices
      } finally { await repository.release(student.subject, token) }
    },
  }
}
