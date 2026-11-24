import type { StudentRequest, StudentRequestsResponse } from '../../../shared/contracts/studentRequests.js'
import { sessionFetch } from './session'
import { getToken } from './authService'

export type { StudentRequest }

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function fetchStudentRequests(): Promise<StudentRequest[]> {
  const token = getToken()
  const response = await sessionFetch(`${API_URL}/api/student-requests`, { headers: token ? { authorization: `Bearer ${token}` } : undefined })
  if (!response.ok) throw new Error('No fue posible cargar tus solicitudes.')
  return (await response.json() as StudentRequestsResponse).requests
}
