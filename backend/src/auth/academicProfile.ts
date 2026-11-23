import type { Request } from 'express'
import { identityClaims } from './identity.js'
import { campuses, programs } from '../data/academic.js'
import type { AssistantProfile, CareerId } from '../assistant/types.js'

/** Trusted academic claims only; browser-supplied profile fields never enter this object. */
export function verifiedAcademicProfile(request: Request): AssistantProfile {
  const claims = identityClaims(request) ?? {}
  const profile: AssistantProfile = {}
  if (typeof claims.name === 'string') profile.name = claims.name.trim().slice(0, 100)
  const campus = claims['custom:campusCode']
  if (typeof campus === 'string' && campuses.some(item => item.value === campus)) profile.campus = campus
  const career = claims['custom:career']
  if (typeof career === 'string' && (career === 'banking' || programs.some(item => item.value === career))) profile.career = career as CareerId
  const semester = Number(claims['custom:semestre'])
  if (Number.isInteger(semester) && semester >= 1 && semester <= 10) profile.currentSemester = semester
  if (claims['custom:personaId'] === 'ana' && profile.career === 'accounting' && profile.campus === 'QRO' && semester === 7) {
    profile.demoWorkSchedule = 'works-afternoons'
  }
  return profile
}
