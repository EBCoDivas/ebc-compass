import { Router } from 'express'
import { recommend } from '../data/recommendations.js'
import { resolveOpportunityCatalog } from '../auth/planningStudent.js'

export const recommendationRoutes = Router()

recommendationRoutes.get('/', async (request, response) => {
  const interests = typeof request.query.interests === 'string' ? request.query.interests.toLowerCase().split(',').map((item) => item.trim()) : []
  response.setHeader('Cache-Control', 'no-store')
  try {
    const { scope, catalog } = await resolveOpportunityCatalog(request)
    response.json(recommend({ ...scope, interests }, catalog))
  } catch {
    response.status(503).json({ code: 'PLANNING_UNAVAILABLE', message: 'No pudimos cargar tus recomendaciones. Intenta de nuevo.' })
  }
})
