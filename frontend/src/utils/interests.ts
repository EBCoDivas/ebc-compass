import interests from '../../../shared/interests.json'

const catalog = interests as { general: string[]; careers: Record<string, string[]> }
const MAX_SUGGESTIONS = 4

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Intereses que se ofrecen en el perfil: primero los de la carrera y después los generales, sin repetir. */
export function interestOptionsFor(career?: string): string[] {
  return [...new Set([...(career ? catalog.careers[career] ?? [] : []), ...catalog.general])]
}

/** Sugerencias mientras la persona escribe un interés propio: salen de la misma lista y excluyen lo ya elegido. */
export function interestSuggestions(career: string | undefined, typed: string, selected: string[]): string[] {
  const text = normalize(typed)
  if (!text) return []
  const chosen = new Set(selected.map(normalize))
  return interestOptionsFor(career).filter((option) => normalize(option).includes(text) && !chosen.has(normalize(option))).slice(0, MAX_SUGGESTIONS)
}
