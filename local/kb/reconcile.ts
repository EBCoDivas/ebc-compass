import type { VectorStoreFile } from 'openai/resources/vector-stores/files'

export function reconcile(docs: { id: string; path: string; sha256: string }[], managed: Pick<VectorStoreFile, 'id' | 'status' | 'attributes'>[]) {
  const state = { files: {} as Record<string, { fileId: string; sha256: string }> }
  const retired: string[] = []
  for (const file of managed) {
    const doc = docs.find(d => d.id === file.attributes?.id)
    if (doc && file.status === 'completed' && file.attributes?.sha256 === doc.sha256 && !state.files[doc.path]) {
      state.files[doc.path] = { fileId: file.id, sha256: doc.sha256 }
    } else retired.push(file.id)
  }
  return { files: state.files, retired }
}
