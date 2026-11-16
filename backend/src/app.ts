import cors from 'cors'
import express from 'express'
import { profileRoutes } from './routes/profileRoutes.js'
import { opportunityRoutes } from './routes/opportunityRoutes.js'
import { recommendationRoutes } from './routes/recommendationRoutes.js'
import { alertRoutes } from './routes/alertRoutes.js'

export const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'ebc-compass-backend' })
})

app.use('/api/profiles', profileRoutes)
app.use('/api/opportunities', opportunityRoutes)
app.use('/api/recommendations', recommendationRoutes)
app.use('/api/alerts', alertRoutes)
