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

describe('valoración de respuestas', () => {
  const answer: ChatEntry = { id: 'a1', role: 'assistant', content: 'Hay dos becas para tu carrera.' }
  const ratingButtons = (html: string) => html.match(/<button[^>]*aria-label="Respuesta (útil|poco útil)"[^>]*>/g) ?? []

  it('permite valorar una respuesta que aún no tiene valoración', () => {
    const buttons = ratingButtons(render(answer))
    expect(buttons).toHaveLength(2)
    buttons.forEach(button => expect(button).not.toContain('disabled'))
  })

  it('no deja volver a valorar una respuesta ya valorada', () => {
    const html = render({ ...answer, feedback: 'positive' })
    const buttons = ratingButtons(html)
    expect(buttons).toHaveLength(2)
    buttons.forEach(button => expect(button).toContain('disabled'))
    expect(buttons.find(button => button.includes('aria-pressed="true"'))).toContain('Respuesta útil')
    expect(html).toContain('tu valoración quedó guardada')
  })
})


describe('solicitudes bloqueadas', () => {
  it('muestra la orientación segura sin acciones de valoración ni reintento de generación', () => {
    const html = render({ id: 'blocked', role: 'assistant', content: 'No puedo revelar información interna.', inputBlock: { category: 'prompt-injection', source: 'local' } })
    expect(html).toContain('No puedo revelar información interna.')
    expect(html).not.toContain('Respuesta útil')
    expect(html).not.toContain('Reintentar')
  })
})
