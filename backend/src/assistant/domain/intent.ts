import type { Classification, Focus, Intent, OpportunityType } from '../types.js'
import { CAREER_WORDS, FOCUS_DEADLINE, FOCUS_REQUIREMENTS, FOLLOW_UP_INTENTS, INTENT_PHRASES, INTENT_WORDS } from './lexicon.js'
import { fuzzyEquals, tokenize } from './text.js'

// Palabras que indican una consulta general de fechas (no un seguimiento sobre el tema anterior).
const GENERAL_DATES = ['upcoming', 'proxima', 'proximas', 'proximo', 'proximos', 'calendario', 'calendar', 'importantes', 'important', 'vienen', 'coming', 'dates', 'fechas']

const THRESHOLD = 2

type Scored = Exclude<Intent, 'unknown'>
const PRIORITY: Scored[] = [
  'course-info', 'scholarship-info', 'procedure-info', 'event-info', 'career-info', 'recommendation-request', 'deadline-query', 'profile-help', 'help', 'greeting',
]

export interface ClassifyContext {
  /** Intent del turno anterior de la conversación (para seguimientos). */
  lastIntent?: Intent
  /** Se detectó un código de curso o un título del catálogo en el mensaje. */
  hasCourseCode: boolean
  entityTypes: OpportunityType[]
}

export function detectFocus(tokens: string[]): Focus | undefined {
  if (tokens.some((t) => FOCUS_DEADLINE.some((w) => fuzzyEquals(t, w)))) return 'deadline'
  if (tokens.some((t) => FOCUS_REQUIREMENTS.some((w) => fuzzyEquals(t, w)))) return 'requirements'
  return undefined
}

/**
 * Clasifica el mensaje con léxico ponderado y coincidencia aproximada (RF-05.4).
 * Por debajo del umbral devuelve `unknown`; los seguimientos cortos heredan el intent anterior.
 */
export function classifyIntent(normalized: string, context: ClassifyContext): Classification {
  const tokens = tokenize(normalized)
  const scores = new Map<Scored, number>()
  const add = (intent: Scored, amount: number) => scores.set(intent, (scores.get(intent) ?? 0) + amount)

  for (const intent of PRIORITY) {
    for (const cue of INTENT_WORDS[intent]) {
      if (tokens.some((token) => fuzzyEquals(token, cue.word))) add(intent, cue.weight)
    }
    for (const cue of INTENT_PHRASES[intent]) {
      if (` ${normalized} `.includes(` ${cue.word.normalize('NFD').replace(/[̀-ͯ]/g, '')} `)) add(intent, cue.weight)
    }
  }

  // Las entidades reconocidas orientan el tema ("FIN-301" -> curso; "Beca Santander" -> beca).
  if (context.hasCourseCode) add('course-info', 3)
  for (const type of context.entityTypes) {
    if (type === 'course') add('course-info', 2)
    if (type === 'scholarship') add('scholarship-info', 2)
    if (type === 'event') add('event-info', 2)
    if (type === 'procedure') add('procedure-info', 2)
    if (type === 'professional-development' || type === 'career-opportunity') add('career-info', 2)
  }

  // Mencionar una carrera sin otra pista suma poco a recomendaciones ("¿qué hay para finanzas?").
  if (tokens.some((t) => t in CAREER_WORDS)) add('recommendation-request', 1)

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || PRIORITY.indexOf(a[0]) - PRIORITY.indexOf(b[0]))
  const [bestIntent, bestScore] = ranked[0] ?? ['help' as Scored, 0]
  const focus = detectFocus(tokens)

  // "deadline-query" ganó solo por palabras de fecha, pero el tema anterior era un tipo concreto: seguimiento.
  if (
    context.lastIntent &&
    FOLLOW_UP_INTENTS.includes(context.lastIntent) &&
    focus &&
    (bestScore < THRESHOLD || bestIntent === 'deadline-query') &&
    !context.hasCourseCode &&
    context.entityTypes.length === 0 &&
    !tokens.some((token) => GENERAL_DATES.includes(token)) &&
    tokens.length <= 6
  ) {
    return { intent: context.lastIntent, confidence: 0.6, focus }
  }

  if (bestScore < THRESHOLD) {
    if (context.lastIntent && FOLLOW_UP_INTENTS.includes(context.lastIntent) && focus) {
      return { intent: context.lastIntent, confidence: 0.55, focus }
    }
    return { intent: 'unknown', confidence: 0 }
  }

  const confidence = Math.min(0.99, bestScore / (bestScore + 2))
  return { intent: bestIntent, confidence, focus }
}
