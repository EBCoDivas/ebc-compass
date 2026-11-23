import { describe, expect, it } from 'vitest'
import { interestOptionsFor, interestSuggestions } from './interests'

describe('intereses por carrera', () => {
  it('ofrece primero los de la carrera y después los generales', () => {
    const accounting = interestOptionsFor('accounting')
    expect(accounting.slice(0, 2)).toEqual(['Impuestos', 'Contabilidad'])
    expect(accounting).toContain('Beca')
  })

  it('las carreras de la demo reciben opciones distintas', () => {
    expect(interestOptionsFor('marketing')).toContain('Marketing digital')
    expect(interestOptionsFor('marketing')).not.toContain('Impuestos')
    expect(interestOptionsFor('law')).toContain('Titulación')
    expect(interestOptionsFor('law')).not.toContain('Marca')
  })

  it('una carrera sin lista propia o sin carrera usa solo los generales', () => {
    expect(interestOptionsFor('tourism')).toEqual(['Beca', 'Prácticas', 'Análisis de datos'])
    expect(interestOptionsFor()).toEqual(['Beca', 'Prácticas', 'Análisis de datos'])
  })

  it('sugiere al escribir, sin acentos ni mayúsculas y sin repetir lo elegido', () => {
    expect(interestSuggestions('accounting', 'auditoria', [])).toEqual(['Auditoría'])
    expect(interestSuggestions('accounting', 'IMP', ['impuestos'])).toEqual([])
    expect(interestSuggestions('law', 'ju', [])).toEqual(['Clínica jurídica', 'Expedientes jurídicos'])
    expect(interestSuggestions('law', '  ', [])).toEqual([])
  })
})
