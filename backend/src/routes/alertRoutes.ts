import { Router } from 'express'
import { resolveOpportunityCatalog } from '../auth/planningStudent.js'
import { daysBetween } from '../assistant/domain/text.js'

export const alertRoutes = Router()

alertRoutes.get('/', async (request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  try {
    const { catalog } = await resolveOpportunityCatalog(request)
    const today = new Date()
    const alerts = catalog.flatMap(item => {
      if (!item.deadline) return []
      const daysRemaining = daysBetween(today, item.deadline)
      if (daysRemaining < 0) return []
      return [{ id: `deadline-${item.id}`, opportunityId: item.id, title: item.title, deadline: item.deadline, daysRemaining,
        urgency: daysRemaining <= 3 ? 'urgent' : daysRemaining <= 7 ? 'soon' : 'future' }]
    }).sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 5)
    response.json(alerts)
  } catch {
    response.status(503).json({ code: 'PLANNING_UNAVAILABLE', message: 'No pudimos cargar tus alertas. Intenta de nuevo.' })
  }
})
