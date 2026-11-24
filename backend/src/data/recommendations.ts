import { daysBetween, normalize } from '../assistant/domain/text.js'
import { currentCatalog } from '../catalog/catalog.js'
import type { Opportunity } from './opportunities.js'
import { matchesOpportunityScope } from './opportunityScope.js'

export interface Recommendation {
  opportunity: Opportunity
  relevanceScore: number
  explanation: string
}

/** Regla de recomendación por carrera, semestre e intereses. La usan la ruta /api/recommendations y el asistente. */
export function recommend(options: { career?: string; semester?: number; interests?: string[]; campus?: string; level?: string; today?: Date }, catalog: readonly Opportunity[] = currentCatalog().all): Recommendation[] {
  const { career, semester } = options
  const interests = options.interests ?? []
  const today = options.today ?? new Date()
  return catalog
    .filter(item => matchesOpportunityScope(item, options) && (!item.deadline || daysBetween(today, item.deadline) >= 0))
    .map((opportunity) => {
      const careerMatch = career && opportunity.career.includes(career) ? 30 : 0
      const careerSpecific = careerMatch > 0 && opportunity.career.length === 1 ? 15 : 0
      const semesterMatch = semester && (!opportunity.semester || opportunity.semester.includes(semester)) ? 20 : 0
      const matchedInterests = interests.filter(interest => interest.trim() && normalize(`${opportunity.title} ${opportunity.description}`).includes(normalize(interest)))
      const interestMatch = matchedInterests.length * 10
      const reasons = [careerMatch ? 'Coincide con tu carrera.' : '',
        semesterMatch && (opportunity.semester || opportunity.stage !== 'all') ? 'Está disponible para tu periodo académico.' : '',
        options.campus && opportunity.campus?.includes(options.campus) ? 'Se ofrece en tu campus.' : '',
        matchedInterests.length ? `Se relaciona con tus intereses: ${matchedInterests.join(', ')}.` : '',
      ].filter(Boolean)
      return { opportunity, relevanceScore: careerMatch + careerSpecific + semesterMatch + interestMatch, explanation: reasons.join(' ') || 'Puede complementar tu desarrollo académico.' }
    })
    .filter((item) => item.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
}
