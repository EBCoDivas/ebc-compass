import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { StudentJourney } from '../../../shared/contracts/studentPlanning'
import { StudentAchievements } from './StudentAchievements'

const base: StudentJourney = { stage: 'entry', catalog: [], pending: [], route: [], achievements: [], calculations: {} }
const render = (planning: StudentJourney) => renderToStaticMarkup(<MemoryRouter><StudentAchievements planning={planning} /></MemoryRouter>)

describe('logros', () => {
  it('cuenta los desbloqueados y llena un segmento por cada uno', () => {
    const html = render({ ...base, achievements: [{ id: 'payment-slip-generated', earned: true }, { id: 'scholarship-requested', earned: false }] })
    expect(html).toContain('<strong>1</strong> de 2 desbloqueados')
    expect(html).toContain('aria-label="1 de 2 logros desbloqueados"')
    expect(html.match(/class="is-earned"/g)).toHaveLength(1)
  })

  it('un logro pendiente dice cómo desbloquearlo con Compass; uno desbloqueado no ofrece acción', () => {
    const html = render({ ...base, achievements: [{ id: 'payment-slip-generated', earned: true }, { id: 'scholarship-requested', earned: false }] })
    expect(html).toContain('achievement is-earned')
    expect(html).toContain('Ya tienes tu ficha para pagar la inscripción.')
    expect(html).toContain('achievement is-locked')
    expect(html).toContain('Envía tu solicitud de la beca de primer ingreso.')
    expect(html).toContain('Solicitar con Compass')
    expect(html).not.toContain('Generar con Compass')
  })

  it('el servicio social muestra sus horas reales en el anillo', () => {
    const html = render({ ...base, stage: 'closing', achievements: [{ id: 'social-service-progress', earned: true }],
      socialService: { completedHours: 260, requiredHours: 480, weeklyHours: 6, asOf: '2026-11-22', graduationDeadline: '2027-06-30' } })
    expect(html).toContain('--progress:54')
    expect(html).toContain('260 de 480 horas · 54 %')
  })

  it('los logros de una etapa anterior muestran su fecha y no se celebran como nuevos', () => {
    const html = render({ ...base, stage: 'closing', achievements: [{ id: 'scholarship-requested', earned: true, earnedAt: '2023-08-04' }] })
    expect(html).toContain('achievement is-earned is-past')
    expect(html).toContain('Desbloqueado el <time dateTime="2023-08-04">4 ago 2023</time>')
    expect(html).toContain('Solicitaste la beca de primer ingreso al comenzar tu carrera.')
    expect(html).not.toContain('Nuevo')
    expect(html).not.toContain('está en revisión')
  })

  it('cada logro tiene su propio ícono y todos llevan el sello de la brújula', () => {
    const html = render({ ...base, achievements: [{ id: 'payment-slip-generated', earned: true }, { id: 'scholarship-requested', earned: false }, { id: 'social-service-progress', earned: false }] })
    for (const id of ['payment-slip-generated', 'scholarship-requested', 'social-service-progress']) expect(html).toContain(`icon-${id}`)
    expect(html.match(/achievement-seal/g)).toHaveLength(3)
  })

  it('sin logros para la etapa no se muestra la sección', () => {
    expect(render({ ...base, stage: 'middle' })).toBe('')
  })
})
