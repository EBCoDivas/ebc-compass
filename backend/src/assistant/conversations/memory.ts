import { normalize } from '../domain/text.js'
import type { AssistantProfile } from '../types.js'
import type { ConversationRepository, MemoryFact, MemoryKey, ArchivedMessage } from './repository.js'

export const MEMORY_KEYS: MemoryKey[] = ['career', 'campus', 'semester', 'interests', 'goal', 'schedule', 'language', 'modality']
export const EDITABLE_VALUES: Partial<Record<MemoryKey, readonly string[]>> = {
  goal: ['banking-internship', 'marketing-internship', 'professional-certification', 'entrepreneurship'],
  schedule: ['mornings', 'afternoons', 'evenings', 'weekends'], language: ['es', 'en'], modality: ['online', 'in-person', 'hybrid'],
  interests: ['finanzas', 'banca', 'fintech', 'marketing', 'emprendimiento', 'contabilidad', 'derecho', 'becas'],
}

export function validMemoryValue(key: MemoryKey, value: unknown): value is string {
  return typeof value === 'string' && value.length <= 180 && value.split(',').every(part => EDITABLE_VALUES[key]?.includes(part))
}

/** Extract only controlled categories, never store raw student text or arbitrary model output. */
export function extractMemories(text: string): { key: MemoryKey; value: string }[] {
  const facts: { key: MemoryKey; value: string }[] = []
  for (const part of text.split(/[.!?\n]+/)) {
    const message = normalize(part)
    if (/\b(no|not|never|nunca)\b/.test(message)) continue
    if (/^(?:yo )?(quiero|mi meta es|mi objetivo es|i want|my goal is)\b/.test(message)) {
      if (/\b(practicas|internship)\b/.test(message) && /\b(banca|banking)\b/.test(message)) facts.push({ key: 'goal', value: 'banking-internship' })
      else if (/\b(practicas|internship)\b/.test(message) && /\bmarketing\b/.test(message)) facts.push({ key: 'goal', value: 'marketing-internship' })
      else if (/\b(certificarme|certificacion|certification)\b/.test(message)) facts.push({ key: 'goal', value: 'professional-certification' })
      else if (/\b(emprender|emprendimiento|entrepreneurship)\b/.test(message)) facts.push({ key: 'goal', value: 'entrepreneurship' })
    }
    if (/^(me interesa|mis intereses|i am interested|my interests)\b/.test(message)) {
      const interests = EDITABLE_VALUES.interests!.filter(word => new RegExp('\\b' + word + '\\b').test(message))
      if (interests.length) facts.push({ key: 'interests', value: interests.join(',') })
    }
    if (/^(solo puedo|mi disponibilidad|i am available|i can only|my availability)\b/.test(message)) {
      const slots = [['weekends', /fin de semana|weekend/], ['afternoons', /tarde|afternoon/], ['mornings', /manana|morning/], ['evenings', /noche|evening/]] as const
      const slot = slots.find(([, pattern]) => pattern.test(message))
      if (slot) facts.push({ key: 'schedule', value: slot[0] })
    }
    if (/^(prefiero|mi idioma|i prefer|my language)\b/.test(message)) {
      if (/\b(ingles|english)\b/.test(message)) facts.push({ key: 'language', value: 'en' })
      else if (/\b(espanol|spanish)\b/.test(message)) facts.push({ key: 'language', value: 'es' })
    }
  }
  return facts
}

export async function seedMemories(repo: ConversationRepository, owner: string, profile?: AssistantProfile) {
  if (!profile) return
  const facts: Partial<Record<MemoryKey, string>> = {
    career: profile.career, campus: profile.campus, semester: profile.currentSemester?.toString(),
    interests: profile.interests?.map(normalize).filter(item => EDITABLE_VALUES.interests!.includes(item)).join(',') || undefined,
  }
  for (const fact of extractMemories('Mi meta es ' + (profile.goals ?? '') + '. Mi disponibilidad ' + (profile.availability ?? ''))) facts[fact.key] = fact.value
  for (const [key, value] of Object.entries(facts)) if (value) await repo.saveMemory(owner, { key: key as MemoryKey, value, origin: 'profile' })
  for (const previous of await repo.memories(owner)) {
    if (previous.origin === 'profile' && previous.value && !facts[previous.key] && !previous.suppressed) {
      await repo.saveMemory(owner, { key: previous.key, value: '', origin: 'profile' })
    }
  }
}

export async function forgetMemory(repo: ConversationRepository, owner: string, key?: MemoryKey) {
  for (const item of key ? [key] : [...new Set([...MEMORY_KEYS, ...(await repo.memories(owner)).map(fact => fact.key)])]) await repo.saveMemory(owner, { key: item, value: '', origin: 'user', suppressed: true }, false)
}

export function memoryContext(memories: MemoryFact[], profile?: AssistantProfile): MemoryFact[] {
  const available = memories.filter(item => !item.suppressed && item.value)
  // Current verified profile always wins; a forgotten memory does not erase the user's actual profile.
  return available.filter(item => !(item.key === 'career' && profile?.career && item.value !== profile.career)
    && !(item.key === 'campus' && profile?.campus && item.value !== profile.campus)
    && !(item.key === 'semester' && profile?.currentSemester && item.value !== profile.currentSemester.toString())).slice(0, 20)
}

const TOPICS: Record<string, string> = { 'scholarship-info': 'becas', 'course-info': 'cursos y prerrequisitos', 'procedure-info': 'trámites', 'event-info': 'eventos',
  'career-info': 'desarrollo profesional y empleo', 'recommendation-request': 'recomendaciones', 'deadline-query': 'consulta de fechas', 'profile-help': 'perfil', unknown: 'orientación general' }

/** A semantic topic summary with a closed vocabulary: no copied dates, codes, amounts or sensitive text. */
export function compactSummary(previous: string, messages: ArchivedMessage[]): string {
  const topics = previous ? previous.split('; ') : []
  for (const message of messages) {
    if (message.inputBlock || message.role !== 'assistant' || !message.intent || !TOPICS[message.intent]) continue
    const entry = (message.failure || message.interrupted ? 'Consulta pendiente: ' : 'Orientación recibida: ') + TOPICS[message.intent]
    if (!topics.includes(entry)) topics.push(entry)
  }
  return topics.slice(-12).join('; ').slice(0, 800)
}
