import cors from 'cors'
import express from 'express'
import { profileRoutes } from './routes/profileRoutes.js'

export const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'ebc-compass-backend' })
})

app.use('/api/profiles', profileRoutes)
