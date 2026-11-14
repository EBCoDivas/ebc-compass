import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { CreateStudentProfile, StudentProfile } from '../types/studentProfile.js'

const profiles: StudentProfile[] = []
export const profileRoutes = Router()

profileRoutes.get('/', (_request, response) => {
  response.json(profiles)
})

profileRoutes.post('/', (request, response) => {
  const profile = request.body as Partial<CreateStudentProfile>

  if (!profile.name || !profile.campus || !profile.career || !profile.currentSemester) {
    response.status(400).json({ message: 'Los campos básicos del perfil son obligatorios.' })
    return
  }

  const newProfile: StudentProfile = {
    id: randomUUID(),
    name: profile.name,
    campus: profile.campus,
    career: profile.career,
    currentSemester: profile.currentSemester,
    completedCourses: profile.completedCourses ?? [],
    interests: profile.interests ?? [],
    goals: profile.goals ?? '',
  }

  profiles.push(newProfile)
  response.status(201).json(newProfile)
})
