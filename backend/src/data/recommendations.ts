import { opportunities, type Opportunity } from './opportunities.js'

export interface Recommendation {
  opportunity: Opportunity
  relevanceScore: number
  explanation: string
}

/** Regla de recomendación por carrera, semestre e intereses. La usan la ruta /api/recommendations y el asistente. */
export function recommend(options: { career?: string; semester?: number; interests?: string[] }): Recommendation[] {
  const { career, semester } = options
  const interests = options.interests ?? []
  return opportunities
    .map((opportunity) => {
      const careerMatch = career && opportunity.career.includes(career) ? 30 : 0
      const semesterMatch = semester && (!opportunity.semester || opportunity.semester.includes(semester)) ? 20 : 0
      const interestMatch = interests.filter((interest) => `${opportunity.title} ${opportunity.description}`.toLowerCase().includes(interest)).length * 10
      return { opportunity, relevanceScore: careerMatch + semesterMatch + interestMatch, explanation: careerMatch ? 'Coincide con tu carrera y semestre.' : 'Puede complementar tu desarrollo académico.' }
    })
    .filter((item) => item.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10)
}
