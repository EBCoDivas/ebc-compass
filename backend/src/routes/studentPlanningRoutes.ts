import { Router } from 'express'
import { resolvePlanningStudent } from '../auth/planningStudent.js'
import { studentPlanning } from '../data/studentPlanning.js'

export const studentPlanningRoutes = Router()

studentPlanningRoutes.get('/', async (request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  try {
    const student = await resolvePlanningStudent(request)
    if (!student) { response.status(401).json({ code: 'UNAUTHORIZED', message: 'Inicia sesión para consultar tus pendientes.' }); return }
    response.json(studentPlanning(student))
  } catch {
    response.status(503).json({ code: 'PLANNING_UNAVAILABLE', message: 'No pudimos cargar tus pendientes. Intenta de nuevo.' })
  }
})
