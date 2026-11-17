import { AssistantError } from '../types/assistant'
export interface StreamEvent { event: string; data: Record<string, unknown> }

/** Decodifica UTF-8 incrementalmente y conserva frames divididos entre lecturas. */
export async function readAssistantEvents(body: ReadableStream<Uint8Array>, consume: (event: StreamEvent) => void) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let ended = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      if (buffer.length > 256000) throw new AssistantError('La respuesta de Compass es demasiado grande.')
      let match: RegExpExecArray | null
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)
        let event = 'message'
        const data: string[] = []
        for (const line of frame.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
        }
        if (data.length) consume({ event, data: JSON.parse(data.join('\n')) as Record<string, unknown> })
      }
      if (done) { ended = true; break }
    }
    if (buffer.trim()) throw new AssistantError('La respuesta llegó incompleta. Puedes reintentar.')
  } finally {
    if (!ended) await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
