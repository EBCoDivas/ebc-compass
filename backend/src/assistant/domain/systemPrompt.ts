import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Read once per graph construction. Language and student data stay outside this stable prefix. */
export function loadSystemPrompt(directory = process.env.ASSISTANT_PROMPTS_DIR ?? fileURLToPath(new URL('../../../prompts/', import.meta.url))): string {
  const filename = join(directory, 'assistant.md')
  const content = readFileSync(filename, 'utf8').trim()
  if (!content) throw new Error(`El prompt del asistente está vacío: ${filename}`)
  return content
}
