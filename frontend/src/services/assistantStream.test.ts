import { describe, it, expect } from 'vitest'
import { readAssistantEvents, type StreamEvent } from './assistantStream'

function bytes(text: string, size = 1) {
  const encoded = new TextEncoder().encode(text)
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (let i = 0; i < encoded.length; i += size) controller.enqueue(encoded.slice(i, i + size))
    controller.close()
  } })
}
describe('assistant SSE parser', () => {
  it('decodes split UTF-8, CRLF, comments and multi-line data without losing events', async () => {
    const events: StreamEvent[] = []
    await readAssistantEvents(bytes(': heartbeat\r\n\r\nevent: token\r\ndata: {"text":\r\ndata: "Mañana 📚"}\r\n\r\nevent: done\ndata: {"finished":true}\n\n'), event => events.push(event))
    expect(events).toEqual([{ event: 'token', data: { text: 'Mañana 📚' } }, { event: 'done', data: { finished: true } }])
  })
  it('rejects a truncated frame instead of treating a partial response as successful', async () => {
    await expect(readAssistantEvents(bytes('event: token\ndata: {"text":"partial"}'), () => {})).rejects.toThrow()
  })
})
