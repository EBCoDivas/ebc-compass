import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ConversationHistory } from './ConversationHistory'
import type { ChatEntry } from '../../types/assistant'

function render(entry: ChatEntry) {
  return renderToStaticMarkup(<ConversationHistory entries={[entry]} pending={false} onRetry={() => {}} onPickSuggestion={() => {}} />)
}

describe('fallos del asistente', () => {
  it('muestra el error y Reintentar; mantiene el catálogo cerrado y sin feedback del modelo', () => {
    const html = render({ id: 'failed', role: 'assistant', content: 'No pudimos generar la respuesta en este momento.',
      failure: 'MODEL_UNAVAILABLE', meta: { mode: 'error', degraded: true, latencyMs: 20 },
      catalogFallback: { content: 'Oportunidad demo', sources: [{ kind: 'opportunity', id: 'demo', title: 'Demo' }] } })
    expect(html).toContain('No pudimos generar')
    expect(html).toContain('Reintentar')
    expect(html).toContain('Ver oportunidades del catálogo')
    expect(html).toMatch(/<details class="chat-catalog-fallback">/)
    expect(html).toContain('No son una respuesta generada por IA')
    expect(html).not.toContain('Respuesta útil')
    expect(html).not.toContain('Copiar respuesta')
    expect(html).not.toContain('respondí con reglas básicas')
  })

  it('distingue un rechazo de validación y no ofrece catálogo cuando no hay resultados', () => {
    const html = render({ id: 'invalid', role: 'assistant', failure: 'VALIDATION_FAILED', content: 'No pudimos verificar la respuesta generada.' })
    expect(html).toContain('No pudimos verificar')
    expect(html).toContain('Reintentar')
    expect(html).not.toContain('Ver oportunidades del catálogo')
    expect(html).not.toContain('Respuesta útil')
  })
})
