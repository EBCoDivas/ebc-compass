import { once } from 'node:events'
import { bedrockEvent } from './eventStream.js'
import { bedrockUsage } from './usage.js'
import { openAiPrompt } from './prompt.js'
// Puente local "Bedrock -> OpenAI".
//
// El backend habla solo con el SDK de AWS (Bedrock Runtime y Bedrock Agent Runtime). En local, el emulador de AWS
// no ejecuta modelos y su Retrieve devuelve vacío, así que este servidor responde esas llamadas con OpenAI
// y con S3 Vectors del emulador. En el lab se quitan los endpoints sobrescritos y el backend usa Bedrock real sin cambios.
//
//   POST /model/{modelId}/converse            -> Chat Completions de OpenAI
//   POST /model/{titanEmbedId}/invoke         -> Embeddings de OpenAI con el contrato de Titan Text Embeddings v2
//   POST /knowledgebases/{kbId}/retrieve      -> embedding de la pregunta + QueryVectors en S3 Vectors del emulador
//                                                (KNOWLEDGE_STORE=openai usa el Vector Store de OpenAI anterior)
//   GET  /health[?deep=1]                     -> estado (deep verifica la clave, el modelo y la base de conocimiento)
//
// Solo escucha en 127.0.0.1. No registra el contenido de los mensajes ni imprime la clave.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { ListVectorsCommand, QueryVectorsCommand, S3VectorsClient } from '@aws-sdk/client-s3vectors'
import OpenAI from 'openai'
import type { ComparisonFilter, CompoundFilter } from 'openai/resources/shared'
import { DIMENSION, SOURCE_KEY, TEXT_KEY, VECTOR_BUCKET, VECTOR_INDEX, toS3VectorsFilter, type BedrockFilter } from '../kb/vectors.js'
import { OPENAI_EMBEDDING_MODEL, parseTitanRequest, type TitanEmbeddingRequest } from './embeddings.js'


const port = Number(process.env.BRIDGE_PORT ?? 8787)
const model = process.env.OPENAI_MODEL ?? 'gpt-6-luna'
const reasoningEffort = process.env.OPENAI_REASONING_EFFORT ?? 'high'
const apiKey = process.env.OPENAI_API_KEY ?? ''
const knowledgeBucket = process.env.KNOWLEDGE_BUCKET ?? 'ebc-compass-knowledge-local'
const knowledgeStore = process.env.KNOWLEDGE_STORE === 'openai' ? 'openai' : 's3vectors'

const openai = apiKey ? new OpenAI({ apiKey, timeout: 120_000, maxRetries: 1 }) : undefined
let vectors: S3VectorsClient | undefined
const vectorClient = () => (vectors ??= new S3VectorsClient({}))

// ---------- Tipos mínimos del contrato de Bedrock ----------

interface ConverseRequest {
  messages?: { role: 'user' | 'assistant'; content?: { text?: string; cachePoint?: { type: string } }[] }[]
  system?: { text?: string; cachePoint?: { type: string } }[]
  inferenceConfig?: { maxTokens?: number }
  additionalModelRequestFields?: { reasoning_effort?: string }
}

interface RetrieveRequest {
  retrievalQuery?: { text?: string }
  retrievalConfiguration?: { vectorSearchConfiguration?: { numberOfResults?: number; filter?: BedrockFilter } }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly errorType: string,
    message: string,
  ) {
    super(message)
  }
}

// ---------- Utilidades ----------

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(chunk as Buffer)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {} as T
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new HttpError(400, 'ValidationException', 'El cuerpo de la solicitud no es JSON válido.')
  }
}

function send(response: ServerResponse, status: number, body: unknown, errorType?: string): void {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
    ...(errorType ? { 'x-amzn-errortype': errorType } : {}),
  })
  response.end(payload)
}

/** Traduce un error de OpenAI al tipo de error que devolvería Bedrock. */
function toBedrockError(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new HttpError(408, 'ModelTimeoutException', 'OpenAI no respondió a tiempo.')
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new HttpError(503, 'ServiceUnavailableException', 'No fue posible conectar con OpenAI.')
  }
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 500
    if (status === 400 || status === 422) return new HttpError(400, 'ValidationException', `OpenAI rechazó la solicitud: ${error.message}`)
    if (status === 401 || status === 403) return new HttpError(403, 'AccessDeniedException', 'OpenAI rechazó la clave de API.')
    if (status === 404) return new HttpError(404, 'ResourceNotFoundException', `OpenAI no encontró el recurso: ${error.message}`)
    if (status === 429) return new HttpError(429, 'ThrottlingException', 'OpenAI limitó la tasa de solicitudes o la cuota.')
    if (status >= 500) return new HttpError(503, 'ServiceUnavailableException', 'OpenAI no está disponible.')
  }
  return new HttpError(500, 'InternalServerException', 'Error interno del puente.')
}

function requireOpenAI(): OpenAI {
  if (!openai) {
    throw new HttpError(403, 'AccessDeniedException', 'Falta OPENAI_API_KEY en local/.env.')
  }
  return openai
}

function vectorStoreId(): string | undefined {
  return process.env.OPENAI_VECTOR_STORE_ID?.trim() || undefined
}

// ---------- Converse ----------

async function converse(modelId: string, body: ConverseRequest) {
  const client = requireOpenAI()
  const model = modelId === 'local-terra' ? process.env.OPENAI_TERRA_MODEL ?? 'gpt-6.1-terra' : process.env.OPENAI_LUNNA_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-6-luna'
  const prompt = openAiPrompt(body, model)
  if (!prompt.messages.some(message => message.role === 'user')) throw new HttpError(400, 'ValidationException', 'La conversación no tiene mensajes con texto.')

  const effort = (body.additionalModelRequestFields?.reasoning_effort ?? reasoningEffort) as OpenAI.ReasoningEffort
  const started = Date.now()

  const completion = await client.chat.completions.create({
    model,
    ...prompt,
    reasoning_effort: effort,
    ...(body.inferenceConfig?.maxTokens ? { max_completion_tokens: body.inferenceConfig.maxTokens } : {}),
  })

  const choice = completion.choices[0]
  const stopReason = choice?.finish_reason === 'length' ? 'max_tokens' : choice?.finish_reason === 'content_filter' ? 'content_filtered' : 'end_turn'
  void modelId // El identificador de Bedrock es lógico: siempre se usa OPENAI_MODEL.

  return {
    output: { message: { role: 'assistant', content: [{ text: choice?.message?.content ?? '' }] } },
    stopReason,
    ...(completion.usage ? { usage: bedrockUsage(completion.usage) } : {}),
    metrics: { latencyMs: Date.now() - started },
  }
}

async function converseStream(modelId: string, body: ConverseRequest, response: ServerResponse) {
  const client = requireOpenAI()
  const model = modelId === 'local-terra' ? process.env.OPENAI_TERRA_MODEL ?? 'gpt-6.1-terra' : process.env.OPENAI_LUNNA_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-6-luna'
  const prompt = openAiPrompt(body, model)
  if (!prompt.messages.some(message => message.role === 'user')) throw new HttpError(400, 'ValidationException', 'Falta un mensaje de usuario.')
  const abort = new AbortController()
  const close = () => { if (!response.writableEnded) abort.abort() }
  response.on('close', close)
  const started = Date.now()
  try {
    const chunks = await client.chat.completions.create({
      model, ...prompt, stream: true, stream_options: { include_usage: true },
      reasoning_effort: (body.additionalModelRequestFields?.reasoning_effort ?? reasoningEffort) as OpenAI.ReasoningEffort,
      ...(body.inferenceConfig?.maxTokens ? { max_completion_tokens: body.inferenceConfig.maxTokens } : {}),
    }, { signal: abort.signal })
    response.writeHead(200, { 'content-type': 'application/vnd.amazon.eventstream', 'cache-control': 'no-store' })
    const emit = async (type: string, value: unknown) => {
      if (abort.signal.aborted) return
      if (!response.write(bedrockEvent(type, value))) await once(response, 'drain', { signal: abort.signal })
    }
    await emit('messageStart', { role: 'assistant' })
    let usage: ReturnType<typeof bedrockUsage> | undefined
    let stopReason = 'end_turn'
    for await (const chunk of chunks) {
      const choice = chunk.choices[0]
      if (choice?.delta.content) await emit('contentBlockDelta', { contentBlockIndex: 0, delta: { text: choice.delta.content } })
      if (choice?.finish_reason === 'length') stopReason = 'max_tokens'
      if (choice?.finish_reason === 'content_filter') stopReason = 'content_filtered'
      if (chunk.usage) usage = bedrockUsage(chunk.usage)
    }
    await emit('contentBlockStop', { contentBlockIndex: 0 })
    await emit('messageStop', { stopReason })
    await emit('metadata', { ...(usage ? { usage } : {}), metrics: { latencyMs: Date.now() - started } })
    response.end()
  } catch (error) {
    if (abort.signal.aborted) return
    if (!response.headersSent) throw error
    response.end(bedrockEvent('internalServerException', { message: 'La generación se interrumpió.' }, true))
  } finally { response.off('close', close) }
}

// ---------- Embeddings ----------

async function embed(texts: string[], dimensions = DIMENSION): Promise<{ vectors: number[][]; tokens: number }> {
  const result = await requireOpenAI().embeddings.create({ model: OPENAI_EMBEDDING_MODEL, input: texts, dimensions })
  return { vectors: result.data.sort((a, b) => a.index - b.index).map((item) => item.embedding), tokens: result.usage.prompt_tokens }
}

async function invokeEmbedding(modelId: string, body: TitanEmbeddingRequest) {
  let request: ReturnType<typeof parseTitanRequest>
  try {
    request = parseTitanRequest(modelId, body)
  } catch (error) {
    throw new HttpError(400, 'ValidationException', (error as Error).message)
  }
  const { vectors: [embedding], tokens } = await embed([request.text], request.dimensions)
  return { embedding, inputTextTokenCount: tokens }
}

// ---------- Retrieve ----------

type OpenAiFilter = ComparisonFilter | CompoundFilter

function toOpenAiFilter(filter: BedrockFilter | undefined): OpenAiFilter | undefined {
  if (!filter) return undefined
  const comparison = (type: 'eq' | 'ne' | 'in', entry: { key: string; value: unknown }) =>
    ({ type, key: entry.key, value: entry.value }) as ComparisonFilter
  if (filter.equals) return comparison('eq', filter.equals)
  if (filter.notEquals) return comparison('ne', filter.notEquals)
  if (filter.in) return comparison('in', filter.in)
  const compound = (type: 'and' | 'or', list: BedrockFilter[]) => {
    const filters = list.map(toOpenAiFilter).filter((f): f is OpenAiFilter => f !== undefined)
    return { type, filters } as CompoundFilter
  }
  if (filter.andAll) return compound('and', filter.andAll)
  if (filter.orAll) return compound('or', filter.orAll)
  throw new HttpError(400, 'ValidationException', 'El filtro de recuperación no está soportado por el puente local.')
}

/** Como Bedrock Knowledge Bases sobre S3 Vectors: embedding de la pregunta y búsqueda por similitud coseno. */
async function retrieveFromVectors(query: string, body: RetrieveRequest) {
  const config = body.retrievalConfiguration?.vectorSearchConfiguration
  let filter: ReturnType<typeof toS3VectorsFilter>
  try {
    filter = toS3VectorsFilter(config?.filter)
  } catch (error) {
    throw new HttpError(400, 'ValidationException', (error as Error).message)
  }
  const { vectors: [queryVector] } = await embed([query])
  let found
  try {
    found = await vectorClient().send(new QueryVectorsCommand({
      vectorBucketName: VECTOR_BUCKET, indexName: VECTOR_INDEX, queryVector: { float32: queryVector },
      topK: config?.numberOfResults ?? 5, returnMetadata: true, returnDistance: true, ...(filter ? { filter } : {}),
    }))
  } catch (error) {
    const name = (error as { name?: string }).name ?? ''
    if (name.includes('NotFound')) throw new HttpError(404, 'ResourceNotFoundException', 'La base de conocimiento local no está cargada. Ejecuta: npm run kb:index')
    throw new HttpError(503, 'ServiceUnavailableException', 'No fue posible consultar S3 Vectors en el emulador.')
  }
  const retrievalResults = (found.vectors ?? []).map((vector) => {
    const { [TEXT_KEY]: text, ...metadata } = (vector.metadata ?? {}) as Record<string, unknown>
    return {
      content: { type: 'TEXT', text: typeof text === 'string' ? text : '' },
      location: { type: 'S3', s3Location: { uri: String(metadata[SOURCE_KEY] ?? '') } },
      score: 1 - (vector.distance ?? 1),
      metadata: { ...metadata, 'x-amz-bedrock-kb-chunk-id': vector.key },
    }
  })
  return { retrievalResults }
}

async function retrieve(body: RetrieveRequest) {
  const query = body.retrievalQuery?.text?.trim()
  if (!query) throw new HttpError(400, 'ValidationException', 'retrievalQuery.text es obligatorio.')
  if (knowledgeStore === 's3vectors') return retrieveFromVectors(query, body)
  const client = requireOpenAI()

  const storeId = vectorStoreId()
  if (!storeId) {
    throw new HttpError(404, 'ResourceNotFoundException', 'La base de conocimiento local no está cargada. Ejecuta: npm run kb:upload')
  }

  const config = body.retrievalConfiguration?.vectorSearchConfiguration
  const filters = toOpenAiFilter(config?.filter)
  const page = await client.vectorStores.search(storeId, {
    query,
    max_num_results: config?.numberOfResults ?? 5,
    ...(filters ? { filters } : {}),
  })

  const retrievalResults = page.data.map((result) => ({
    content: { type: 'TEXT', text: result.content.map((part) => part.text).join('\n') },
    location: { type: 'S3', s3Location: { uri: `s3://${knowledgeBucket}/${result.filename}` } },
    score: result.score,
    metadata: result.attributes ?? {},
  }))
  return { retrievalResults }
}

// ---------- Health ----------

async function vectorIndexLoaded(): Promise<boolean> {
  try {
    const page = await vectorClient().send(new ListVectorsCommand({ vectorBucketName: VECTOR_BUCKET, indexName: VECTOR_INDEX, maxResults: 1 }))
    return (page.vectors?.length ?? 0) > 0
  } catch {
    return false
  }
}

async function health(deep: boolean) {
  const base = {
    status: 'ok',
    service: 'ebc-compass-bedrock-bridge',
    models: {
      lunna: process.env.OPENAI_LUNNA_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-6-luna',
      terra: process.env.OPENAI_TERRA_MODEL ?? 'gpt-6.1-terra',
    },
    model,
    reasoningEffort,
    apiKeyConfigured: Boolean(apiKey),
    knowledgeStore,
    embeddingModel: OPENAI_EMBEDDING_MODEL,
    vectorStoreLoaded: knowledgeStore === 'openai' ? Boolean(vectorStoreId()) : await vectorIndexLoaded(),
  }
  if (!deep) return base
  if (!openai) return { ...base, upstream: 'error', detail: 'Falta OPENAI_API_KEY' }
  try {
    if (knowledgeStore === 's3vectors') {
      await Promise.all([openai.models.retrieve(model), openai.models.retrieve(OPENAI_EMBEDDING_MODEL)])
      return { ...base, upstream: 'ok', detail: base.vectorStoreLoaded ? `${VECTOR_BUCKET}/${VECTOR_INDEX}` : 'Ejecuta npm run kb:index' }
    }
    await openai.models.retrieve(model)
    const id = vectorStoreId()
    if (!id) return { ...base, vectorStoreLoaded: false, upstream: 'ok', detail: 'Configura OPENAI_VECTOR_STORE_ID' }
    const store = await openai.vectorStores.retrieve(id)
    return { ...base, upstream: 'ok', vectorStoreLoaded: store.status === 'completed' && store.file_counts.completed > 0, detail: store.status }
  } catch (error) {
    return { ...base, vectorStoreLoaded: false, upstream: 'error', detail: toBedrockError(error).message }
  }
}

// ---------- Servidor ----------

const server = createServer(async (request, response) => {
  const started = Date.now()
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)
  let status = 200

  try {
    const converseMatch = url.pathname.match(/^\/model\/([^/]+)\/converse$/)
    const streamMatch = url.pathname.match(/^\/model\/([^/]+)\/converse-stream$/)
    const retrieveMatch = url.pathname.match(/^\/knowledgebases\/([^/]+)\/retrieve$/)
    const invokeMatch = url.pathname.match(/^\/model\/([^/]+)\/invoke$/)

    if (request.method === 'GET' && url.pathname === '/health') {
      send(response, 200, await health(url.searchParams.get('deep') === '1'))
    } else if (request.method === 'POST' && streamMatch) {
      await converseStream(decodeURIComponent(streamMatch[1]), await readJson<ConverseRequest>(request), response)
    } else if (request.method === 'POST' && converseMatch) {
      send(response, 200, await converse(decodeURIComponent(converseMatch[1]), await readJson<ConverseRequest>(request)))
    } else if (request.method === 'POST' && invokeMatch) {
      send(response, 200, await invokeEmbedding(decodeURIComponent(invokeMatch[1]), await readJson<TitanEmbeddingRequest>(request)))
    } else if (request.method === 'POST' && retrieveMatch) {
      send(response, 200, await retrieve(await readJson<RetrieveRequest>(request)))
    } else {
      throw new HttpError(404, 'ResourceNotFoundException', `Ruta no soportada por el puente: ${request.method} ${url.pathname}`)
    }
  } catch (error) {
    const failure = toBedrockError(error)
    status = failure.status
    send(response, failure.status, { message: failure.message }, failure.errorType)
  } finally {
    console.log(`${request.method} ${url.pathname} ${status} ${Date.now() - started}ms`)
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`bedrock-bridge escuchando en http://127.0.0.1:${port}`)
  console.log(`  modelo: ${model} · razonamiento: ${reasoningEffort} · clave de OpenAI: ${apiKey ? 'configurada' : 'FALTA (local/.env)'}`)
  console.log(`  conocimiento: ${knowledgeStore === 's3vectors' ? `S3 Vectors (${VECTOR_BUCKET}/${VECTOR_INDEX}) · embeddings ${OPENAI_EMBEDDING_MODEL}` : 'Vector Store de OpenAI'}`)
})
