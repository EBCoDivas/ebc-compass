import { describe, expect, it } from 'vitest'
import type { Opportunity } from '../services/opportunityService'
import { calendarEntries, savedOutsideRoute } from './calendarEntries'

const item = (id: string, deadline?: string) => ({ id, title: id, deadline, type: 'course', description: '', career: [] }) as unknown as Opportunity

describe('lo guardado frente a la ruta', () => {
  it('lo que ya está en la ruta, obligatorio u opcional, no cuenta como guardado', () => {
    expect(savedOutsideRoute(['beca', 'curso', 'pago'], ['beca', 'pago'])).toEqual(['curso'])
    expect(savedOutsideRoute([], ['beca'])).toEqual([])
    expect(savedOutsideRoute(['curso'], [])).toEqual(['curso'])
  })
})

describe('capas del calendario', () => {
  const catalog = [item('payment', '2026-12-01'), item('course', '2026-12-04'), item('event', '2026-11-30'), item('no-date')]

  it('separa lo que te toca, lo guardado y el resto, sin repetir y en orden de fecha', () => {
    const entries = calendarEntries(catalog, [{ opportunityId: 'payment', dueDate: '2026-12-01', required: true }], ['course', 'payment'])
    expect(entries.map(entry => [entry.item.id, entry.layer])).toEqual([['event', 'more'], ['payment', 'route'], ['course', 'saved']])
    expect(entries.find(entry => entry.layer === 'route')?.required).toBe(true)
  })

  it('usa la fecha de la ruta y omite guardadas que ya no están en el catálogo', () => {
    const entries = calendarEntries(catalog, [{ opportunityId: 'payment', dueDate: '2026-12-15', required: false }], ['missing'])
    expect(entries.find(entry => entry.item.id === 'payment')?.date).toBe('2026-12-15')
    expect(entries.some(entry => entry.item.id === 'missing')).toBe(false)
  })
})
