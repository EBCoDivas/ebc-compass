import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { inspectLetter } from './actions.js'

// Las cartas de ejemplo del repo son las que el jurado sube el día de la demostración.
for (const name of ['carta-de-motivos-ana-torres.pdf', 'carta-de-motivos-ana-torres.docx']) {
  test('the demo letter ' + name + ' passes the Banner checks', () => {
    const file = readFileSync(fileURLToPath(new URL('../../../docs/demo/' + name, import.meta.url)))
    const result = inspectLetter({ name, contentBase64: file.toString('base64') })
    assert.equal(result?.name, name)
    assert.equal(result?.size, file.length)
    assert.match(result?.sha256 ?? '', /^[a-f0-9]{64}$/)
  })
}
