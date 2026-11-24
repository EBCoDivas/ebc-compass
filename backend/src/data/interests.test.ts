import '../testing/seedCatalog.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalize } from '../assistant/domain/text.js'
import { programs } from './academic.js'
import { catalogSeed as opportunities } from '../banner/catalog/seed.js'

const interests = JSON.parse(readFileSync(new URL('../../../shared/interests.json', import.meta.url), 'utf8')) as {
  general: string[]; careers: Record<string, string[]>
}
const personas = JSON.parse(readFileSync(new URL('../../../shared/personas.json', import.meta.url), 'utf8')) as {
  id: string; career: string; interests: string[]; hasProfile: boolean
}[]

// El motor de recomendaciones puntúa si el interés aparece en el título o la descripción (recommendations.ts).
const matches = (interest: string, careerId?: string) => opportunities.filter(item =>
  (!careerId || item.career.includes(careerId)) && normalize(`${item.title} ${item.description}`).includes(normalize(interest)))

test('cada carrera con intereses propios existe en el catálogo académico', () => {
  const known = new Set<string>(programs.map(program => program.value))
  for (const career of Object.keys(interests.careers)) assert.ok(known.has(career), career)
})

test('cada interés sugerido coincide con al menos una oportunidad de su carrera', () => {
  for (const [career, list] of Object.entries(interests.careers)) {
    for (const interest of list) assert.ok(matches(interest, career).length > 0, `${interest} (${career}) no coincide con ninguna oportunidad`)
  }
})

test('cada interés general coincide con al menos una oportunidad del catálogo', () => {
  for (const interest of interests.general) assert.ok(matches(interest).length > 0, `${interest} no coincide con ninguna oportunidad`)
})

test('las listas no repiten intereses y caben en el máximo del perfil', () => {
  for (const [career, list] of Object.entries(interests.careers)) {
    const all = [...list, ...interests.general.filter(item => !list.includes(item))].map(normalize)
    assert.equal(new Set(all).size, all.length, career)
    assert.ok(all.length <= 10, career)
  }
})

test('los intereses precargados de las cuentas demo son opciones de su carrera y puntúan en su catálogo', () => {
  for (const persona of personas.filter(item => item.hasProfile)) {
    const options = new Set([...(interests.careers[persona.career] ?? []), ...interests.general])
    for (const interest of persona.interests) {
      assert.ok(options.has(interest), `${persona.id}: ${interest} no es una opción de ${persona.career}`)
      assert.ok(matches(interest, persona.career).length > 0 || matches(interest).length > 0, `${persona.id}: ${interest}`)
    }
  }
})
