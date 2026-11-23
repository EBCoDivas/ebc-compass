import { Router } from 'express'
import { resolveOpportunityCatalog } from '../auth/planningStudent.js'

export const opportunityRoutes = Router()

opportunityRoutes.get('/', async (request, response) => {
  const type = typeof request.query.type === 'string' ? request.query.type : undefined
  const search = typeof request.query.search === 'string' ? request.query.search.toLowerCase() : undefined
  response.setHeader('Cache-Control', 'no-store')
  try {
    const { catalog } = await resolveOpportunityCatalog(request)
    response.json(catalog.filter(item => (!type || item.type === type) &&
      (!search || `${item.title} ${item.description}`.toLowerCase().includes(search))))
  } catch {
    response.status(503).json({ code: 'PLANNING_UNAVAILABLE', message: 'No pudimos cargar tus oportunidades. Intenta de nuevo.' })
  }
})

