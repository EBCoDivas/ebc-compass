import type { AcademicProgress } from '../../../shared/contracts/academicProgress.js'
import { sessionFetch } from './session'
import { getToken } from './authService'

export type { AcademicProgress }

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function fetchAcademicProgress(): Promise<AcademicProgress | null> {
  const token = getToken()
  const response = await sessionFetch(`${API_URL}/api/academic-progress`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  })
  if (!response.ok) throw new Error('No fue posible cargar tu avance académico.')
  const body = await response.json() as { progress: AcademicProgress | null }
  return body.progress
}
