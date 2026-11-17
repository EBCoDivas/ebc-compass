import type { AssistantOpportunity, CareerId, Entities } from '../types.js'
import { CAREER_PHRASES, CAREER_WORDS } from './lexicon.js'
import { contentTokens, fuzzyEquals, normalize, tokenize } from './text.js'

/** Misma palabra con erratas o misma raíz (p. ej. reinscribo ~ reinscripcion). */
function similar(token: string, word: string): boolean {
  if (fuzzyEquals(token, word)) return true
  if (token.length < 7 || word.length < 7) return false
  let common = 0
  while (common < token.length && common < word.length && token[common] === word[common]) common += 1
  return common >= 7
}

const COURSE_CODE = /\b([a-z]{3})[\s-]?(\d{3})\b/g

/** Extrae códigos de curso, oportunidades del catálogo (por título aproximado) y carreras mencionadas. */
export function extractEntities(normalized: string, catalog: AssistantOpportunity[]): Entities {
  const courseCodes = new Set<string>()
  for (const match of normalized.matchAll(COURSE_CODE)) courseCodes.add(`${match[1].toUpperCase()}-${match[2]}`)

  const queryTokens = contentTokens(normalized)
  // Palabras genéricas que no distinguen un título de otro.
  const generic = new Set(['beca', 'curso', 'evento', 'foro', 'siguiente', 'periodo', 'del', 'para', 'certificacion', 'practicas', 'profesionales', 'taller', 'feria', 'introduccion', 'academico'])
  const titleWords = (title: string) => contentTokens(normalize(title)).filter((token) => token.length > 2 && !generic.has(token))

  // En cuántos títulos aparece cada palabra: una palabra que aparece en uno solo identifica a esa oportunidad.
  const frequency = new Map<string, number>()
  for (const item of catalog) for (const word of new Set(titleWords(item.title))) frequency.set(word, (frequency.get(word) ?? 0) + 1)

  const opportunityIds: string[] = []
  for (const item of catalog) {
    if (item.code && courseCodes.has(item.code)) {
      opportunityIds.push(item.id)
      continue
    }
    const words = titleWords(item.title)
    if (words.length === 0) continue
    const hits = words.filter((word) => queryTokens.some((token) => similar(token, word)))
    const distinctive = hits.some((word) => frequency.get(word) === 1)
    if (distinctive || (hits.length >= 2 && hits.length / words.length >= 0.6)) opportunityIds.push(item.id)
  }

  const careers = new Set<CareerId>()
  const phrase = Object.entries(CAREER_PHRASES).sort(([a], [b]) => b.length - a.length)
    .find(([text]) => (' ' + normalized + ' ').includes(' ' + text + ' '))
  if (phrase) careers.add(phrase[1])
  for (const token of phrase ? [] : tokenize(normalized)) {
    const career = CAREER_WORDS[token]
    if (career) careers.add(career)
  }

  return { courseCodes: [...courseCodes], opportunityIds, careers: [...careers] }
}
