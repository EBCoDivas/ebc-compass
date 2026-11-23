import { identitySubject as verifiedSubject } from '../auth/identity.js'
// Rutas del asistente conversacional. Contrato: docs/plans/plan-asistente-integracion.md (sección 6).
// El perfil llega como resumen en cada petición (el frontend lo guarda en localStorage).

import { verifiedAcademicProfile } from '../auth/academicProfile.js'
import { conversationRoutes, historyError, pageOptions } from './conversationRoutes.js'
import type { Writable } from 'node:stream'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { Router, type Request, type Response } from 'express'
import { InvalidInputError, MAX_MESSAGE_LENGTH, ensureConversation, maintainConversation, runTurnStreaming, runTurn, suggestionsFor, type AssistantProfile, type AssistantRuntime, type CareerId, type ChatMessage, type Language } from '../assistant/index.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CAREERS: CareerId[] = ["business-administration", "communication-entertainment", "tourism", "international-business", "accounting", "law", "finance", "marketing", "executive-administration", "executive-accounting", "executive-business", "digital-transformation", "senior-management", "financial-management", "tax-specialty", "banking"]

class BadRequest extends Error {}

function fail(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({ code, message })
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, max) : undefined
}

function textList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => text(item, maxLength)).filter((item): item is string => item !== undefined).slice(0, maxItems)
}

/** Valida y recorta el resumen del perfil; descarta campos desconocidos o fuera de rango. */
function parseProfile(value: unknown): AssistantProfile | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'object' || Array.isArray(value)) throw new BadRequest('El perfil debe ser un objeto.')
  const raw = value as Record<string, unknown>
  const semester = typeof raw.currentSemester === 'number' && Number.isInteger(raw.currentSemester) && raw.currentSemester >= 1 && raw.currentSemester <= 10 ? raw.currentSemester : undefined
  return {
    name: text(raw.name, 100),
    campus: text(raw.campus, 20),
    career: CAREERS.includes(raw.career as CareerId) ? (raw.career as CareerId) : undefined,
    currentSemester: semester,
    completedCourses: textList(raw.completedCourses, 50, 20),
    interests: textList(raw.interests, 10, 50),
  }
}

function parseLanguage(value: unknown): Language | undefined {
  if (value === undefined || value === '') return undefined
  if (value === 'es' || value === 'en') return value
  throw new BadRequest('El idioma debe ser "es" o "en".')
}

function present(message: ChatMessage) {
  return { id: message.id, role: message.role, inputBlock: message.inputBlock, content: message.content, language: message.language, intent: message.intent, createdAt: message.createdAt,
    ...(message.failure ? { failure: message.failure, catalogFallback: message.catalogFallback } : {}), ...(message.interrupted ? { interrupted: true } : {}) }
}

export function parseTurn(request: Request) {
  const body = (request.body ?? {}) as Record<string, unknown>
  if (body.model !== undefined && body.model !== 'lunna' && body.model !== 'terra') throw new BadRequest('El modelo debe ser lunna o terra.')
  const model = (body.model ?? 'lunna') as 'lunna' | 'terra'
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (message.length < 1 || message.length > MAX_MESSAGE_LENGTH) throw new BadRequest('El mensaje debe tener entre 1 y ' + MAX_MESSAGE_LENGTH + ' caracteres.')
  const studentId = verifiedSubject(request)
  if (!studentId) throw Object.assign(new Error('Inicia sesión.'), { status: 401, code: 'UNAUTHORIZED' })
  if (!isUuid(studentId)) throw new BadRequest('studentId debe ser un UUID.')
  if (body.conversationId !== undefined && !isUuid(body.conversationId)) throw new BadRequest('conversationId debe ser un UUID.')
  if (body.requestId !== undefined && !isUuid(body.requestId)) throw new BadRequest('requestId debe ser un UUID.')
  const conversationId = (body.conversationId as string | undefined) ?? randomUUID()
  const trustedProfile = verifiedAcademicProfile(request)
  const profile = parseProfile({ ...parseProfile(body.profile), ...trustedProfile })
  return { studentId, conversationId, input: { model, threadId: studentId + '#' + conversationId, message, profile, trustedProfile,
    requestId: (body.requestId as string | undefined) ?? randomUUID(), requireExisting: body.conversationId !== undefined, language: parseLanguage(body.language) } }
}

export async function writeSse(response: Writable, event: string, data: unknown) {
  if (response.destroyed || response.writableEnded) return
  if (!response.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n')) {
    const abort = new AbortController()
    const close = () => abort.abort()
    response.once('close', close)
    try { await once(response, 'drain', { signal: abort.signal }) } catch { /* Cliente desconectado. */ }
    finally { response.off('close', close) }
  }
}

export function assistantRoutes(assistant: AssistantRuntime): Router {
  const router = Router()
  router.use((request, response, next) => {
    if (!verifiedSubject(request)) { fail(response, 401, 'UNAUTHORIZED', 'Inicia sesión.'); return }
    next()
  })
  router.use(conversationRoutes(assistant))
  const threadOf = (studentId: string, conversationId: string) => `${studentId}#${conversationId}`

  router.post('/messages', async (request, response) => {
    try {
      const { conversationId, input } = parseTurn(request)
      const started = performance.now()
      const reply = await runTurn(assistant.graph, input)

      response.json({
        conversationId,
        message: {
          model: reply.model, inputBlock: reply.inputBlock,
          interrupted: reply.interrupted,
          failure: reply.failure,
          catalogFallback: reply.catalogFallback,
          id: reply.id,
          role: 'assistant',
          content: reply.content,
          language: reply.language,
          intent: reply.intent,
          createdAt: reply.createdAt,
          suggestions: reply.suggestions,
          sources: reply.sources,
        },
        meta: { mode: reply.generatedBy, latencyMs: reply.latencyMs ?? Math.round(performance.now() - started), degraded: reply.degraded, historyStatus: reply.historyStatus, ...(reply.usage ? { usage: reply.usage } : {}) },
      })
      await maintainConversation(assistant.graph, input.threadId)
    } catch (error) {
      if ((error as { status?: number }).status) return historyError(response, error)
      if (error instanceof BadRequest || error instanceof InvalidInputError) return fail(response, 400, 'INVALID_INPUT', error.message)
      console.error(`assistant: error al procesar el mensaje (${(error as Error).name})`) // sin contenido del mensaje
      fail(response, 500, 'INTERNAL', 'No fue posible procesar tu mensaje. Inténtalo de nuevo.')
    }
  })

  const streamingThreads = new Set<string>()
  router.post('/messages/stream', async (request, response) => {
    let threadId: string | undefined
    let timer: ReturnType<typeof setInterval> | undefined
    const abort = new AbortController()
    const close = () => { if (!response.writableEnded) abort.abort() }
    response.on('close', close)
    try {
      const { studentId, conversationId, input } = parseTurn(request)
      await ensureConversation(assistant.graph, studentId, conversationId, !input.requireExisting)
      if (streamingThreads.has(input.threadId)) { fail(response, 409, 'TURN_PENDING', 'Espera a que termine el turno anterior y vuelve a intentarlo.'); return }
      threadId = input.threadId
      streamingThreads.add(threadId)
      const started = performance.now()
      response.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' })
      response.flushHeaders()
      await writeSse(response, 'meta', { conversationId })
      timer = setInterval(() => { if (!response.destroyed) response.write(': heartbeat\n\n') }, 15000)
      const reply = await runTurnStreaming(assistant.graph, input, abort.signal, async event => {
        const { event: name, ...data } = event
        await writeSse(response, name, { conversationId, ...data })
      })
      await writeSse(response, 'done', {
        conversationId,
        message: { model: reply.model, inputBlock: reply.inputBlock, id: reply.id, role: 'assistant', content: reply.content, language: reply.language, intent: reply.intent,
          createdAt: reply.createdAt, sources: reply.sources, suggestions: reply.suggestions, interrupted: reply.interrupted,
          failure: reply.failure, catalogFallback: reply.catalogFallback },
        meta: { mode: reply.generatedBy, latencyMs: reply.latencyMs ?? Math.round(performance.now() - started), degraded: reply.degraded, historyStatus: reply.historyStatus, ...(reply.usage ? { usage: reply.usage } : {}) },
      })
      response.end()
      await maintainConversation(assistant.graph, input.threadId)
    } catch (error) {
      if (!response.headersSent) {
        if ((error as { status?: number }).status) { historyError(response, error); return }
        if (error instanceof BadRequest || error instanceof InvalidInputError) fail(response, 400, 'INVALID_INPUT', error.message)
        else fail(response, 500, 'INTERNAL', 'No fue posible iniciar la respuesta.')
      } else {
        await writeSse(response, 'error', { code: 'STREAM_FAILED', message: 'La respuesta se interrumpió. Puedes reintentar.' })
        response.end()
      }
    } finally {
      if (timer) clearInterval(timer)
      response.off('close', close)
      if (threadId) streamingThreads.delete(threadId)
    }
  })

  router.get('/conversations/:id', async (request, response) => {
    const { id } = request.params
    const studentId = verifiedSubject(request) ?? request.query.studentId
    if (!isUuid(id) || !isUuid(studentId)) return fail(response, 400, 'INVALID_INPUT', 'id y studentId deben ser UUID.')
    try {
      if (assistant.conversations) {
        await ensureConversation(assistant.graph, studentId, id)
        const { limit, cursor } = pageOptions(request)
        const page = await assistant.conversations.messages(studentId, id, limit, cursor)
        const metadata = await assistant.conversations.require(studentId, id)
        response.json({ conversationId: id, messages: page.messages, nextCursor: page.nextCursor, language: metadata.language, status: 'active', updatedAt: metadata.updatedAt, messageCount: metadata.messageCount }); return
      }
      const config = { configurable: { thread_id: threadOf(studentId, id) } }
      if (!(await assistant.checkpointer.getTuple(config))) return fail(response, 404, 'CONVERSATION_NOT_FOUND', 'No encontramos esa conversación.')
      const state = await assistant.graph.getState(config)
      const messages = ((state.values.messages as ChatMessage[] | undefined) ?? []).map(present)
      response.json({
        conversationId: id,
        messages,
        language: (state.values.conversationLanguage as Language | undefined) ?? 'es',
        status: 'active',
        updatedAt: messages.at(-1)?.createdAt ?? null,
      })
    } catch (error) {
      if (assistant.conversations) { historyError(response, error); return }
      console.error(`assistant: error al leer la conversación (${(error as Error).name})`)
      fail(response, 500, 'INTERNAL', 'No fue posible leer la conversación.')
    }
  })

  router.delete('/conversations/:id', async (request, response) => {
    const { id } = request.params
    const studentId = verifiedSubject(request) ?? request.query.studentId
    if (!isUuid(id) || !isUuid(studentId)) return fail(response, 400, 'INVALID_INPUT', 'id y studentId deben ser UUID.')
    try {
      if (assistant.conversations) {
        if (!(await assistant.conversations.get(studentId, id))) await ensureConversation(assistant.graph, studentId, id)
        await assistant.conversations.remove(studentId, id, () => assistant.checkpointer.deleteThread(threadOf(studentId, id)))
        response.status(204).end(); return
      }
      if (!(await assistant.checkpointer.getTuple({ configurable: { thread_id: threadOf(studentId, id) } }))) return fail(response, 404, 'CONVERSATION_NOT_FOUND', 'No encontramos esa conversación.')
      await assistant.checkpointer.deleteThread(threadOf(studentId, id))
      response.status(204).end()
    } catch (error) {
      if (assistant.conversations) { historyError(response, error); return }
      console.error(`assistant: error al borrar la conversación (${(error as Error).name})`)
      fail(response, 500, 'INTERNAL', 'No fue posible borrar la conversación.')
    }
  })

  router.get('/suggestions', async (request, response) => {
    try {
      let models: Partial<Record<'lunna' | 'terra', string>> = {
        lunna: process.env.BEDROCK_LUNNA_MODEL_ID,
        terra: process.env.BEDROCK_TERRA_MODEL_ID,
      }
      const bridge = process.env.AWS_ENDPOINT_URL_BEDROCK_RUNTIME
      if (bridge) {
        models = {}
        try {
          const health = await fetch(new URL('/health', bridge), { signal: AbortSignal.timeout(1500) })
          if (health.ok) {
            const body = await health.json() as { models?: Partial<Record<'lunna' | 'terra', string>> }
            models = body.models ?? {}
          }
        } catch { /* Los alias siguen disponibles si el puente no publica metadatos. */ }
      }
      response.json({ models, suggestions: suggestionsFor('unknown', parseLanguage(request.query.language) ?? 'es') })
    } catch (error) {
      fail(response, 400, 'INVALID_INPUT', (error as Error).message)
    }
  })

  router.get('/health', async (_request, response) => {
    let store: 'ok' | 'error' = 'ok'
    try {
      await assistant.checkpointer.getTuple({ configurable: { thread_id: 'health-probe' } })
    } catch {
      store = 'error'
    }
    const llm = assistant.config.mode === 'llm'
    response.json({ store, llm: llm ? 'configured' : 'disabled', retriever: llm ? 'bedrock-kb' : 'disabled', mode: assistant.config.mode })
  })

  return router
}
