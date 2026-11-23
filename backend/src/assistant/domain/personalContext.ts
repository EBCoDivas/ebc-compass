import { normalize } from './text.js'
import type { MemoryFact, MemoryKey } from '../conversations/repository.js'
import type { Language } from '../types.js'

/** Consultas sobre el propio contexto; se evalúan después de los bloqueos de seguridad. */
export function personalContextQuery(text: string): 'goal' | 'schedule' | 'all' | undefined {
  const value = normalize(text).replace(/^(?:y |and )/, '')
  if (/^(?:en que (?:quiero|queria) trabajar|(?:cual es|que es) mi (?:meta|objetivo)(?: profesional)?|what (?:do i|did i) want to (?:work in|do for work)|what is my (?:career )?goal)$/.test(value)) return 'goal'
  if (/^(?:que horario tengo|cual es mi (?:horario|disponibilidad)|cuando (?:puedo|estoy disponible)|what is my (?:schedule|availability))$/.test(value)) return 'schedule'
  if (/^(?:que (?:recuerdas|sabes) de mi|que (?:te dije|te pedi recordar)|what do you (?:remember|know) about me|what did i (?:tell you|ask you to remember))$/.test(value)) return 'all'
  return undefined
}

const labels: Partial<Record<MemoryKey, [string, string]>> = {
  goal: ['Meta', 'Goal'], schedule: ['Disponibilidad', 'Availability'], workSchedule: ['Trabajo', 'Work'], interests: ['Intereses', 'Interests'],
  career: ['Carrera', 'Program'], campus: ['Campus', 'Campus'], semester: ['Periodo', 'Term'],
  modality: ['Modalidad', 'Modality'], language: ['Idioma', 'Language'],
}
const values: Record<string, [string, string]> = {
  'banking-internship': ['Prácticas en banca', 'Banking internship'], 'marketing-internship': ['Prácticas en marketing', 'Marketing internship'],
  'professional-certification': ['Certificación profesional', 'Professional certification'], entrepreneurship: ['Emprender', 'Entrepreneurship'],
  mornings: ['Mañanas', 'Mornings'], afternoons: ['Tardes', 'Afternoons'], evenings: ['Noches', 'Evenings'], weekends: ['Fines de semana', 'Weekends'],
  'works-afternoons': ['Trabajas por las tardes', 'You work in the afternoons'],
  es: ['Español', 'Spanish'], en: ['Inglés', 'English'], online: ['En línea', 'Online'], 'in-person': ['Presencial', 'In person'], hybrid: ['Híbrida', 'Hybrid'],
}
export function personalContextReply(query: 'goal' | 'schedule' | 'all', memories: MemoryFact[], language: Language): string {
  const es = language === 'es'
  const facts = memories.filter(fact => !fact.suppressed && fact.value &&
    (query === 'all' || fact.key === query || (query === 'schedule' && fact.key === 'workSchedule') || fact.key.startsWith('note:')))
  if (!facts.length) return es
    ? query === 'goal' ? 'Aún no tengo registrada tu meta profesional. ¿En qué área te gustaría trabajar?' : query === 'schedule' ? 'Aún no tengo registrada tu disponibilidad. ¿Qué horario te conviene?' : 'Aún no tengo recuerdos guardados sobre ti. Puedes pedirme que recuerde tu meta o disponibilidad.'
    : query === 'goal' ? 'I do not have your career goal saved yet. What field would you like to work in?' : query === 'schedule' ? 'I do not have your availability saved yet. What schedule works for you?' : 'I do not have any saved memories about you yet. You can ask me to remember your goal or availability.'
  return (es ? 'Esto es lo que tengo guardado sobre ti:\n\n' : 'Here is what I have saved about you:\n\n') + facts.map(fact => {
    const label = fact.key.startsWith('note:') ? (es ? 'Nota' : 'Note') : labels[fact.key]?.[es ? 0 : 1] ?? fact.key
    const value = fact.key.startsWith('note:') ? fact.value : fact.value.split(',').map(part => values[part]?.[es ? 0 : 1] ?? part).join(', ')
    return '- ' + label + ': ' + value
  }).join('\n') + (es ? '\n\nPuedes corregir u olvidar estos datos en “Lo que Compass recuerda”.' : '\n\nYou can edit or forget these details in the memory panel.')
}
