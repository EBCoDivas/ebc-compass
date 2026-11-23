import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CHUNK_MAX_TOKENS, chunkDocument, chunkText, estimateTokens, toS3VectorsFilter } from './vectors.js'

describe('fragmentos (estrategia por omisión de Bedrock)', () => {
  const sentence = (n: number) => `Oración número ${n} con información de la demo para el alumno. `

  it('un texto de 300 tokens o menos no se divide y conserva el front-matter', () => {
    const text = '---\nid: becas\nlanguage: es\n---\n# Becas\n\nUna beca demo. Otra línea.\n'
    assert.deepEqual(chunkText(text), [text.trim()])
    assert.deepEqual(chunkDocument('becas.md', text).map((chunk) => chunk.key), ['becas.md#0'])
  })

  it('parte un texto largo en fragmentos de unos 300 tokens que terminan en una oración completa', () => {
    const text = Array.from({ length: 60 }, (_, i) => sentence(i)).join('')
    const chunks = chunkText(text)
    assert.ok(chunks.length > 1)
    for (const chunk of chunks) {
      assert.ok(estimateTokens(chunk) <= CHUNK_MAX_TOKENS, `mide ${estimateTokens(chunk)} tokens`)
      assert.match(chunk, /\.$/, 'termina en un límite de oración')
    }
  })

  it('traslapa fragmentos contiguos y no pierde ninguna oración', () => {
    const sentences = Array.from({ length: 60 }, (_, i) => sentence(i).trim())
    const chunks = chunkText(sentences.join(' '))
    for (const item of sentences) assert.ok(chunks.some((chunk) => chunk.includes(item)), `falta: ${item}`)
    const repeated = sentences.filter((item) => chunks.filter((chunk) => chunk.includes(item)).length > 1)
    assert.ok(repeated.length > 0, 'debe haber traslape')
    assert.ok(repeated.length <= chunks.length * 3, 'el traslape no debe exceder ~20 %')
  })

  it('respeta los saltos de línea y parte una oración más larga que un fragmento', () => {
    const lines = Array.from({ length: 80 }, (_, i) => `- Requisito ${i} del trámite sin punto final`).join('\n')
    for (const chunk of chunkText(lines)) assert.ok(!chunk.startsWith('quisito') && estimateTokens(chunk) <= CHUNK_MAX_TOKENS)
    const long = 'palabra '.repeat(500)
    assert.ok(chunkText(long).every((chunk) => estimateTokens(chunk) <= CHUNK_MAX_TOKENS))
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
