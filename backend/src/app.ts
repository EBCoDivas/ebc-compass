import { academicProgressRoutes } from './routes/academicProgressRoutes.js'
import cors from 'cors'
import express from 'express'
import { profileRoutes } from './routes/profileRoutes.js'
import { opportunityRoutes } from './routes/opportunityRoutes.js'
import { recommendationRoutes } from './routes/recommendationRoutes.js'
import { alertRoutes } from './routes/alertRoutes.js'
import { studentPlanningRoutes } from './routes/studentPlanningRoutes.js'
import { assistantRoutes } from './routes/assistantRoutes.js'
import { createAssistant } from './assistant/index.js'

export const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'ebc-compass-backend' })
})

app.use('/api/profiles', profileRoutes)
app.use('/api/academic-progress', academicProgressRoutes)
app.use('/api/opportunities', opportunityRoutes)
app.use('/api/recommendations', recommendationRoutes)
app.use('/api/alerts', alertRoutes)
app.use('/api/student-planning', studentPlanningRoutes)
app.use('/api/assistant', assistantRoutes(createAssistant()))

// Cuerpos JSON mal formados -> 400 con el formato de error de la API.
app.use((error: Error & { type?: string }, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  if (error.type === 'entity.parse.failed') {
    response.status(400).json({ code: 'INVALID_INPUT', message: 'El cuerpo de la solicitud no es JSON válido.' })
    return
  }
  next(error)
})
