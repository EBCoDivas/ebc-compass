import { memoryContext } from '../assistant/conversations/memory.js'
import type { ConversationRepository } from '../assistant/conversations/repository.js'
import type { DocumentStore } from '../assistant/conversations/store.js'
import type { AssistantProfile } from '../assistant/types.js'
import type { BannerReader } from '../banner/reader.js'
import { readStudentJourney, type StudentContext } from '../planning/readStudentJourney.js'

export async function readStudentContext(student: StudentContext, dependencies: {
  banner: BannerReader; store: Pick<DocumentStore, 'get'>; memories: Pick<ConversationRepository, 'memories'>; today?: string
}) {
  const [journey, stored] = await Promise.all([
    readStudentJourney(student, dependencies.banner, dependencies.store, dependencies.today),
    dependencies.memories.memories(student.subject),
  ])
  const profile: AssistantProfile = { career: student.career as AssistantProfile['career'], campus: student.campus, currentSemester: student.semester }
  const memory = memoryContext(stored, profile).map(({ key, value, origin }) => ({ key, value, origin }))
  // La memoria demo mantiene el mismo contexto que el MCP hasta que el perfil la haya sembrado.
  if (student.personaId === 'ana' && student.career === 'accounting' && student.campus === 'QRO' && student.semester === 7 &&
      !stored.some(fact => fact.key === 'workSchedule')) memory.unshift({ key: 'workSchedule', value: 'works-afternoons', origin: 'demo' })
  return { journey, memory }
}
