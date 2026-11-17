import { Router } from 'express'
import { identityClaims, identitySubject } from '../auth/identity.js'
import { DynamoProfileRepository, type ProfileRepository } from '../profiles/repository.js'
import type { StudentProfile } from '../types/studentProfile.js'

class InvalidProfile extends Error {}
function text(value: unknown, max: number, required = false): string {
  if (value === undefined && !required) return ''
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new InvalidProfile('Revisa los campos del perfil.')
  return value.trim()
}
function list(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 50) throw new InvalidProfile('La lista del perfil no es válida.')
  return value.map(item => text(item, 100, true))
}

export function createProfileRoutes(repository: ProfileRepository = new DynamoProfileRepository()) {
  const router = Router()
  router.use((request, response, next) => {
    if (!identitySubject(request)) { response.status(401).json({ code: 'UNAUTHORIZED', message: 'Inicia sesión para acceder a tu perfil.' }); return }
    next()
  })
  // Conserva el contrato existente: un arreglo vacío o con el único perfil de la sesión.
  router.get('/', async (request, response) => {
    try {
      const profile = await repository.get(identitySubject(request)!)
      response.json(profile ? [profile] : [])
    } catch {
      response.status(503).json({ code: 'PROFILE_UNAVAILABLE', message: 'No fue posible cargar tu perfil. Inténtalo de nuevo.' })
    }
  })
  router.post('/', async (request, response) => {
    try {
      const raw = request.body
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new InvalidProfile('El perfil debe ser un objeto.')
      if (raw.completeOnboarding !== undefined && typeof raw.completeOnboarding !== 'boolean') throw new InvalidProfile('La confirmación del perfil no es válida.')
      const claims = identityClaims(request)
      const semester = claims?.['custom:semestre'] ? Number(claims['custom:semestre']) : raw.currentSemester
      if (!Number.isInteger(semester) || semester < 1 || semester > 20) throw new InvalidProfile('El periodo debe estar entre 1 y 20.')
      if (raw.gpa !== undefined && (typeof raw.gpa !== 'number' || !Number.isFinite(raw.gpa) || raw.gpa < 0 || raw.gpa > 10)) throw new InvalidProfile('El promedio debe estar entre 0 y 10.')
      const profile: StudentProfile = {
        id: identitySubject(request)!,
        name: text(raw.name, 100, true),
        campus: text(claims?.['custom:campusCode'] ?? raw.campus, 100, true),
        career: text(claims?.['custom:career'] ?? raw.career, 100, true) as StudentProfile['career'],
        currentSemester: semester,
        interests: list(raw.interests),
        preferences: list(raw.preferences),
        completedCourses: list(raw.completedCourses),
        goals: text(raw.goals, 2000),
        availability: text(raw.availability, 200),
        ...(raw.gpa === undefined ? {} : { gpa: raw.gpa }),
        updatedAt: new Date().toISOString(),
      }
      const previous = await repository.get(profile.id)
      const completion = previous?.onboardingCompletedAt ?? (raw.completeOnboarding === true ? profile.updatedAt : undefined)
      if (completion) profile.onboardingCompletedAt = completion
      await repository.save(profile)
      response.status(201).json(profile)
    } catch (error) {
      if (error instanceof InvalidProfile) { response.status(400).json({ code: 'INVALID_INPUT', message: error.message }); return }
      response.status(503).json({ code: 'PROFILE_UNAVAILABLE', message: 'No se guardó tu perfil. Inténtalo de nuevo.' })
    }
  })
  return router
}
export const profileRoutes = createProfileRoutes()
