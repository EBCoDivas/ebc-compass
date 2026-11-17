import test from 'node:test'
import assert from 'node:assert/strict'
import { extractEntities } from './entities.js'
import { normalize } from './text.js'

test('specific program names take precedence over generic finance and business words', () => {
  for (const [name, expected] of [
    ['Comercio y Negocios Internacionales', 'international-business'],
    ['Maestría en Dirección Financiera', 'financial-management'],
    ['Administración de Negocios Turísticos', 'tourism'],
    ['Programación y Transformación Digital', 'digital-transformation'],
    ['Contaduría', 'accounting'], ['Derecho', 'law'],
    ['Administración de Negocios de la Comunicación y el Entretenimiento', 'communication-entertainment'],
  ]) assert.deepEqual(extractEntities(normalize('¿Qué cursos hay para ' + name + '?'), []).careers, [expected])
})
