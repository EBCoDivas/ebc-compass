import { extractRequestedMemory, isNoteKey } from '../assistant/conversations/explicitMemory.js'
import { randomUUID } from 'node:crypto'
import { Router, type Request, type Response } from 'express'
import { identitySubject } from '../auth/identity.js'
import { verifiedAcademicProfile } from '../auth/academicProfile.js'
import type { AssistantRuntime } from '../assistant/index.js'
import { EDITABLE_VALUES, forgetMemory, MEMORY_KEYS, seedMemories, validMemoryValue } from '../assistant/conversations/memory.js'
import type { MemoryKey } from '../assistant/conversations/repository.js'

export function historyError(response: Response, error: unknown) {
  const failure = error as { status?: number; code?: string; message?: string }
  response.status(failure.status ?? 503).json({ code: failure.code ?? 'HISTORY_UNAVAILABLE',
    message: failure.status ? failure.message : 'No pudimos acceder al historial. Intenta nuevamente.' })
}
const bad = (message: string) => Object.assign(new Error(message), { status: 400, code: 'INVALID_INPUT' })
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function pageOptions(request: Request) {
  const limit = request.query.limit === undefined ? 50 : Number(request.query.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw bad('limit debe estar entre 1 y 100.')
  const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined
  return { limit, cursor }
}

export function conversationRoutes(assistant: AssistantRuntime) {
  const router = Router()
  const repo = assistant.conversations
  if (!repo) return router
  const endpoint = (handler: (request: Request, response: Response, owner: string) => Promise<void>) => async (request: Request, response: Response) => {
    const owner = identitySubject(request)
    if (!owner) { response.status(401).json({ code: 'UNAUTHORIZED', message: 'Inicia sesión.' }); return }
    try { await handler(request, response, owner) } catch (error) { historyError(response, error) }
  }
  router.get('/conversations', endpoint(async (request, response, owner) => {
    const { limit, cursor } = pageOptions(request)
    response.json(await repo.list(owner, limit, cursor))
  }))
  router.post('/conversations', endpoint(async (request, response, owner) => {
    const id = request.body?.conversationId ?? randomUUID()
    if (!uuid(id)) throw bad('conversationId debe ser un UUID.')
    const existing = await repo.get(owner, id)
    if (existing) { const conversation = await repo.require(owner, id); response.status(200).json({ conversationId: id, title: conversation.title }); return }
    const conversation = await repo.create(owner, id)
    response.status(201).json({ conversationId: id, title: conversation.title })
  }))
  router.patch('/conversations/:id', endpoint(async (request, response, owner) => {
    if (!uuid(request.params.id)) throw bad('id debe ser un UUID.')
    const title = typeof request.body?.title === 'string' ? request.body.title.trim() : ''
    if (!title || title.length > 80) throw bad('El título debe tener entre 1 y 80 caracteres.')
    await repo.rename(owner, request.params.id, title)
    response.status(204).end()
  }))
  router.put('/conversations/:id/messages/:messageId/feedback', endpoint(async (request, response, owner) => {
    if (!uuid(request.params.id) || !uuid(request.params.messageId)) throw bad('Identificador inválido.')
    const rating = request.body?.rating
    if (rating !== 'positive' && rating !== 'negative' && rating !== null) throw bad('rating debe ser positive, negative o null.')
    await repo.rate(owner, request.params.id, request.params.messageId, rating)
    response.status(204).end()
  }))
  router.get('/memory', endpoint(async (request, response, owner) => {
    await seedMemories(repo, owner, { ...await assistant.profileReader?.(owner), ...verifiedAcademicProfile(request) })
    const facts = (await repo.memories(owner)).filter(fact => !fact.suppressed && fact.value).map(({ version: _version, ...fact }) => fact)
    response.json({ facts, allowedValues: EDITABLE_VALUES })
  }))
  router.put('/memory/:key', endpoint(async (request, response, owner) => {
    const key = request.params.key as MemoryKey
    if (!MEMORY_KEYS.includes(key) && !isNoteKey(key)) throw bad('Categoría de memoria no permitida.')
    const current = (await repo.memories(owner)).find(fact => fact.key === key)
    if ((current?.origin === 'profile' && current.value) || ['career', 'campus', 'semester'].includes(key)) {
      response.status(409).json({ code: 'EDIT_PROFILE', message: 'Actualiza este dato desde tu perfil.' }); return
    }
    if (isNoteKey(key)) {
      if (!current || current.suppressed || !current.value) throw bad('No encontramos esa nota.')
      if (!assistant.memoryLlm) throw Object.assign(new Error('No se pudo corregir la nota: el modelo no está disponible.'), { status: 503, code: 'MEMORY_UNAVAILABLE' })
      const raw = request.body?.value
      if (typeof raw !== 'string' || !raw.trim() || raw.length > 200) throw bad('La nota debe tener entre 1 y 200 caracteres.')
      const fact = await extractRequestedMemory('Recuerda que ' + raw, assistant.memoryLlm)
      const text = fact?.kind === 'note' ? fact.value : fact?.summary
      if (!text || (assistant.inputGuardrail && await assistant.inputGuardrail.assess(text))) throw bad('No se puede guardar ese contenido como nota.')
      await repo.saveMemory(owner, { key, value: text, origin: 'user' }, false)
      response.status(204).end()
      return
    }
    const value = request.body?.value
    if (!validMemoryValue(key, value)) throw bad('Usa uno de los valores permitidos para esta categoría.')
    await repo.saveMemory(owner, { key, value, origin: 'user' }, false)
    response.status(204).end()
  }))
  router.delete('/memory/:key', endpoint(async (request, response, owner) => {
    const key = request.params.key as MemoryKey
    if (!MEMORY_KEYS.includes(key) && !isNoteKey(key)) throw bad('Categoría de memoria no permitida.')
    await forgetMemory(repo, owner, key)
    response.status(204).end()
  }))
  router.delete('/memory', endpoint(async (_request, response, owner) => { await forgetMemory(repo, owner); response.status(204).end() }))
  return router
}
