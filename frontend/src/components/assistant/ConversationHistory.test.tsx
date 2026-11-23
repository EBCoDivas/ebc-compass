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

describe('confirmación de trámites', () => {
  it('pide subir la carta de motivos antes de poder enviar la solicitud de beca', () => {
    const html = render({ id: 'scholarship', role: 'assistant', content: 'Revisa tu solicitud.',
      actionProposal: { id: 'request', conversationId: 'conversation', kind: 'request-scholarship', requiresMotivationLetter: true, dueDate: '2026-11-26' } })
    expect(html).toContain('Sube tu carta de motivos')
    expect(html).toContain('PDF o Word, hasta 1.5 MB')
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Enviar solicitud<\/button>/)
  })

  it('muestra el importe y la tarjeta registrada antes de pagar, sin mezclar la beca ni hablar de simulación', () => {
    const html = render({ id: 'payment', role: 'assistant', content: 'Revisa tu pago.',
      actionProposal: { id: 'request', conversationId: 'conversation', kind: 'pay-enrollment',
        payment: { amount: 4800, currency: 'MXN', dueDate: '2026-12-01' },
        paymentMethod: { brand: 'Visa', last4: '4242', holder: 'ANA LUCÍA TORRES', expires: '08/29' } } })
    expect(html).toContain('4,800')
    expect(html).not.toMatch(/beca/i)
    expect(html).toContain('Tarjeta Visa terminación 4242')
    expect(html).toContain('Pagar $4,800.00')
    expect(html).not.toMatch(/simulad/i)
    expect(html).not.toContain('Comprobante')
  })
})
