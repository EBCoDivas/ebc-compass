import { sessionFetch } from './session'
import type { Opportunity, StudentJourney } from '../../../shared/contracts/studentPlanning'
import type { ProactiveNotice } from '../../../shared/contracts/proactive'
export type { Opportunity, OpportunityType } from '../../../shared/contracts/studentPlanning'

export interface Recommendation { opportunity: Opportunity; relevanceScore: number; explanation: string }
export interface Alert { id: string; opportunityId: string; title: string; deadline: string; daysRemaining: number; urgency: 'urgent' | 'soon' | 'future' }

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function fetchOpportunities(params: { type?: string; career?: string; semester?: number; search?: string; campus?: string; level?: string } = {}): Promise<Opportunity[]> {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value).map(([key, value]) => [key, String(value)]))
  const response = await sessionFetch(`${API_URL}/api/opportunities?${query}`)
  if (!response.ok) throw new Error('No fue posible cargar las oportunidades.')
  return response.json() as Promise<Opportunity[]>
}

export async function fetchRecommendations(profile: { career?: string; currentSemester?: number | 'na' | ''; interests?: string[]; campus?: string; level?: string }): Promise<Recommendation[]> {
  const params = new URLSearchParams({ career: profile.career ?? '', semester: String(profile.currentSemester ?? ''), interests: (profile.interests ?? []).join(','), campus: profile.campus ?? '', level: profile.level ?? '' })
  const response = await sessionFetch(`${API_URL}/api/recommendations?${params}`)
  if (!response.ok) throw new Error('No fue posible cargar las recomendaciones.')
  return response.json() as Promise<Recommendation[]>
}

export async function fetchAlerts(params: { career?: string; semester?: number; campus?: string } = {}): Promise<Alert[]> {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value).map(([key, value]) => [key, String(value)]))
  const response = await sessionFetch(`${API_URL}/api/alerts?${query}`)
  if (!response.ok) throw new Error('No fue posible cargar las alertas.')
  return response.json() as Promise<Alert[]>
}

export async function fetchStudentPlanning(): Promise<StudentJourney> {
  const response = await sessionFetch(`${API_URL}/api/student-planning`)
  if (!response.ok) throw new Error('No fue posible cargar tus pendientes.')
  return response.json() as Promise<StudentJourney>
}

export async function ensureProactiveNotices(): Promise<ProactiveNotice[]> {
  const response = await sessionFetch(`${API_URL}/api/proactive/notices/ensure`, { method: 'POST' })
  if (!response.ok) throw new Error('No fue posible cargar tus avisos.')
  return (await response.json() as { notices: ProactiveNotice[] }).notices
}

export async function createProactiveConversation(noticeId: string): Promise<string> {
  const response = await sessionFetch(`${API_URL}/api/proactive/notices/${encodeURIComponent(noticeId)}/conversation`, { method: 'POST' })
  if (!response.ok) throw new Error('No fue posible abrir el mensaje de Compass.')
  return (await response.json() as { conversationId: string }).conversationId
}

