import { Router } from 'express'
import type { DocumentStore } from '../assistant/conversations/store.js'
import { resolvePlanningStudent } from '../auth/planningStudent.js'
import { studentPlanning } from '../data/studentPlanning.js'
import { readConfirmedStudentActions } from '../planning/confirmedActions.js'
import { buildStudentJourney } from '../planning/studentJourney.js'

export function createStudentPlanningRoutes(store: Pick<DocumentStore, 'get'>) {
  const router = Router()

  router.get('/', async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    try {
      const student = await resolvePlanningStudent(request)
      if (!student) { response.status(401).json({ code: 'UNAUTHORIZED', message: 'Inicia sesión para consultar tus pendientes.' }); return }
      const actions = await readConfirmedStudentActions(store, student.subject)
      response.json(buildStudentJourney(studentPlanning(student), student.subject, actions))
    } catch {
      response.status(503).json({ code: 'PLANNING_UNAVAILABLE', message: 'No pudimos cargar tus pendientes. Intenta de nuevo.' })
    }
  })
  return router
}
