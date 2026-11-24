import { createAcademicProgressRoutes } from './routes/academicProgressRoutes.js'
import { academicProgressReader } from './data/studentAcademicProgress.js'
import { createBannerReader } from './banner/reader.js'
import cors from 'cors'
import express from 'express'
import { profileRoutes } from './routes/profileRoutes.js'
import { opportunityRoutes } from './routes/opportunityRoutes.js'
import { recommendationRoutes } from './routes/recommendationRoutes.js'
import { alertRoutes } from './routes/alertRoutes.js'
import { createStudentPlanningRoutes } from './routes/studentPlanningRoutes.js'
import { assistantRoutes } from './routes/assistantRoutes.js'
import { createAssistant } from './assistant/index.js'
import { createProactiveAgent } from './proactive/agent.js'
import { createProactiveRoutes } from './routes/proactiveRoutes.js'

export const app = express()
const banner = createBannerReader()
const assistant = createAssistant({ banner })
const proactive = createProactiveAgent({ store: assistant.conversations.store, memories: assistant.conversations, banner,
  llm: assistant.memoryLlm, llmTimeoutMs: assistant.config.llmTimeoutMs })

app.use(cors())
// La confirmación de la beca incluye la carta de motivos en base64 (hasta 1.5 MB).
app.use('/api/assistant/conversations/:id/actions', express.json({ limit: '3mb' }))
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'ebc-compass-backend' })
})

app.use('/api/profiles', profileRoutes)
app.use('/api/academic-progress', createAcademicProgressRoutes(academicProgressReader(banner)))
app.use('/api/opportunities', opportunityRoutes)
app.use('/api/recommendations', recommendationRoutes)
app.use('/api/alerts', alertRoutes)
app.use('/api/student-planning', createStudentPlanningRoutes(assistant.conversations.store, banner))
app.use('/api/proactive', createProactiveRoutes(proactive, assistant.conversations))
app.use('/api/assistant', assistantRoutes(assistant))

// Cuerpos JSON mal formados -> 400 con el formato de error de la API.
app.use((error: Error & { type?: string }, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  if (error.type === 'entity.parse.failed') {
    response.status(400).json({ code: 'INVALID_INPUT', message: 'El cuerpo de la solicitud no es JSON válido.' })
    return
  }
  next(error)
})
