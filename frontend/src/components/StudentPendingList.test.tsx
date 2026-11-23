import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import type { StudentJourney } from '../../../shared/contracts/studentPlanning'
import { StudentPendingList } from './StudentPendingList'

it('shows the current route and distinguishes a generated slip from a completed payment', () => {
  const dueDate = '2026-12-01'
  const payment = { opportunityId: 'procedure-first-enrollment-payment', dueDate, status: 'in-progress' as const }
  const planning: StudentJourney = {
    stage: 'entry',
    catalog: [{
      id: payment.opportunityId, title: 'Pago de inscripción', description: 'Consulta la tarifa de inscripción.',
      type: 'procedure', stage: 'entry', career: ['accounting'], campus: ['QRO'], level: ['licenciatura'], simulated: true,
    }],
    pending: [payment],
    route: [{ ...payment, required: true, overdue: false, nextStep: 'Revisa la fecha límite de tu ficha.' }],
    achievements: [{ id: 'payment-slip-generated', earned: true }, { id: 'scholarship-requested', earned: false }],
    calculations: {},
  }
  const html = renderToStaticMarkup(<MemoryRouter><StudentPendingList planning={planning} /></MemoryRouter>)
  expect(html).toContain('Lo que te toca ahora')
  expect(html).toContain('route-step is-in-progress is-required')
  expect(html).toContain('Obligatorio</span><span class="route-status">En curso')
  expect(html).toContain('Tienes <strong>1 obligatorio</strong> por resolver')
  expect(html).toContain('Revisa la fecha límite de tu ficha.')
  expect(html).toContain('Ficha de pago generada</strong><small>Desbloqueado')
  expect(html).toContain('Beca solicitada</strong><small>Por alcanzar')
  expect(html).not.toContain('Completado')
})
