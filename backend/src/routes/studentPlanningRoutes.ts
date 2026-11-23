import { Router } from 'express'
import type { DocumentStore } from '../assistant/conversations/store.js'
import { resolvePlanningStudent } from '../auth/planningStudent.js'
import { fixedBanner, type BannerReader } from '../banner/reader.js'
import { readStudentJourney } from '../planning/readStudentJourney.js'

export function createStudentPlanningRoutes(store: Pick<DocumentStore, 'get'>, banner: BannerReader = fixedBanner) {
  const router = Router()

  router.get('/', async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    try {
      const student = await resolvePlanningStudent(request)
      if (!student) { response.status(401).json({ code: 'UNAUTHORIZED', message: 'Inicia sesión para consultar tus pendientes.' }); return }
      response.json(await readStudentJourney(student, banner, store))
    } catch {
      response.status(503).json({ code: 'PLANNING_UNAVAILABLE', message: 'No pudimos cargar tus pendientes. Intenta de nuevo.' })
    }
  })
  return router
}
