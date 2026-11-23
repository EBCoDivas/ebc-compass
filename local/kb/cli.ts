// Gestión del corpus de conocimiento (knowledge/).
//
//   npm run kb:index      equivalente local de `lab:knowledge`: kb:sync-s3 y luego kb:ingest. Lo ejecuta `npm run dev`.
//   npm run kb:ingest     hace el papel de StartIngestionJob: lee el bucket, fragmenta (estrategia por omisión de Bedrock),
//                         genera embeddings con Titan v2 (a través del puente) y escribe los vectores en S3 Vectors.
//   npm run kb:upload     Vector Store de OpenAI (anterior): valida y sube solo lo que cambió (idempotente)
//   npm run kb:status     estado del Vector Store de OpenAI
//   npm run kb:query -- "pregunta" [--lang es|en] [--topic scholarships]   (usa el Retrieve del puente)
//   npm run kb:verify     preguntas doradas (5 ES + 5 EN): el documento esperado debe salir en el top 3
//   npm run kb:export     genera archivos + .metadata.json listos para S3 / Bedrock Knowledge Base
//   npm run kb:sync-s3    sube ese export al bucket S3 del emulador (ensayo del flujo de producción)
//   npm run kb:reset      borra el Vector Store y sus archivos
//
// Solo se suben documentos marcados `simulated: true` (nunca información institucional real).

import { reconcile } from './reconcile.js'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { DeleteVectorsCommand, ListVectorsCommand, PutVectorsCommand, S3VectorsClient } from '@aws-sdk/client-s3vectors'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import type { DocumentType } from '@smithy/types'
import { chunkDocument, DIMENSION, EMBEDDING_MODEL_ID, ensureVectorIndex, METADATA_KEY, SOURCE_KEY, TEXT_KEY, VECTOR_BUCKET, VECTOR_INDEX } from './vectors.js'
import OpenAI, { toFile } from 'openai'
import type { ComparisonFilter, CompoundFilter } from 'openai/resources/shared'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')
const knowledgeDir = join(repoRoot, 'knowledge')
const stateDir = join(here, '..', '.state')
const stateFile = join(stateDir, 'knowledge.json')
const exportDir = join(stateDir, 'knowledge-s3')
const embeddingCacheFile = join(stateDir, 'embeddings.json')

const storeName = process.env.OPENAI_VECTOR_STORE_NAME ?? 'ebc-compass-knowledge'
const bucket = process.env.KNOWLEDGE_BUCKET ?? 'ebc-compass-knowledge-local'
const MAX_FILE_BYTES = 100 * 1024
const MAX_METADATA_BYTES = 10 * 1024
const PASS_THRESHOLD = 0.9

// ---------- Corpus ----------

interface Doc {
  path: string
  id: string
  title: string
  topic: string
  language: 'es' | 'en'
  body: string
  sha256: string
}

interface State {
  vectorStoreId?: string
  files: Record<string, { fileId: string; sha256: string }>
}

function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw }
  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const entry = line.match(/^([A-Za-z_]+):\s*(.*)$/)
    if (entry) meta[entry[1]] = entry[2].trim()
  }
  return { meta, body: match[2] }
}

function loadCorpus(): Doc[] {
  const manifest = JSON.parse(readFileSync(join(knowledgeDir, 'manifest.json'), 'utf8')) as { files: { path: string; id: string }[] }
  const problems: string[] = []
  const docs: Doc[] = []

  for (const entry of manifest.files) {
    const file = join(knowledgeDir, entry.path)
    if (!existsSync(file)) {
      problems.push(`${entry.path}: no existe`)
      continue
    }
    const raw = readFileSync(file, 'utf8')
    const { meta, body } = parseFrontMatter(raw)
    for (const key of ['id', 'title', 'topic', 'language', 'simulated']) if (!meta[key]) problems.push(`${entry.path}: falta "${key}" en el front-matter`)
    if (meta.simulated !== 'true') problems.push(`${entry.path}: debe declarar "simulated: true" (no se suben documentos reales)`)
    if (meta.language && !['es', 'en'].includes(meta.language)) problems.push(`${entry.path}: language debe ser es o en`)
    if (meta.id && meta.id !== entry.id) problems.push(`${entry.path}: el id del front-matter (${meta.id}) no coincide con el manifiesto (${entry.id})`)
    if (Buffer.byteLength(raw) > MAX_FILE_BYTES) problems.push(`${entry.path}: excede ${MAX_FILE_BYTES / 1024} KB`)
    docs.push({
      path: entry.path,
      id: meta.id,
      title: meta.title,
      topic: meta.topic,
      language: meta.language as 'es' | 'en',
      body,
      sha256: createHash('sha256').update(raw).digest('hex'),
    })
  }

  const listed = new Set(manifest.files.map((f) => f.path))
  for (const name of readdirSync(knowledgeDir)) if (name.endsWith('.md') && !listed.has(name)) problems.push(`${name}: existe pero no está en manifest.json`)

  if (problems.length > 0) {
    console.error('✖ El corpus no es válido:')
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exit(1)
  }
  return docs
}

function readState(): State {
  return { vectorStoreId: process.env.OPENAI_VECTOR_STORE_ID?.trim(), files: {} }
}

function writeState(state: State): void {
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n')
}

function client(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    console.error('✖ Falta OPENAI_API_KEY en local/.env')
    process.exit(1)
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 2 })
}

const isGone = (error: unknown) => (error as { status?: number }).status === 404

// ---------- Comandos ----------

async function upload(): Promise<void> {
  const docs = loadCorpus()
  const args = process.argv.slice(3)
  const create = args.includes('--create')
  const explicit = args.includes('--id')
  if ((create && explicit) || args.some((a, i) => a !== '--create' && a !== '--id' && args[i - 1] !== '--id')) throw new Error('Usa --create o --id vs_…')
  let storeId = explicit ? args[args.indexOf('--id') + 1] : process.env.OPENAI_VECTOR_STORE_ID?.trim()
  if (explicit && !storeId?.startsWith('vs_')) throw new Error('Falta un ID válido después de --id')
  const openai = client()
  if (create) {
    const store = await openai.vectorStores.create({ name: storeName }, { maxRetries: 0 })
    storeId = store.id
    console.log(`Vector Store creado: ${storeId}`)
  }
  if (!storeId) throw new Error('Configura OPENAI_VECTOR_STORE_ID o usa --id vs_… o --create.')
  const store = await openai.vectorStores.retrieve(storeId)
  if (store.status === 'expired') throw new Error('El Vector Store expiró. Configura otro ID explícitamente.')
  if (create || explicit) {
    const envFile = join(here, '..', '.env')
    const original = existsSync(envFile) ? readFileSync(envFile, 'utf8') : ''
    const line = `OPENAI_VECTOR_STORE_ID=${storeId}`
    const updated = /^OPENAI_VECTOR_STORE_ID=.*$/m.test(original)
      ? original.replace(/^OPENAI_VECTOR_STORE_ID=.*$/gm, line)
      : original + (original.endsWith('\n') || !original ? '' : '\n') + line + '\n'
    writeFileSync(envFile, updated)
    process.env.OPENAI_VECTOR_STORE_ID = storeId
    console.log('ID guardado en local/.env. Reinicia el puente si está ejecutándose.')
  }
  if (store.expires_after) await openai.vectorStores.update(storeId, { expires_after: null })
  const state: State = { vectorStoreId: storeId, files: {} }
  const remote = []
  for await (const file of openai.vectorStores.files.list(storeId)) remote.push(file)
  const managed = remote.filter(f => f.attributes?.simulated === true && typeof f.attributes.id === 'string' && typeof f.attributes.sha256 === 'string')
  if (managed.some(f => f.status === 'in_progress')) throw new Error('Hay archivos en procesamiento. Reintenta cuando terminen.')
  const { files, retired } = reconcile(docs, managed)
  state.files = files
  if (remote.length !== managed.length) console.log('Se conservan archivos con metadatos no reconocidos.')
  const current = new Set(docs.map((d) => d.path))
  const rows: string[] = []

  // Eliminados del corpus
  for (const [path, entry] of Object.entries(state.files)) {
    if (current.has(path)) continue
    await openai.vectorStores.files.delete(entry.fileId, { vector_store_id: storeId }).catch(() => undefined)

    delete state.files[path]
    rows.push(`  − ${path} (eliminado)`)
  }

  // Nuevos o modificados
  for (const doc of docs) {
    const previous = state.files[doc.path]
    if (previous?.sha256 === doc.sha256) {
      rows.push(`  = ${doc.path} (sin cambios)`)
      continue
    }
    if (previous) {
      await openai.vectorStores.files.delete(previous.fileId, { vector_store_id: storeId }).catch(() => undefined)

    }
    const raw = readFileSync(join(knowledgeDir, doc.path))
    const file = await openai.files.create({ file: await toFile(raw, doc.path), purpose: 'assistants' })
    const attached = await openai.vectorStores.files.createAndPoll(storeId, {
      file_id: file.id,
      attributes: { id: doc.id, title: doc.title, topic: doc.topic, language: doc.language, sha256: doc.sha256, simulated: true },
    })
    if (attached.status !== 'completed') {
      console.error(`✖ ${doc.path}: el procesamiento terminó en estado "${attached.status}" ${attached.last_error?.message ?? ''}`)
      process.exit(1)
    }
    state.files[doc.path] = { fileId: file.id, sha256: doc.sha256 }
    writeState(state)
    rows.push(`  ${previous ? '↻' : '+'} ${doc.path} (${previous ? 'actualizado' : 'nuevo'})`)
  }

  for (const fileId of retired) await openai.vectorStores.files.delete(fileId, { vector_store_id: storeId })
  writeState(state)
  console.log(rows.join('\n'))
  await status()
}

async function status(): Promise<void> {
  const openai = client()
  const state = readState()
  if (!state.vectorStoreId) {
    console.log('• Sin Vector Store. Configura OPENAI_VECTOR_STORE_ID en local/.env')
    return
  }
  try {
    const store = await openai.vectorStores.retrieve(state.vectorStoreId)
    const counts = store.file_counts
    const expires = store.expires_at ? new Date(store.expires_at * 1000).toLocaleString('es-MX') : 'sin expiración'
    console.log(`Vector Store ${store.id} · estado ${store.status} · archivos ${counts.completed}/${counts.total} completados, ${counts.failed} fallidos · expira ${expires}`)
    if (store.status === 'expired') console.log('⚠ Expiró. Configura OPENAI_VECTOR_STORE_ID en local/.env')
  } catch (error) {
    if (isGone(error)) console.log('⚠ El Vector Store ya no existe. Configura OPENAI_VECTOR_STORE_ID en local/.env')
    else throw error
  }
}

function buildFilter(language?: string, topic?: string): ComparisonFilter | CompoundFilter | undefined {
  const filters: ComparisonFilter[] = []
  if (language) filters.push({ type: 'eq', key: 'language', value: language })
  if (topic) filters.push({ type: 'eq', key: 'topic', value: topic })
  if (filters.length === 0) return undefined
  return filters.length === 1 ? filters[0] : { type: 'and', filters }
}

const useVectors = process.env.KNOWLEDGE_STORE !== 'openai'
interface Hit { filename: string; score: number; text: string }

/** Busca igual que el backend: con el Retrieve del puente (S3 Vectors) o en el Vector Store de OpenAI. */
async function search(query: string, options: { language?: string; topic?: string; limit?: number }): Promise<Hit[]> {
  const limit = options.limit ?? 5
  if (useVectors) {
    const filters = [options.language && { equals: { key: 'language', value: options.language } }, options.topic && { equals: { key: 'topic', value: options.topic } }].filter(Boolean)
    const filter = filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : { andAll: filters }
    const response = await fetch(`http://127.0.0.1:${process.env.BRIDGE_PORT ?? 8787}/knowledgebases/local-kb/retrieve`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ retrievalQuery: { text: query }, retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: limit, ...(filter ? { filter } : {}) } } }),
    }).catch(() => { throw new Error('El puente no responde. Ejecuta npm run dev (o npm run bridge).') })
    const body = await response.json() as { message?: string; retrievalResults?: { content: { text: string }; location: { s3Location: { uri: string } }; score: number }[] }
    if (!response.ok) throw new Error(body.message ?? `El puente respondió ${response.status}`)
    return (body.retrievalResults ?? []).map((r) => ({ filename: r.location.s3Location.uri.split('/').pop() ?? '', score: r.score, text: r.content.text }))
  }
  const storeId = readState().vectorStoreId
  if (!storeId) throw new Error('Sin Vector Store. Configura OPENAI_VECTOR_STORE_ID en local/.env')
  const filters = buildFilter(options.language, options.topic)
  const page = await client().vectorStores.search(storeId, { query, max_num_results: limit, ...(filters ? { filters } : {}) })
  return page.data.map((r) => ({ filename: r.filename, score: r.score, text: r.content.map((part) => part.text).join(' ') }))
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function query(): Promise<void> {
  const text = process.argv.slice(3).filter((arg, i, all) => !arg.startsWith('--') && !all[i - 1]?.startsWith('--')).join(' ').trim()
  if (!text) {
    console.error('Uso: npm run kb:query -- "pregunta" [--lang es|en] [--topic scholarships]')
    process.exit(2)
  }
  const results = await search(text, { language: flag('lang'), topic: flag('topic') })
  if (results.length === 0) console.log('(sin resultados)')
  for (const result of results) {
    const snippet = result.text.replace(/\s+/g, ' ').slice(0, 160)
    console.log(`${result.score.toFixed(2)}  ${result.filename}\n      ${snippet}…`)
  }
}

async function verify(): Promise<void> {
  const golden = JSON.parse(readFileSync(join(knowledgeDir, 'golden-questions.json'), 'utf8')) as {
    questions: { question: string; language: string; expect: string }[]
  }
  let passed = 0
  for (const item of golden.questions) {
    const results = await search(item.question, { language: item.language, limit: 3 })
    const files = [...new Set(results.map((r) => r.filename))]
    const ok = files.includes(item.expect)
    if (ok) passed += 1
    console.log(`${ok ? '✔' : '✖'} [${item.language}] ${item.question}\n      esperado ${item.expect} · recuperado ${files.join(', ') || '(nada)'}`)
  }
  const ratio = passed / golden.questions.length
  console.log(`\n${passed}/${golden.questions.length} (${Math.round(ratio * 100)}%) · umbral ${PASS_THRESHOLD * 100}%`)
  process.exit(ratio >= PASS_THRESHOLD ? 0 : 1)
}

function exportCorpus(): Doc[] {
  const docs = loadCorpus()
  rmSync(exportDir, { recursive: true, force: true })
  mkdirSync(exportDir, { recursive: true })
  for (const doc of docs) {
    const raw = readFileSync(join(knowledgeDir, doc.path))
    writeFileSync(join(exportDir, doc.path), raw)
    // Formato de Bedrock Knowledge Bases: <archivo>.metadata.json con metadatos escalares.
    const sidecar = JSON.stringify({ metadataAttributes: { id: doc.id, title: doc.title, topic: doc.topic, language: doc.language, simulated: true } })
    if (Buffer.byteLength(sidecar) > MAX_METADATA_BYTES) throw new Error(`${doc.path}: metadatos exceden 10 KB`)
    writeFileSync(join(exportDir, `${doc.path}.metadata.json`), sidecar + '\n')
  }
  return docs
}

async function exportCommand(): Promise<void> {
  const docs = exportCorpus()
  console.log(`✔ ${docs.length} documentos y ${docs.length} archivos .metadata.json en ${exportDir}`)
  console.log('  Para producción: súbelos al bucket KnowledgeDocuments de SST y sincroniza el data source de la Knowledge Base.')
}

async function syncS3(): Promise<void> {
  const docs = exportCorpus()
  const s3 = new S3Client({ forcePathStyle: true })
  let count = 0
  for (const doc of docs) {
    for (const key of [doc.path, `${doc.path}.metadata.json`]) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: readFileSync(join(exportDir, key)), ContentType: key.endsWith('.json') ? 'application/json' : 'text/markdown' }))
      count += 1
    }
  }
  console.log(`✔ ${count} objetos subidos a s3://${bucket} (emulador)`)
}

// ---------- S3 Vectors (emulador) ----------

type EmbeddingCache = Record<string, number[]>

function readEmbeddingCache(): EmbeddingCache {
  try {
    return JSON.parse(readFileSync(embeddingCacheFile, 'utf8')) as EmbeddingCache
  } catch {
    return {}
  }
}

/** Embedding con el contrato de Bedrock (Titan v2). En local lo atiende el puente; se guarda en caché por texto. */
async function embedWithBedrock(text: string, cache: EmbeddingCache, bedrock: BedrockRuntimeClient): Promise<number[]> {
  const key = createHash('sha256').update(`${EMBEDDING_MODEL_ID}:${DIMENSION}:${process.env.OPENAI_EMBEDDING_MODEL ?? ''}:${text}`).digest('hex')
  if (cache[key]) return cache[key]
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: EMBEDDING_MODEL_ID, contentType: 'application/json', accept: 'application/json',
    body: JSON.stringify({ inputText: text, dimensions: DIMENSION, normalize: true }),
  }))
  const { embedding } = JSON.parse(new TextDecoder().decode(response.body)) as { embedding?: number[] }
  if (!embedding || embedding.length !== DIMENSION) throw new Error(`El embedding no tiene ${DIMENSION} dimensiones.`)
  cache[key] = embedding
  return embedding
}

/** Lee un objeto de S3 como texto. */
async function readObject(s3: S3Client, key: string): Promise<string> {
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  return object.Body!.transformToString()
}

/**
 * Hace el papel de `StartIngestionJob` de Bedrock Knowledge Bases: lee el bucket (documentos y sus .metadata.json),
 * fragmenta con la estrategia por omisión, genera los embeddings con Titan v2 (el puente los traduce a OpenAI)
 * y escribe los vectores en S3 Vectors. No lee la carpeta knowledge/: la fuente es el bucket, como en el lab.
 */
async function ingest(): Promise<void> {
  const s3 = new S3Client({ forcePathStyle: true })
  const keys: string[] = []
  let token: string | undefined
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }))
    for (const object of page.Contents ?? []) if (object.Key?.endsWith('.md')) keys.push(object.Key)
    token = page.NextContinuationToken
  } while (token)
  if (keys.length === 0) throw new Error(`El bucket ${bucket} no tiene documentos. Ejecuta: npm run kb:sync-s3`)

  const vectors = new S3VectorsClient({})
  await ensureVectorIndex(vectors)
  const bridge = process.env.AWS_ENDPOINT_URL_BEDROCK_RUNTIME ?? `http://127.0.0.1:${process.env.BRIDGE_PORT ?? 8787}`
  const bedrock = new BedrockRuntimeClient({ endpoint: bridge, requestHandler: new NodeHttpHandler(), maxAttempts: 2 })
  const cache = readEmbeddingCache()
  const before = Object.keys(cache).length
  const written = new Set<string>()
  for (const key of keys) {
    const attributes = (JSON.parse(await readObject(s3, `${key}.metadata.json`).catch(() => '{}')) as { metadataAttributes?: Record<string, unknown> }).metadataAttributes ?? {}
    const batch = []
    for (const chunk of chunkDocument(key, await readObject(s3, key))) {
      written.add(chunk.key)
      batch.push({
        key: chunk.key,
        data: { float32: await embedWithBedrock(chunk.text, cache, bedrock) },
        metadata: { ...attributes, [SOURCE_KEY]: `s3://${bucket}/${key}`, [TEXT_KEY]: chunk.text, [METADATA_KEY]: JSON.stringify(attributes) } as Record<string, DocumentType>,
      })
    }
    for (let at = 0; at < batch.length; at += 100) await vectors.send(new PutVectorsCommand({ vectorBucketName: VECTOR_BUCKET, indexName: VECTOR_INDEX, vectors: batch.slice(at, at + 100) }))
  }
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(embeddingCacheFile, JSON.stringify(cache))

  // Quita fragmentos que ya no existen (documento borrado o con menos fragmentos), como una nueva ingesta.
  const stale: string[] = []
  let nextToken: string | undefined
  do {
    const page = await vectors.send(new ListVectorsCommand({ vectorBucketName: VECTOR_BUCKET, indexName: VECTOR_INDEX, nextToken }))
    for (const vector of page.vectors ?? []) if (vector.key && !written.has(vector.key)) stale.push(vector.key)
    nextToken = page.nextToken
  } while (nextToken)
  for (let at = 0; at < stale.length; at += 100) await vectors.send(new DeleteVectorsCommand({ vectorBucketName: VECTOR_BUCKET, indexName: VECTOR_INDEX, keys: stale.slice(at, at + 100) }))

  const created = Object.keys(cache).length - before
  console.log(`✔ ${written.size} fragmentos de ${keys.length} documentos del bucket en S3 Vectors (${VECTOR_BUCKET}/${VECTOR_INDEX}) · ${created} embeddings nuevos, ${written.size - created} desde caché${stale.length ? ` · ${stale.length} eliminados` : ''}`)
}

/** Publica el corpus en el bucket y lo ingesta: el equivalente local de lab:knowledge. */
async function index(): Promise<void> {
  await syncS3()
  await ingest()
}

async function reset(): Promise<void> {
  const state = readState()
  if (!state.vectorStoreId) {
    console.log('• No hay nada que borrar.')
    return
  }
  const args = process.argv.slice(3)
  if (args.length !== 2 || args[0] !== '--id' || args[1] !== state.vectorStoreId) throw new Error('Usa kb:reset -- --id con el ID configurado. --yes no está permitido.')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`Esto afecta a todo el equipo. Escribe ${state.vectorStoreId} para borrar el store: `)
  rl.close()
  if (answer.trim() !== state.vectorStoreId) { console.log('Cancelado.'); return }
  const openai = client()
  await openai.vectorStores.delete(state.vectorStoreId).catch(() => undefined)
  rmSync(stateFile, { force: true })
  const envFile = join(here, '..', '.env')
  writeFileSync(envFile, readFileSync(envFile, 'utf8').replace(/^OPENAI_VECTOR_STORE_ID=.*$/gm, 'OPENAI_VECTOR_STORE_ID='))
  console.log('✔ Vector Store eliminado. Los archivos globales se conservan. El equipo debe actualizar su ID.')
}

const commands: Record<string, () => Promise<void>> = { index, ingest, upload, status, query, verify, export: exportCommand, 'sync-s3': syncS3, reset }
const command = commands[process.argv[2] ?? '']
if (!command) {
  console.error(`Uso: kb <${Object.keys(commands).join('|')}>`)
  process.exit(2)
}
try {
  await command()
} catch (error) {
  console.error(`✖ ${(error as Error).message}`)
  process.exit(1)
}
