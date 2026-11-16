import { Router } from 'express'
import { opportunities } from '../data/opportunities.js'

export const recommendationRoutes = Router()

recommendationRoutes.get('/', (request, response) => {
  const career = typeof request.query.career === 'string' ? request.query.career : undefined
  const semester = typeof request.query.semester === 'string' ? Number(request.query.semester) : undefined
  const interests = typeof request.query.interests === 'string' ? request.query.interests.toLowerCase().split(',').map((item) => item.trim()) : []
  const recommendations = opportunities.map((opportunity) => {
    const careerMatch = career && opportunity.career.includes(career) ? 30 : 0
    const semesterMatch = semester && (!opportunity.semester || opportunity.semester.includes(semester)) ? 20 : 0
    const interestMatch = interests.filter((interest) => `${opportunity.title} ${opportunity.description}`.toLowerCase().includes(interest)).length * 10
    return { opportunity, relevanceScore: careerMatch + semesterMatch + interestMatch, explanation: careerMatch ? 'Coincide con tu carrera y semestre.' : 'Puede complementar tu desarrollo académico.' }
  }).filter((item) => item.relevanceScore > 0).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10)
  response.json(recommendations)
})
