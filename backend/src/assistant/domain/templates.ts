// Respuestas por plantilla (ES/EN). Es el modo "rules": determinista, sin LLM, y también el respaldo
// cuando el LLM falla o tarda. Todo dato que se afirma sale de la hoja de hechos (FactSheet).

import type { AssistantProfile, CareerId, FactItem, FactSheet, Intent, Language, Source } from '../types.js'
import { formatDate } from './text.js'

const CAREER_NAME: Record<Language, Record<CareerId, string>> = {
  es: { banking: 'Banca', finance: 'Finanzas', marketing: 'Mercadotecnia', 'business-administration': 'Administración de Empresas' },
  en: { banking: 'Banking', finance: 'Finance', marketing: 'Marketing', 'business-administration': 'Business Administration' },
}

const FIELD_NAME: Record<Language, Record<string, string>> = {
  es: { name: 'nombre', campus: 'campus', career: 'carrera', currentSemester: 'semestre' },
  en: { name: 'name', campus: 'campus', career: 'career', currentSemester: 'semester' },
}

const RESOURCE: Record<Language, string> = {
  es: 'Para más información, acude a Servicios Escolares de tu campus.',
  en: 'For more information, please visit the Academic Services office at your campus.',
}

export function careerName(career: CareerId | undefined, language: Language): string | undefined {
  return career ? CAREER_NAME[language][career] : undefined
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

function daysText(days: number | undefined, language: Language): string {
  if (days === undefined) return ''
  if (language === 'es') {
    if (days < 0) return 'vencida'
    if (days === 0) return 'hoy'
    if (days === 1) return 'mañana'
    return `en ${days} días`
  }
  if (days < 0) return 'expired'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

function itemLine(item: FactItem, language: Language, facts: FactSheet): string {
  const es = language === 'es'
  const label = item.type === 'event' ? (es ? 'Fecha' : 'Date') : es ? 'Fecha límite' : 'Deadline'
  const parts = [`• ${item.title}${item.code ? ` (${item.code})` : ''}`]
  parts[0] += ` — ${item.description}`
  if (item.deadline) parts.push(`${label}: ${formatDate(item.deadline)} (${daysText(item.daysRemaining, language)}).`)
  if (item.location) parts.push(`${es ? 'Lugar' : 'Location'}: ${item.location}.`)
  if (item.prerequisites && item.prerequisites.length > 0) {
    parts.push(`${es ? 'Prerrequisitos' : 'Prerequisites'}: ${item.prerequisites.join(', ')}.`)
  }
  if (item.alreadyCompleted) parts.push(es ? 'Ya lo completaste.' : 'You have already completed it.')
  if (facts.intent !== 'deadline-query' && item.matchesProfile === true) parts.push(es ? 'Coincide con tu perfil.' : 'It matches your profile.')
  if (item.matchesProfile === false) parts.push(es ? 'Podría no corresponder a tu carrera o semestre.' : 'It may not match your career or semester.')
  return parts.join(' ')
}

/** Línea corta para seguimientos sobre fechas ("¿y la fecha límite?"). */
function deadlineLine(item: FactItem, language: Language): string {
  const label = item.type === 'event' ? (language === 'es' ? 'Fecha' : 'Date') : language === 'es' ? 'Fecha límite' : 'Deadline'
  return item.deadline
    ? `• ${item.title} — ${label}: ${formatDate(item.deadline)} (${daysText(item.daysRemaining, language)}).`
    : `• ${item.title} — ${language === 'es' ? 'sin fecha registrada' : 'no date on record'}.`
}

function header(facts: FactSheet): string {
  const es = facts.language === 'es'
  const n = facts.items.length
  const forCareer = careerName(facts.careerFilter, facts.language)
  const career = forCareer ? (es ? ` para ${forCareer}` : ` for ${forCareer}`) : ''
  switch (facts.intent) {
    case 'scholarship-info':
      return n === 0
        ? es ? `No encontré becas vigentes${career} por el momento.` : `I couldn't find open scholarships${career} right now.`
        : es ? `Encontré ${n} ${plural(n, 'beca', 'becas')}${career}:` : `I found ${n} ${plural(n, 'scholarship', 'scholarships')}${career}:`
    case 'course-info':
      return n === 0
        ? es ? `No encontré cursos${career} con esos datos.` : `I couldn't find courses${career} matching that.`
        : es ? `Esto es lo que encontré sobre cursos${career}:` : `Here is what I found about courses${career}:`
    case 'procedure-info':
      return n === 0 ? (es ? 'No encontré trámites vigentes.' : "I couldn't find open procedures.") : es ? 'Estos son los trámites disponibles:' : 'These are the available procedures:'
    case 'event-info':
      return n === 0 ? (es ? 'No encontré eventos próximos.' : "I couldn't find upcoming events.") : es ? 'Estos son los próximos eventos:' : 'These are the upcoming events:'
    case 'career-info':
      return n === 0
        ? es ? `No encontré certificaciones, prácticas ni vacantes${career} por ahora.` : `I couldn't find certifications, internships or jobs${career} right now.`
        : es ? `Esto es lo que encontré sobre desarrollo profesional y empleo${career}:` : `Here is what I found about professional development and jobs${career}:`
    case 'recommendation-request':
      return n === 0
        ? es ? 'Por ahora no tengo recomendaciones para ti.' : "I don't have recommendations for you right now."
        : es ? 'Estas son mis recomendaciones para ti:' : 'Here are my recommendations for you:'
    case 'deadline-query':
      return n === 0
        ? es ? 'No hay fechas importantes en los próximos 45 días.' : 'There are no important dates in the next 45 days.'
        : es ? 'Estas son las próximas fechas importantes:' : 'These are the upcoming important dates:'
    default:
      return ''
  }
}

/** Línea de contexto del perfil (RF-05.5 a 05.7): carrera, semestre y cursos completados. */
export function contextLine(facts: FactSheet, profile: AssistantProfile | undefined): string | undefined {
  const es = facts.language === 'es'
  const parts: string[] = []
  const career = careerName(profile?.career, facts.language)
  if (career) parts.push(career)
  if (profile?.currentSemester) parts.push(es ? `semestre ${profile.currentSemester}` : `semester ${profile.currentSemester}`)
  const completed = profile?.completedCourses ?? []
  let line = parts.length > 0 ? (es ? `Tomé en cuenta tu perfil (${parts.join(', ')})` : `I took your profile into account (${parts.join(', ')})`) : ''
  if (facts.intent === 'course-info' && completed.length > 0) {
    const done = es ? `cursos completados: ${completed.join(', ')}` : `completed courses: ${completed.join(', ')}`
    line = line ? `${line}; ${done}` : es ? `Tomé en cuenta tus ${done}` : `I took into account your ${done}`
  }
  return line ? `${line}.` : undefined
}

function missingLine(facts: FactSheet): string | undefined {
  if (facts.missingProfileFields.length === 0) return undefined
  const names = facts.missingProfileFields.map((field) => FIELD_NAME[facts.language][field] ?? field).join(', ')
  return facts.language === 'es'
    ? `Completa tu perfil (${names}) para recomendaciones más precisas.`
    : `Complete your profile (${names}) for more accurate recommendations.`
}

/** Preguntas sugeridas: alternativas cuando no se entiende (RF-05.13) y seguimientos por tema. */
export function suggestionsFor(intent: Intent, language: Language): string[] {
  const es = language === 'es'
  const general = es
    ? ['¿Qué becas hay disponibles?', '¿Cuáles son las próximas fechas importantes?', '¿Cómo me reinscribo?']
    : ['Which scholarships are available?', 'What are the upcoming important dates?', 'How do I re-enroll?']
  const byIntent: Partial<Record<Intent, string[]>> = {
    'scholarship-info': es
      ? ['¿Cuál es la fecha límite de la beca?', '¿Cómo solicito una beca?', '¿Qué me recomiendas?']
      : ['What is the scholarship deadline?', 'How do I apply for a scholarship?', 'What do you recommend for me?'],
    'course-info': es
      ? ['¿Qué cursos me recomiendas?', '¿Cuáles son los prerrequisitos de FIN-301?', '¿Qué becas hay disponibles?']
      : ['Which courses do you recommend?', 'What are the prerequisites of FIN-301?', 'Which scholarships are available?'],
    'procedure-info': es
      ? ['¿Cuál es la fecha límite de la reinscripción?', '¿Cómo solicito una beca?', '¿Cuáles son las próximas fechas importantes?']
      : ['What is the re-enrollment deadline?', 'How do I apply for a scholarship?', 'What are the upcoming important dates?'],
    'event-info': es
      ? ['¿Qué eventos hay de fintech?', '¿Cuáles son las próximas fechas importantes?', '¿Qué me recomiendas?']
      : ['Which fintech events are there?', 'What are the upcoming important dates?', 'What do you recommend for me?'],
    'career-info': es
      ? ['¿Qué prácticas profesionales hay?', '¿Qué certificaciones me recomiendas?', '¿Qué eventos de empleabilidad hay?']
      : ['Which internships are there?', 'Which certifications do you recommend?', 'Which career events are there?'],
    'recommendation-request': es
      ? ['¿Qué becas hay disponibles?', '¿Qué eventos hay próximamente?', '¿Cuáles son las próximas fechas importantes?']
      : ['Which scholarships are available?', 'Which events are coming up?', 'What are the upcoming important dates?'],
    'deadline-query': es
      ? ['¿Qué becas hay disponibles?', '¿Cómo me reinscribo?', '¿Qué me recomiendas?']
      : ['Which scholarships are available?', 'How do I re-enroll?', 'What do you recommend for me?'],
  }
  return byIntent[intent] ?? general
}

export function sourcesFor(facts: FactSheet): Source[] {
  return facts.items.map((item) => ({ kind: 'opportunity' as const, id: item.id, title: item.title }))
}

export interface RenderedReply {
  content: string
  suggestions: string[]
  sources: Source[]
}

/** Respuesta completa por plantilla a partir de la hoja de hechos y el perfil. */
export function renderReply(facts: FactSheet, profile: AssistantProfile | undefined): RenderedReply {
  const es = facts.language === 'es'
  const lines: string[] = []

  switch (facts.intent) {
    case 'greeting': {
      const name = profile?.name ? `, ${profile.name}` : ''
      lines.push(
        es
          ? `¡Hola${name}! Soy el asistente de EBC Compass. Puedo ayudarte con becas, cursos, trámites, eventos, certificaciones, prácticas y fechas importantes. ¿En qué te ayudo?`
          : `Hi${name}! I'm the EBC Compass assistant. I can help with scholarships, courses, procedures, events, certifications, internships and important dates. How can I help?`,
      )
      break
    }
    case 'help':
      lines.push(
        es
          ? 'Puedo ayudarte con:\n• Becas: requisitos, montos y fechas límite.\n• Cursos: prerrequisitos y semestre.\n• Trámites: pasos, documentos y fechas.\n• Certificaciones, prácticas y empleo.\n• Eventos próximos y fechas importantes.\n• Recomendaciones según tu perfil.\nEscribe tu pregunta en español o en inglés.'
          : 'I can help you with:\n• Scholarships: requirements, amounts and deadlines.\n• Courses: prerequisites and semester.\n• Procedures: steps, documents and dates.\n• Certifications, internships and jobs.\n• Upcoming events and important dates.\n• Recommendations based on your profile.\nAsk in Spanish or English.',
      )
      break
    case 'profile-help': {
      if (facts.missingProfileFields.length === 0) {
        lines.push(es ? 'Tu perfil está completo (100%). ¡Ya puedo darte recomendaciones personalizadas!' : 'Your profile is complete (100%). I can give you personalized recommendations!')
      } else {
        const names = facts.missingProfileFields.map((field) => FIELD_NAME[facts.language][field] ?? field).join(', ')
        lines.push(
          es
            ? `Tu perfil está al ${facts.completeness}%. Te falta: ${names}. Complétalo en la sección Perfil para recibir recomendaciones más precisas.`
            : `Your profile is ${facts.completeness}% complete. Missing: ${names}. Complete it in the Profile section for more accurate recommendations.`,
        )
      }
      break
    }
    case 'unknown':
      lines.push(
        es
          ? 'No estoy seguro de haber entendido tu pregunta. Puedes preguntarme, por ejemplo:'
          : "I'm not sure I understood your question. You could ask me, for example:",
      )
      lines.push(...suggestionsFor('unknown', facts.language).map((s) => `• ${s}`))
      lines.push(RESOURCE[facts.language])
      break
    default: {
      const deadlineFocus = facts.focus === 'deadline' && facts.intent !== 'deadline-query' && facts.intent !== 'recommendation-request'
      lines.push(deadlineFocus && facts.items.length > 0 ? (es ? 'Estas son las fechas:' : 'Here are the dates:') : header(facts))
      if (facts.items.length > 0) {
        lines.push(...facts.items.map((item) => (deadlineFocus ? deadlineLine(item, facts.language) : itemLine(item, facts.language, facts))))
      }
      if (facts.focus === 'requirements' && facts.intent === 'course-info') {
        lines.push(es ? 'No tengo prerrequisitos registrados para estos cursos. Consúltalos con Servicios Escolares.' : "I don't have prerequisites on record for these courses. Please check with Academic Services.")
      } else if (facts.focus === 'requirements') {
        lines.push(
          es
            ? 'No tengo los requisitos detallados en mi catálogo. ' + RESOURCE.es
            : "I don't have the detailed requirements in my catalog. " + RESOURCE.en,
        )
      } else if (facts.notes.includes('no-prerequisite-data') && facts.intent === 'course-info' && facts.items.length > 0 && !deadlineFocus) {
        lines.push(es ? 'No tengo prerrequisitos registrados para estos cursos. Consúltalos con Servicios Escolares.' : "I don't have prerequisites on record for these courses. Please check with Academic Services.")
      }
      if (facts.notes.includes('no-results')) lines.push(RESOURCE[facts.language])
      const context = contextLine(facts, profile)
      if (context) lines.push(context)
      const missing = facts.notes.includes('no-profile') ? missingLine(facts) : undefined
      if (missing) lines.push(missing)
      break
    }
  }

  return { content: lines.join('\n'), suggestions: suggestionsFor(facts.intent, facts.language), sources: sourcesFor(facts) }
}
