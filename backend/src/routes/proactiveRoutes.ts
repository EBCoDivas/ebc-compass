import { Router, type Request, type Response } from 'express'
import type { createProactiveAgent } from '../proactive/agent.js'
import { resolvePlanningStudent } from '../auth/planningStudent.js'
import type { ConversationRepository } from '../assistant/conversations/repository.js'

type ProactiveAgent = ReturnType<typeof createProactiveAgent>

export function createProactiveRoutes(agent: ProactiveAgent, conversations: ConversationRepository) {
  const router = Router()
  async function student(request: Request, response: Response) {
    const value = await resolvePlanningStudent(request)
    if (!value) { response.status(401).json({ code: 'UNAUTHORIZED', message: 'Inicia sesión para consultar tus avisos.' }); return undefined }
    return value
  }
  router.get('/notices', async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    try { const value = await student(request, response); if (value) response.json({ notices: (await agent.read(value))?.notices ?? [] }) }
    catch { response.status(503).json({ code: 'PROACTIVE_UNAVAILABLE', message: 'No pudimos cargar tus avisos. Intenta de nuevo.' }) }
  })
  router.post('/notices/ensure', async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    try { const value = await student(request, response); if (value) response.json({ notices: await agent.ensure(value) }) }
    catch { response.status(503).json({ code: 'PROACTIVE_UNAVAILABLE', message: 'No pudimos generar tus avisos. Intenta de nuevo.' }) }
  })
  router.post('/notices/:id/conversation', async (request, response) => {
    try {
      const value = await student(request, response)
      if (!value) return
      const notice = (await agent.read(value))?.notices.find(item => item.id === request.params.id)
      if (!notice) { response.status(404).json({ code: 'NOTICE_NOT_FOUND', message: 'No encontramos ese mensaje de Compass.' }); return }
      const conversation = await conversations.createProactive(value.subject, notice.id + ':' + notice.createdAt, notice.title,
        `${notice.message}\n\n¿Qué quieres revisar primero?`, notice.kind === 'social-service'
          ? ['¿Qué opciones de servicio social tengo?', '¿Cómo puedo alcanzar mis horas a tiempo?']
          : ['¿Qué me falta para solicitar la beca?', '¿Cuáles son los requisitos de la beca?'])
      response.setHeader('Cache-Control', 'no-store')
      response.json({ conversationId: conversation.id })
    } catch { response.status(503).json({ code: 'PROACTIVE_UNAVAILABLE', message: 'No pudimos abrir el mensaje de Compass. Intenta de nuevo.' }) }
  })
  return router
}
