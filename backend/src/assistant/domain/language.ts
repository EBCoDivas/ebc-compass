import type { Language } from '../types.js'
import { normalize, tokenize } from './text.js'

// Palabras muy frecuentes que no existen (o casi) en el otro idioma. Se compara por token completo.
const SPANISH = new Set([
  'que', 'como', 'cuando', 'donde', 'cual', 'cuales', 'quien', 'porque', 'para', 'con', 'los', 'las', 'una', 'del', 'mi', 'mis',
  'tengo', 'quiero', 'puedo', 'hay', 'esta', 'estan', 'es', 'son', 'hola', 'gracias', 'por', 'favor', 'beca', 'becas', 'curso',
  'cursos', 'materia', 'materias', 'tramite', 'tramites', 'fecha', 'fechas', 'carrera', 'semestre', 'recomiendas', 'ayuda',
  'dime', 'necesito', 'sobre', 'proximos', 'proximas', 'eventos', 'perfil', 'reinscribo', 'solicito', 'requisitos',
])
const ENGLISH = new Set([
  'what', 'how', 'when', 'where', 'which', 'who', 'why', 'the', 'and', 'for', 'with', 'my', 'is', 'are', 'can', 'could', 'should',
  'do', 'does', 'have', 'hello', 'hi', 'thanks', 'please', 'scholarship', 'scholarships', 'course', 'courses', 'subject', 'procedure',
  'procedures', 'deadline', 'deadlines', 'career', 'semester', 'recommend', 'recommendations', 'help', 'tell', 'need', 'about',
  'upcoming', 'events', 'profile', 'enroll', 'apply', 'requirements', 'you', 'your', 'there', 'any',
])

/** Detecta español o inglés por tokens. Ambiguo -> idioma de respaldo (el de la conversación o español). */
export function detectLanguage(text: string, fallback: Language = 'es'): Language {
  const tokens = tokenize(normalize(text))
  let es = 0
  let en = 0
  for (const token of tokens) {
    if (SPANISH.has(token)) es += 1
    if (ENGLISH.has(token)) en += 1
  }
  if (/[¿¡]/.test(text)) es += 2
  if (/[áéíóúñü]/i.test(text)) es += 1
  if (es === en) return fallback
  return es > en ? 'es' : 'en'
}
