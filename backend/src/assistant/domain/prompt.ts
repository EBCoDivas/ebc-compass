// Construcción del prompt para el LLM. El modelo solo redacta: los datos salen de la hoja de hechos
// y de los documentos recuperados. Los textos del estudiante y del perfil se tratan como datos, no como instrucciones.

import type { AssistantProfile, ChatMessage, FactSheet, Language, Passage } from '../types.js'
import { careerName } from './templates.js'
import { formatDate } from './text.js'
import type { MemoryFact } from '../conversations/repository.js'

export interface Prompt {
  system: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  /** Texto de <DATOS>, <PERFIL> y <DOCUMENTOS>: lo único que la respuesta puede citar (lo usa el guardrail). */
  allowed: string
}

function dataBlock(facts: FactSheet): string {
  return JSON.stringify({
    intent: facts.intent,
    careerFilter: facts.careerFilter ?? null,
    notes: facts.notes,
    items: facts.items.map((item) => ({
      type: item.type,
      title: item.title,
      code: item.code ?? null,
      description: item.description,
      deadline: item.deadline ? formatDate(item.deadline) : null,
      daysRemaining: item.daysRemaining ?? null,
      location: item.location ?? null,
      prerequisites: item.prerequisites ?? null,
      matchesProfile: item.matchesProfile ?? null,
      alreadyCompleted: item.alreadyCompleted ?? null,
    })),
  })
}

function profileBlock(profile: AssistantProfile | undefined, language: Language): string {
  if (!profile) return language === 'es' ? 'Sin perfil.' : 'No profile.'
  return JSON.stringify({
    name: profile.name ?? null,
    career: careerName(profile.career, language) ?? null,
    campus: profile.campus ?? null,
    semester: profile.currentSemester ?? null,
    completedCourses: profile.completedCourses ?? [],
    interests: profile.interests ?? [],
  })
}

export function buildPrompt(input: {
  system: string
  facts: FactSheet
  passages: Passage[]
  profile: AssistantProfile | undefined
  history: ChatMessage[]
  question: string
  language: Language
  summary?: string
  memories?: MemoryFact[]
}): Prompt {
  const data = dataBlock(input.facts)
  const profile = profileBlock(input.profile, input.language)
  const documents =
    input.passages.length > 0 ? input.passages.map((p, i) => `[${i + 1}] (${p.source}) ${p.text}`).join('\n\n') : input.language === 'es' ? 'Sin documentos.' : 'No documents.'

  const content = `<DATOS>\n${data}\n</DATOS>\n<PERFIL>\n${profile}\n</PERFIL>\n<DOCUMENTOS>\n${documents}\n</DOCUMENTOS>\n<PREGUNTA>\n${input.question}\n</PREGUNTA>`

  // El resumen y la memoria son contexto, deliberadamente excluidos de `allowed`.
  const context = input.summary || input.memories?.length ? [{ role: 'user' as const, content:
    '<CONTEXTO_NO_AUTORITATIVO>\n<MEMORIA>' + JSON.stringify((input.memories ?? []).slice(0, 20).map(({ key, value, origin }) => ({ key, value, origin }))) +
    '</MEMORIA>\n<RESUMEN>' + (input.summary ?? '') + '</RESUMEN>\n</CONTEXTO_NO_AUTORITATIVO>' }] : []
  const history = input.history.filter(message => !message.inputBlock).slice(-6).map((message) => ({ role: message.role === 'student' ? ('user' as const) : ('assistant' as const), content: message.content }))

  return { system: input.system, messages: [...context, ...history, { role: 'user', content }], allowed: `${data}\n${profile}\n${documents}` }
}
