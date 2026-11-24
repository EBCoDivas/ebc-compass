import { Router } from 'express'
import { resolvePlanningStudent } from '../auth/planningStudent.js'
import type { BannerClient } from '../banner/reader.js'
import { buildStudentRequests } from '../planning/studentRequests.js'

/** «Mis solicitudes»: lo que el alumno ha pedido en EBC y cómo va, leído de Banner con la identidad de su sesión. */
export function createStudentRequestRoutes(banner: Pick<BannerClient, 'readRecord' | 'readActions'>) {
  const router = Router()
  router.get('/', async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    try {
      const student = await resolvePlanningStudent(request)
      if (!student) { response.status(401).json({ code: 'UNAUTHORIZED', message: 'Inicia sesión para consultar tus solicitudes.' }); return }
      const academic = { ...student, id: student.subject }
      const [record, actions] = await Promise.all([banner.readRecord(academic), banner.readActions(academic)])
      response.json({ requests: buildStudentRequests(record, actions) })
    } catch {
      response.status(503).json({ code: 'REQUESTS_UNAVAILABLE', message: 'No pudimos cargar tus solicitudes. Intenta de nuevo.' })
    }
  })
  return router
}
