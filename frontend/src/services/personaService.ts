import personas from '../../../shared/personas.json'
import { emptyProfile, type StudentProfile } from '../types/profile'
import { getToken, sessionSubject, tokenClaims } from './session'

export { personas }
export function activePersona() {
  const id = tokenClaims(getToken())?.['custom:personaId']
  return personas.find(persona => persona.id === id)
}
export function personaStorageKey(key: string): string {
  const subject = sessionSubject()
  return subject ? key + ':' + subject : key
}
export function seedProfile(): StudentProfile | null {
  const claims = tokenClaims(getToken())
  if (!claims || typeof claims.name !== 'string' || !claims.name) return null
  const persona = activePersona()
  const period = Number(claims['custom:semestre'])
  return { ...emptyProfile, id: sessionSubject() ?? '', name: claims.name,
    campus: (claims['custom:campusCode'] ?? '') as StudentProfile['campus'],
    career: (claims['custom:career'] ?? '') as StudentProfile['career'],
    currentSemester: Number.isInteger(period) && period > 0 ? period : '',
    interests: [...(persona?.interests ?? [])], completedCourses: [...(persona?.completedCourses ?? [])] }
}
export function academicDataFromClaims(token: string | null) {
  const claims = tokenClaims(token)
  if (!claims || typeof claims.name !== 'string' || !claims.name) return null
  const text = (key: string) => typeof claims[key] === 'string' ? claims[key] as string : ''
  return { enrollment: text('custom:matricula'), fullName: text('name'),
    campus: text('custom:campus'), career: text('custom:programa'),
    semester: claims['custom:semestre'] ? String(claims['custom:semestre']) + ' ' + (text('custom:periodo') || 'semestre') : '' }
}
