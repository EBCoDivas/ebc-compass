import { normalize } from '../assistant/domain/text.js'
import { matchesAcademicScope } from './academic.js'
import { opportunities, type Opportunity } from './opportunities.js'

export interface Recommendation {
  opportunity: Opportunity
  relevanceScore: number
  explanation: string
}

/** Regla de recomendación por carrera, semestre e intereses. La usan la ruta /api/recommendations y el asistente. */
export function recommend(options: { career?: string; semester?: number; interests?: string[]; campus?: string; level?: string; today?: Date }, catalog: readonly Opportunity[] = opportunities): Recommendation[] {
  const { career, semester } = options
  const interests = options.interests ?? []
  const today = (options.today ?? new Date()).toISOString().slice(0, 10)
  return catalog
    .filter(item => matchesAcademicScope(item, options) &&
      (!career || item.career.includes(career)) &&
      (!semester || !item.semester || item.semester.includes(semester)) &&
      (!item.deadline || item.deadline >= today))
    .map((opportunity) => {
      const careerMatch = career && opportunity.career.includes(career) ? 30 : 0
      const semesterMatch = semester && (!opportunity.semester || opportunity.semester.includes(semester)) ? 20 : 0
      const matchedInterests = interests.filter(interest => interest.trim() && normalize(`${opportunity.title} ${opportunity.description}`).includes(normalize(interest)))
      const interestMatch = matchedInterests.length * 10
      const reasons = [careerMatch ? 'Coincide con tu carrera.' : '',
        semesterMatch && opportunity.semester ? 'Está disponible para tu periodo académico.' : '',
        options.campus && opportunity.campus?.includes(options.campus) ? 'Se ofrece en tu campus.' : '',
        matchedInterests.length ? `Se relaciona con tus intereses: ${matchedInterests.join(', ')}.` : '',
      ].filter(Boolean)
      return { opportunity, relevanceScore: careerMatch + semesterMatch + interestMatch, explanation: reasons.join(' ') || 'Puede complementar tu desarrollo académico.' }
    })
    .filter((item) => item.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
}
