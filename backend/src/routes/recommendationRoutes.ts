import { Router } from 'express'
import { recommend } from '../data/recommendations.js'

export const recommendationRoutes = Router()

recommendationRoutes.get('/', (request, response) => {
  const career = typeof request.query.career === 'string' ? request.query.career : undefined
  const semester = typeof request.query.semester === 'string' ? Number(request.query.semester) : undefined
  const interests = typeof request.query.interests === 'string' ? request.query.interests.toLowerCase().split(',').map((item) => item.trim()) : []
  response.json(recommend({ career, semester, interests }))
})
