import { Router } from 'express'
import { opportunities } from '../data/opportunities.js'

export const alertRoutes = Router()

alertRoutes.get('/', (_request, response) => {
  const today = new Date()
  const alerts = opportunities.filter((item) => item.deadline).map((item) => {
    const daysRemaining = Math.ceil((new Date(`${item.deadline}T23:59:59`).getTime() - today.getTime()) / 86400000)
    return { id: `deadline-${item.id}`, opportunityId: item.id, title: item.title, deadline: item.deadline, daysRemaining, urgency: daysRemaining <= 3 ? 'urgent' : daysRemaining <= 7 ? 'soon' : 'future' }
  }).filter((alert) => alert.daysRemaining >= 0).sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 5)
  response.json(alerts)
})
