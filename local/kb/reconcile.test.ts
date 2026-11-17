import { test } from 'node:test'
import { deepEqual } from 'node:assert/strict'
import { reconcile } from './reconcile.js'
test('remote inventory reuses unchanged documents and retires duplicates and stale versions', () => {
  const docs = [{ id: 'doc', path: 'doc.md', sha256: 'new' }]
  const remote = [['keep', 'new'], ['duplicate', 'new'], ['old', 'old']].map(([id, sha256]) => ({
    id, status: 'completed' as const, attributes: { id: 'doc', sha256, simulated: true },
  }))
  deepEqual(reconcile(docs, remote), {
    files: { 'doc.md': { fileId: 'keep', sha256: 'new' } },
    retired: ['duplicate', 'old'],
  })
  deepEqual(reconcile([], remote).retired, ['keep', 'duplicate', 'old'])
})
