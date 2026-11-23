import { Router } from 'express'
import { identityClaims, identitySubject } from '../auth/identity.js'
import { demoAcademicProgress, type AcademicProgressReader } from '../data/studentAcademicProgress.js'

export function createAcademicProgressRoutes(reader: AcademicProgressReader = demoAcademicProgress) {
  const router = Router()
  router.get('/', async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    const id = identitySubject(request)
    if (!id) { response.status(401).json({ code: 'UNAUTHORIZED', message: 'Inicia sesión para consultar tu avance académico.' }); return }
    const claims = identityClaims(request)!
    const claim = (key: string) => typeof claims[key] === 'string' ? claims[key] as string : undefined
    try {
      const progress = await reader.read({ id, personaId: claim('custom:personaId'), enrollment: claim('custom:matricula'),
        career: claim('custom:career'), campus: claim('custom:campusCode'), semester: Number(claim('custom:semestre')) || undefined })
      response.json({ progress })
    } catch {
      response.status(503).json({ code: 'ACADEMIC_PROGRESS_UNAVAILABLE', message: 'No pudimos cargar tu avance académico. Intenta de nuevo.' })
    }
  })
  return router
}
export const academicProgressRoutes = createAcademicProgressRoutes()
