import { matchesAcademicScope } from './academic.js'
import { opportunities, type Opportunity } from './opportunities.js'

export interface Recommendation {
  opportunity: Opportunity
  relevanceScore: number
  explanation: string
}

/** Regla de recomendación por carrera, semestre e intereses. La usan la ruta /api/recommendations y el asistente. */
export function recommend(options: { career?: string; semester?: number; interests?: string[]; campus?: string; level?: string; today?: Date }): Recommendation[] {
  const { career, semester } = options
  const interests = options.interests ?? []
  const today = (options.today ?? new Date()).toISOString().slice(0, 10)
  return opportunities
    .filter(item => matchesAcademicScope(item, options) &&
      (!career || item.career.includes(career)) &&
      (!semester || !item.semester || item.semester.includes(semester)) &&
      (!item.deadline || item.deadline >= today))
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
