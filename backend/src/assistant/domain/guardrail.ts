// Validación de la salida del LLM: solo se acepta si cumple el idioma y no introduce datos que no estén en
// la hoja de hechos, el perfil o los documentos. Si falla, el asistente informa el rechazo.

import type { Language } from '../types.js'
import { detectLanguage } from './language.js'

export interface GuardrailResult {
  ok: boolean
  reason?: string
}

const MAX_LENGTH = 1500
const LEAKS = ['<DATOS>', '<PERFIL>', '<DOCUMENTOS>', '<PREGUNTA>', 'DATOS>', 'ÚNICAMENTE la información de los bloques', 'ONLY the information in the']

const compact = (text: string) => text.toUpperCase().replace(/\s+/g, '')

export function validateGeneration(text: string, context: { language: Language; allowed: string }): GuardrailResult {
  const output = text.trim()
  if (output.length === 0) return { ok: false, reason: 'respuesta vacía' }
  if (output.length > MAX_LENGTH) return { ok: false, reason: 'respuesta demasiado larga' }
  if (LEAKS.some((marker) => output.includes(marker))) return { ok: false, reason: 'filtra instrucciones internas' }
  if (detectLanguage(output, context.language) !== context.language) return { ok: false, reason: 'idioma distinto al de la pregunta' }

  const allowed = compact(context.allowed)
  const patterns: [RegExp, string][] = [
    [/\b[A-Za-z]{3}-\d{3}\b/g, 'código de curso'],
    [/\b\d{2}\/\d{2}\/\d{4}\b/g, 'fecha'],
    [/\$\s?\d[\d,]*(?:\.\d+)?/g, 'monto'],
    [/\b\d+(?:\.\d+)?\s?%/g, 'porcentaje'],
    [/\b\d+\.\d+\b/g, 'cifra decimal'],
  ]
  for (const [pattern, label] of patterns) {
    for (const match of output.match(pattern) ?? []) {
      if (!allowed.includes(compact(match))) return { ok: false, reason: `${label} no respaldado: ${match}` }
    }
  }
  return { ok: true }
}
