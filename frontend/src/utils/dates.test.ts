import { describe, expect, it } from 'vitest'
import { daysLabel, daysUntil, formatDate, formatShortDate, urgencyFor } from './dates'

describe('fechas', () => {
  it('formatea como dd/MM/aaaa', () => expect(formatDate('2026-12-15')).toBe('15/12/2026'))
  it('formatea fecha corta', () => {
    expect(formatShortDate('2026-12-04', new Date('2026-11-16T10:00:00'))).toBe('4 dic')
    expect(formatShortDate('2027-01-15', new Date('2026-11-16T10:00:00'))).toBe('15 ene 2027')
  })
  it('calcula días restantes', () => expect(daysUntil('2026-11-20', new Date('2026-11-16T10:00:00').getTime())).toBe(5))
  it('clasifica urgencia', () => {
    expect(urgencyFor(2)).toBe('urgent')
    expect(urgencyFor(7)).toBe('soon')
    expect(urgencyFor(8)).toBe('future')
  })
  it('redacta etiquetas', () => {
    expect(daysLabel(-1)).toBe('Vencida')
    expect(daysLabel(0)).toBe('Hoy')
    expect(daysLabel(1)).toBe('Falta 1 día')
    expect(daysLabel(5)).toBe('Faltan 5 días')
  })
})
