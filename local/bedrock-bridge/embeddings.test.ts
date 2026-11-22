import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseTitanRequest } from './embeddings.js'

describe('embeddings con el contrato de Titan v2', () => {
  it('usa 1,024 dimensiones por omisión, como el índice del lab', () => {
    assert.deepEqual(parseTitanRequest('amazon.titan-embed-text-v2:0', { inputText: ' Becas ' }), { text: 'Becas', dimensions: 1024 })
  })

  it('acepta las dimensiones de Titan v2', () => {
    assert.equal(parseTitanRequest('amazon.titan-embed-text-v2:0', { inputText: 'x', dimensions: 256 }).dimensions, 256)
  })

  it('rechaza otros modelos, texto vacío, dimensiones inválidas y vectores sin normalizar', () => {
    assert.throws(() => parseTitanRequest('cohere.embed-v4', { inputText: 'x' }), /titan-embed-text-v2/)
    assert.throws(() => parseTitanRequest('amazon.titan-embed-text-v2:0', { inputText: '  ' }), /inputText/)
    assert.throws(() => parseTitanRequest('amazon.titan-embed-text-v2:0', { inputText: 'x', dimensions: 1536 }), /dimensions/)
    assert.throws(() => parseTitanRequest('amazon.titan-embed-text-v2:0', { inputText: 'x', normalize: false }), /normalizados/)
  })
})
