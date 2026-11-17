import { sessionFetch } from './session'
export type OpportunityType = 'course' | 'scholarship' | 'professional-development' | 'event' | 'procedure' | 'career-opportunity'

export interface Opportunity {
  id: string
  type: OpportunityType
  title: string
  description: string
  career: string[]
  campus?: string[]
  level?: string[]
  simulated?: boolean
  semester?: number[]
  deadline?: string
  location?: string
}

export interface Recommendation { opportunity: Opportunity; relevanceScore: number; explanation: string }
export interface Alert { id: string; opportunityId: string; title: string; deadline: string; daysRemaining: number; urgency: 'urgent' | 'soon' | 'future' }

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function fetchOpportunities(params: { type?: string; career?: string; semester?: number; search?: string; campus?: string; level?: string } = {}): Promise<Opportunity[]> {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value).map(([key, value]) => [key, String(value)]))
  const token = getToken()
  const response = await sessionFetch(`${API_URL}/api/opportunities?${query}`, { headers: token ? { authorization: `Bearer ${token}` } : undefined })
  if (!response.ok) throw new Error('No fue posible cargar las oportunidades.')
  return response.json() as Promise<Opportunity[]>
}

export async function fetchRecommendations(profile: { career?: string; currentSemester?: number | 'na' | ''; interests?: string[]; campus?: string; level?: string }): Promise<Recommendation[]> {
  const params = new URLSearchParams({ career: profile.career ?? '', semester: String(profile.currentSemester ?? ''), interests: (profile.interests ?? []).join(','), campus: profile.campus ?? '', level: profile.level ?? '' })
  const token = getToken()
  const response = await sessionFetch(`${API_URL}/api/recommendations?${params}`, { headers: token ? { authorization: `Bearer ${token}` } : undefined })
  if (!response.ok) throw new Error('No fue posible cargar las recomendaciones.')
  return response.json() as Promise<Recommendation[]>
}

export async function fetchAlerts(): Promise<Alert[]> {
  const token = getToken()
  const response = await sessionFetch(`${API_URL}/api/alerts`, { headers: token ? { authorization: `Bearer ${token}` } : undefined })
  if (!response.ok) throw new Error('No fue posible cargar las alertas.')
  return response.json() as Promise<Alert[]>
}

import { getToken } from './authService'

