export type OpportunityType = 'course' | 'scholarship' | 'professional-development' | 'event' | 'procedure' | 'career-opportunity'

export interface Opportunity {
  id: string
  type: OpportunityType
  title: string
  description: string
  career: string[]
  semester?: number[]
  deadline?: string
  location?: string
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function fetchOpportunities(params: { type?: string; career?: string; semester?: number; search?: string } = {}): Promise<Opportunity[]> {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value).map(([key, value]) => [key, String(value)]))
  const response = await fetch(`${API_URL}/api/opportunities?${query}`)
  if (!response.ok) throw new Error('No fue posible cargar las oportunidades.')
  return response.json() as Promise<Opportunity[]>
}

