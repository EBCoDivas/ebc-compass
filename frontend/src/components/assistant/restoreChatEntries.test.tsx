import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { restoreChatEntries } from './restoreChatEntries'
import { ConversationHistory } from './ConversationHistory'
import type { ChatEntry, StoredMessage } from '../../types/assistant'

const render = (entries: ChatEntry[]) => renderToStaticMarkup(<ConversationHistory entries={entries} pending={false} onRetry={() => {}} onPickSuggestion={() => {}} />)
describe('historial después de recargar', () => {
  it('conserva fuentes, sugerencias, tiempo y aviso de recuperación degradada', () => {
    const saved: StoredMessage = { id: 'answer', role: 'assistant', content: 'Consulta Servicios Escolares.', language: 'es', createdAt: '2026-11-16T12:00:00Z',
      sources: [{ kind: 'document', id: 'becas', title: 'Becas EBC' }], suggestions: ['¿Cuáles son los requisitos?'], mode: 'llm', latencyMs: 1234, degraded: true }
    const live: ChatEntry = { ...saved, meta: { mode: 'llm', latencyMs: 1234, degraded: true } }
    const restored = render(restoreChatEntries([saved]))
    expect(restored).toEqual(render([live]))
    expect(restored).toContain('Becas EBC')
    expect(restored).toContain('¿Cuáles son los requisitos?')
    expect(restored).toContain('1.2 s')
    expect(restored).toContain('No pudimos consultar los documentos')
  })
  it('no inventa tiempos para mensajes antiguos y preserva su contenido', () => {
    const saved: StoredMessage = { id: 'old', role: 'assistant', content: 'Hola', language: 'es', createdAt: '2026-11-16T12:00:00Z', suggestions: ['Ayuda'] }
    expect(restoreChatEntries([saved])[0].meta).toBeUndefined()
    expect(render(restoreChatEntries([saved]))).toContain('Ayuda')
  })
})
