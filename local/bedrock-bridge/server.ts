// Puente local "Bedrock -> OpenAI".
//
// El backend habla solo con el SDK de AWS (Bedrock Runtime y Bedrock Agent Runtime). En local, el emulador de AWS
// no ejecuta un modelo de lenguaje y su Retrieve devuelve vacío, así que este servidor responde esas dos llamadas
// con la API de OpenAI. En el lab se quitan los endpoints sobrescritos y el backend usa Bedrock real sin cambios.
//
//   POST /model/{modelId}/converse            -> Chat Completions de OpenAI
//   POST /knowledgebases/{kbId}/retrieve      -> búsqueda en el Vector Store de OpenAI
//   GET  /health[?deep=1]                     -> estado (deep verifica la clave y el modelo contra OpenAI)
//
// Solo escucha en 127.0.0.1. No registra el contenido de los mensajes ni imprime la clave.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import OpenAI from 'openai'
import type { ComparisonFilter, CompoundFilter } from 'openai/resources/shared'


const port = Number(process.env.BRIDGE_PORT ?? 8787)
const model = process.env.OPENAI_MODEL ?? 'gpt-6-luna'
const reasoningEffort = process.env.OPENAI_REASONING_EFFORT ?? 'high'
const apiKey = process.env.OPENAI_API_KEY ?? ''
const knowledgeBucket = process.env.KNOWLEDGE_BUCKET ?? 'ebc-compass-knowledge-local'

const openai = apiKey ? new OpenAI({ apiKey, timeout: 120_000, maxRetries: 1 }) : undefined

// ---------- Tipos mínimos del contrato de Bedrock ----------

interface ConverseRequest {
  messages?: { role: 'user' | 'assistant'; content?: { text?: string }[] }[]
  system?: { text?: string }[]
  inferenceConfig?: { maxTokens?: number }
  additionalModelRequestFields?: { reasoning_effort?: string }
}

type BedrockFilter = {
  equals?: { key: string; value: unknown }
  notEquals?: { key: string; value: unknown }
  in?: { key: string; value: unknown }
  andAll?: BedrockFilter[]
  orAll?: BedrockFilter[]
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
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []

  const system = (body.system ?? []).map((part) => part.text ?? '').filter(Boolean).join('\n\n')
  if (system) messages.push({ role: 'system', content: system })

  for (const message of body.messages ?? []) {
    const text = (message.content ?? []).map((part) => part.text ?? '').filter(Boolean).join('\n')
    if (!text) continue
    messages.push({ role: message.role, content: text })
  }
  if (messages.length === 0) throw new HttpError(400, 'ValidationException', 'La conversación no tiene mensajes con texto.')

  const effort = (body.additionalModelRequestFields?.reasoning_effort ?? reasoningEffort) as OpenAI.ReasoningEffort
  const started = Date.now()

  const completion = await client.chat.completions.create({
    model,
    messages,
    reasoning_effort: effort,
    ...(body.inferenceConfig?.maxTokens ? { max_completion_tokens: body.inferenceConfig.maxTokens } : {}),
  })

  const choice = completion.choices[0]
  const stopReason = choice?.finish_reason === 'length' ? 'max_tokens' : choice?.finish_reason === 'content_filter' ? 'content_filtered' : 'end_turn'
  void modelId // El identificador de Bedrock es lógico: siempre se usa OPENAI_MODEL.

  return {
    output: { message: { role: 'assistant', content: [{ text: choice?.message?.content ?? '' }] } },
    stopReason,
    usage: {
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
    },
    metrics: { latencyMs: Date.now() - started },
  }
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

async function retrieve(body: RetrieveRequest) {
  const client = requireOpenAI()
  const query = body.retrievalQuery?.text?.trim()
  if (!query) throw new HttpError(400, 'ValidationException', 'retrievalQuery.text es obligatorio.')

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

async function health(deep: boolean) {
  const base = {
    status: 'ok',
    service: 'ebc-compass-bedrock-bridge',
    model,
    reasoningEffort,
    apiKeyConfigured: Boolean(apiKey),
    vectorStoreLoaded: Boolean(vectorStoreId()),
  }
  if (!deep) return base
  if (!openai) return { ...base, upstream: 'error', detail: 'Falta OPENAI_API_KEY' }
  try {
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
    const retrieveMatch = url.pathname.match(/^\/knowledgebases\/([^/]+)\/retrieve$/)

    if (request.method === 'GET' && url.pathname === '/health') {
      send(response, 200, await health(url.searchParams.get('deep') === '1'))
    } else if (request.method === 'POST' && converseMatch) {
      send(response, 200, await converse(decodeURIComponent(converseMatch[1]), await readJson<ConverseRequest>(request)))
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
})
