import { matchesAcademicScope, levelForCareer } from '../../data/academic.js'
// Adaptadores provisionales sobre los datos que existen hoy en el backend (backend/src/data/opportunities.ts).
// Si el catálogo cambia (más tipos, códigos, prerrequisitos), solo hay que ajustar este archivo.

import { opportunities as rawOpportunities } from '../../data/opportunities.js'
import { matchesOpportunityStage } from '../../data/opportunityScope.js'
import { recommend } from '../../data/recommendations.js'
import type {
  AssistantOpportunity,
  AssistantProfile,
  CatalogReader,
  DatesProvider,
  ImportantDate,
  OpportunityType,
  RecommendationProvider,
} from '../types.js'
import { daysBetween } from '../domain/text.js'

type RawOpportunity = (typeof rawOpportunities)[number]

/** "course-fin-301" -> "FIN-301". Los ids sin esa forma no tienen código. */
function codeFromId(id: string): string | undefined {
  const match = id.match(/^course-([a-z]{3})-(\d{3})$/)
  return match ? `${match[1].toUpperCase()}-${match[2]}` : undefined
}

function toAssistant(raw: RawOpportunity): AssistantOpportunity {
  return {
    id: raw.id,
    type: raw.type as OpportunityType,
    title: raw.title,
    description: raw.description,
    careers: raw.career,
    semesters: raw.semester,
    stage: raw.stage,
    campus: raw.campus,
    level: raw.level,
    simulated: raw.simulated,
    deadline: raw.deadline,
    location: raw.location,
    code: codeFromId(raw.id),
  }
}

export class InMemoryCatalog implements CatalogReader {
  private readonly items: AssistantOpportunity[]

  constructor(items: AssistantOpportunity[] = rawOpportunities.map(toAssistant)) {
    this.items = items
  }

  async list(filter: { type?: OpportunityType; career?: string; semester?: number; campus?: string; level?: string } = {}): Promise<AssistantOpportunity[]> {
    return this.items.filter(
      (item) =>
        matchesAcademicScope(item, filter) &&
        (!filter.type || item.type === filter.type) &&
        (!filter.career || item.careers.includes(filter.career)) &&
        matchesOpportunityStage(item.stage ?? 'all', item.semesters, filter.semester),
    )
  }

  async findByCode(code: string): Promise<AssistantOpportunity | undefined> {
    return this.items.find((item) => item.code === code.toUpperCase())
  }
}

/**
 * Recomendaciones con la misma regla que /api/recommendations (carrera, semestre e intereses), sin cursos ya
 * completados ni oportunidades vencidas. Sin perfil, se ofrecen las vigentes más próximas a vencer.
 */
export class ProfileRecommendations implements RecommendationProvider {
  constructor(
    private readonly catalog: CatalogReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async recommend(profile: AssistantProfile | undefined, limit: number): Promise<AssistantOpportunity[]> {
    const today = this.now()
    const all = await this.catalog.list({ campus: profile?.campus, career: profile?.career, semester: profile?.currentSemester })
    const completed = (profile?.completedCourses ?? []).map((code) => code.toUpperCase())
    const alive = all.filter((item) => (!item.deadline || daysBetween(today, item.deadline) >= 0) && !(item.code && completed.includes(item.code)))

    const scored = recommend({
      campus: profile?.campus,
      career: profile?.career,
      today,
      semester: profile?.currentSemester,
      interests: (profile?.interests ?? []).map((interest) => interest.toLowerCase()),
    })
    const ranked = scored.map((entry) => alive.find((item) => item.id === entry.opportunity.id)).filter((item): item is AssistantOpportunity => item !== undefined)
    if (ranked.length > 0) return ranked.slice(0, limit)

    return alive.sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')).slice(0, limit)
  }
}

/** Fechas importantes provisionales: los vencimientos del catálogo dentro de la ventana pedida. */
export class CatalogDates implements DatesProvider {
  constructor(private readonly catalog: CatalogReader) {}

  async upcoming(profile: AssistantProfile | undefined, days: number, today: Date): Promise<ImportantDate[]> {
    const all = await this.catalog.list({ career: profile?.career, campus: profile?.campus, level: levelForCareer(profile?.career), semester: profile?.currentSemester })
    return all
      .filter((item): item is AssistantOpportunity & { deadline: string } => {
        if (!item.deadline) return false
        const remaining = daysBetween(today, item.deadline)
        return remaining >= 0 && remaining <= days
      })
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .map((item) => ({ title: item.title, date: item.deadline, type: item.type, opportunityId: item.id }))
  }
}
