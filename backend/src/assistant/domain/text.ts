// Utilidades de texto: normalización sin acentos, tokenización y coincidencia aproximada.

const STOPWORDS = new Set([
  // es
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'en', 'y', 'o', 'u', 'a', 'por', 'para', 'con', 'sin',
  'que', 'como', 'cual', 'cuales', 'es', 'son', 'se', 'me', 'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'lo', 'le', 'les', 'hay',
  'quiero', 'quisiera', 'puedo', 'puedes', 'saber', 'dime', 'necesito', 'sobre', 'acerca', 'favor', 'por',
  // en
  'the', 'an', 'of', 'to', 'in', 'on', 'and', 'or', 'for', 'with', 'is', 'are', 'what', 'which', 'how', 'do', 'does', 'i', 'my',
  'me', 'you', 'your', 'can', 'about', 'please', 'tell', 'want', 'need', 'there', 'any', 'be', 'it', 'this', 'that',
])

/** Minúsculas, sin acentos ni signos; conserva letras, números y guion (para códigos como fin-301). */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean)
}

export function isStopword(token: string): boolean {
  return STOPWORDS.has(token)
}

export function contentTokens(normalized: string): string[] {
  return tokenize(normalized).filter((token) => !isStopword(token))
}

/** Distancia de edición con transposiciones (Damerau-Levenshtein restringida) y corte anticipado. */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  let beforePrevious: number[] = []
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, beforePrevious[j - 2] + 1)
      current.push(value)
      if (value < rowMin) rowMin = value
    }
    if (rowMin > max) return max + 1
    beforePrevious = previous
    previous = current
  }
  return previous[b.length]
}

/** Coincidencia aproximada: exacta, o con 1 error en palabras de 5+ letras (tolera erratas y plurales). */
export function fuzzyEquals(token: string, word: string): boolean {
  if (token === word) return true
  if (token.length < 5 || word.length < 5) return false
  return editDistance(token, word, 1) <= 1
}

/** Fecha AAAA-MM-DD como día de calendario local (sin desfases de zona horaria). */
export function parseDay(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function daysBetween(from: Date, toDate: string): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  return Math.round((parseDay(toDate).getTime() - start) / 86_400_000)
}

export function formatDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}
