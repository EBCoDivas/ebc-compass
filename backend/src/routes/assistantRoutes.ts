// Rutas del asistente conversacional. Contrato: docs/plans/plan-asistente-integracion.md (sección 6).
// El perfil llega como resumen en cada petición (el frontend lo guarda en localStorage).

import { randomUUID } from 'node:crypto'
import { Router, type Request, type Response } from 'express'
import { InvalidInputError, MAX_MESSAGE_LENGTH, runTurn, suggestionsFor, type AssistantProfile, type CareerId, type ChatMessage, type Language, createAssistant } from '../assistant/index.js'

type Assistant = ReturnType<typeof createAssistant>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CAREERS: CareerId[] = ['banking', 'finance', 'marketing', 'business-administration']

class BadRequest extends Error {}

function fail(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({ code, message })
}

/**
 * Detrás de API Gateway con authorizer JWT (Cognito), la identidad del estudiante es el `sub` ya verificado del token:
 * se usa en lugar del studentId que envíe el cliente, así nadie puede leer conversaciones ajenas. En local no hay token
 * y se usa el studentId anónimo que genera el frontend.
 */
function verifiedSubject(request: Request): string | undefined {
  const gateway = (request as unknown as { apiGateway?: { event?: { requestContext?: { authorizer?: { jwt?: { claims?: Record<string, unknown> } } } } } }).apiGateway
  const sub = gateway?.event?.requestContext?.authorizer?.jwt?.claims?.sub
  return typeof sub === 'string' && sub.length > 0 ? sub : undefined
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
  return { id: message.id, role: message.role, content: message.content, language: message.language, intent: message.intent, createdAt: message.createdAt }
}

export function assistantRoutes(assistant: Assistant): Router {
  const router = Router()
  const threadOf = (studentId: string, conversationId: string) => `${studentId}#${conversationId}`

  router.post('/messages', async (request, response) => {
    try {
      const body = (request.body ?? {}) as Record<string, unknown>
      const message = typeof body.message === 'string' ? body.message.trim() : ''
      if (message.length < 1 || message.length > MAX_MESSAGE_LENGTH) throw new BadRequest(`El mensaje debe tener entre 1 y ${MAX_MESSAGE_LENGTH} caracteres.`)
      const studentId = verifiedSubject(request) ?? body.studentId
      if (!isUuid(studentId)) throw new BadRequest('studentId debe ser un UUID.')
      if (body.conversationId !== undefined && !isUuid(body.conversationId)) throw new BadRequest('conversationId debe ser un UUID.')

      // Si el conversationId no existe (p. ej. se reinició el emulador), la conversación simplemente empieza de nuevo.
      const conversationId = (body.conversationId as string | undefined) ?? randomUUID()
      const started = performance.now()
      const reply = await runTurn(assistant.graph, {
        threadId: threadOf(studentId, conversationId),
        message,
        profile: parseProfile(body.profile),
        language: parseLanguage(body.language),
      })

      response.json({
        conversationId,
        message: {
          id: reply.id,
          role: 'assistant',
          content: reply.content,
          language: reply.language,
          intent: reply.intent,
          createdAt: reply.createdAt,
          suggestions: reply.suggestions,
          sources: reply.sources,
        },
        meta: { mode: reply.generatedBy, latencyMs: Math.round(performance.now() - started), degraded: reply.degraded },
      })
    } catch (error) {
      if (error instanceof BadRequest || error instanceof InvalidInputError) return fail(response, 400, 'INVALID_INPUT', error.message)
      console.error(`assistant: error al procesar el mensaje (${(error as Error).name})`) // sin contenido del mensaje
      fail(response, 500, 'INTERNAL', 'No fue posible procesar tu mensaje. Inténtalo de nuevo.')
    }
  })

  router.get('/conversations/:id', async (request, response) => {
    const { id } = request.params
    const studentId = verifiedSubject(request) ?? request.query.studentId
    if (!isUuid(id) || !isUuid(studentId)) return fail(response, 400, 'INVALID_INPUT', 'id y studentId deben ser UUID.')
    try {
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
      console.error(`assistant: error al leer la conversación (${(error as Error).name})`)
      fail(response, 500, 'INTERNAL', 'No fue posible leer la conversación.')
    }
  })

  router.delete('/conversations/:id', async (request, response) => {
    const { id } = request.params
    const studentId = verifiedSubject(request) ?? request.query.studentId
    if (!isUuid(id) || !isUuid(studentId)) return fail(response, 400, 'INVALID_INPUT', 'id y studentId deben ser UUID.')
    try {
      await assistant.checkpointer.deleteThread(threadOf(studentId, id))
      response.status(204).end()
    } catch (error) {
      console.error(`assistant: error al borrar la conversación (${(error as Error).name})`)
      fail(response, 500, 'INTERNAL', 'No fue posible borrar la conversación.')
    }
  })

  router.get('/suggestions', (request, response) => {
    try {
      response.json({ suggestions: suggestionsFor('unknown', parseLanguage(request.query.language) ?? 'es') })
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
