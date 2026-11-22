import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chunkDocument, toS3VectorsFilter } from './vectors.js'

describe('fragmentos', () => {
  const body = '# Becas\n\n> Demo.\n\n## Beca BEA\nRequisitos de la beca.\n\n## Beca BRE\nDescuentos entre 10% y 40%.\n'

  it('divide por secciones y conserva el título del documento y de la sección', () => {
    const chunks = chunkDocument('becas.md', 'Becas demo', body)
    assert.deepEqual(chunks.map((chunk) => chunk.key), ['becas.md#0', 'becas.md#1', 'becas.md#2'])
    assert.equal(chunks[1].text, 'Becas demo · Beca BEA\nRequisitos de la beca.')
    assert.match(chunks[2].text, /^Becas demo · Beca BRE\n/)
  })

  it('parte una sección larga por párrafos sin perder texto', () => {
    const paragraphs = Array.from({ length: 6 }, (_, i) => `Párrafo ${i} ${'x'.repeat(400)}`)
    const chunks = chunkDocument('largo.md', 'Largo', `## Sección\n${paragraphs.join('\n\n')}`)
    assert.ok(chunks.length > 1)
    for (const chunk of chunks) assert.ok(chunk.text.length <= 1200, `${chunk.key} mide ${chunk.text.length}`)
    for (const paragraph of paragraphs) assert.ok(chunks.some((chunk) => chunk.text.includes(paragraph)))
  })
})

describe('filtros de Retrieve a S3 Vectors', () => {
  it('traduce igualdad, desigualdad e inclusión', () => {
    assert.deepEqual(toS3VectorsFilter({ equals: { key: 'language', value: 'es' } }), { language: { $eq: 'es' } })
    assert.deepEqual(toS3VectorsFilter({ notEquals: { key: 'topic', value: 'faq' } }), { topic: { $ne: 'faq' } })
    assert.deepEqual(toS3VectorsFilter({ in: { key: 'topic', value: ['a', 'b'] } }), { topic: { $in: ['a', 'b'] } })
  })

  it('traduce la combinación que usa el backend (idioma y tema)', () => {
    const filter = { andAll: [{ equals: { key: 'language', value: 'es' } }, { equals: { key: 'topic', value: 'scholarships' } }] }
    assert.deepEqual(toS3VectorsFilter(filter), { $and: [{ language: { $eq: 'es' } }, { topic: { $eq: 'scholarships' } }] })
  })

  it('sin filtro no restringe y rechaza lo desconocido', () => {
    assert.equal(toS3VectorsFilter(undefined), undefined)
    assert.throws(() => toS3VectorsFilter({}), /no soportado/)
  })
})
