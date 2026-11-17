import { levelForCareer, matchesAcademicScope } from '../../data/academic.js'
// Construye la hoja de hechos (FactSheet): lo único que el asistente (o el LLM) puede afirmar.
// Todo es determinista: mismos datos de entrada, misma hoja.

import type {
  AssistantOpportunity,
  AssistantProfile,
  CareerId,
  CatalogReader,
  Classification,
  DatesProvider,
  Entities,
  FactItem,
  FactNote,
  FactSheet,
  Language,
  RecommendationProvider,
} from '../types.js'
import { daysBetween } from './text.js'

export interface FactDeps {
  catalog: CatalogReader
  recommendations: RecommendationProvider
  dates: DatesProvider
}

const REQUIRED_FIELDS = ['name', 'campus', 'career', 'currentSemester'] as const
export type RequiredField = (typeof REQUIRED_FIELDS)[number]

/** Campos obligatorios del perfil que faltan y completitud (BR-05: requeridos llenos / total). */
export function profileStatus(profile: AssistantProfile | undefined): { missing: RequiredField[]; completeness: number } {
  const missing = REQUIRED_FIELDS.filter((field) => {
    const value = profile?.[field]
    return value === undefined || value === null || value === ''
  })
  return { missing, completeness: Math.round(((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length) * 100) }
}

function toFactItem(item: AssistantOpportunity, profile: AssistantProfile | undefined, today: Date): FactItem {
  let matchesProfile: boolean | undefined
  if (profile?.career) {
    const careerOk = item.careers.includes(profile.career)
    const semesterOk = !item.semesters || !profile.currentSemester || item.semesters.includes(profile.currentSemester)
    matchesProfile = careerOk && semesterOk && matchesAcademicScope(item, profile)
  }
  const completed = (profile?.completedCourses ?? []).map((code) => code.toUpperCase())
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    deadline: item.deadline,
    daysRemaining: item.deadline ? daysBetween(today, item.deadline) : undefined,
    location: item.location,
    code: item.code,
    prerequisites: item.prerequisites,
    matchesProfile,
    alreadyCompleted: item.code ? completed.includes(item.code) : undefined,
  }
}

const byDeadline = (a: FactItem, b: FactItem) => (a.deadline ?? '9999-12-31').localeCompare(b.deadline ?? '9999-12-31')
const notExpired = (item: FactItem) => item.daysRemaining === undefined || item.daysRemaining >= 0

export async function buildFactSheet(input: {
  classification: Classification
  entities: Entities
  profile: AssistantProfile | undefined
  language: Language
  deps: FactDeps
  today: Date
}): Promise<FactSheet> {
  const { classification, entities, profile, language, deps, today } = input
  const { intent, focus } = classification
  const status = profileStatus(profile)
  const careerFilter: CareerId | undefined = entities.careers[0] ?? profile?.career
  const notes: FactNote[] = []
  let items: FactItem[] = []

  const catalog = await deps.catalog.list({ campus: profile?.campus, level: levelForCareer(careerFilter) })
  const mentioned = catalog.filter((item) => entities.opportunityIds.includes(item.id))
  const asItems = (list: AssistantOpportunity[]) => list.map((item) => toFactItem(item, profile, today))

  switch (intent) {
    case 'scholarship-info': {
      const pool = mentioned.filter((item) => item.type === 'scholarship')
      items = pool.length > 0 ? asItems(pool) : asItems(catalog.filter((i) => i.type === 'scholarship' && (!careerFilter || i.careers.includes(careerFilter)))).filter(notExpired)
      items.sort(byDeadline)
      break
    }
    case 'course-info': {
      const byCode = (await Promise.all(entities.courseCodes.map((code) => deps.catalog.findByCode(code)))).filter(
        (item): item is AssistantOpportunity => item !== undefined,
      )
      const specific = [...byCode, ...mentioned.filter((item) => item.type === 'course' && !byCode.some((c) => c.id === item.id))]
      if (specific.length > 0) items = asItems(specific)
      else {
        const semester = profile?.currentSemester
        items = asItems(
          catalog.filter(
            (i) => i.type === 'course' && (!careerFilter || i.careers.includes(careerFilter)) && (!semester || !i.semesters || i.semesters.includes(semester)),
          ),
        )
      }
      if (items.some((item) => item.prerequisites === undefined)) notes.push('no-prerequisite-data')
      break
    }
    case 'procedure-info': {
      const pool = mentioned.filter((item) => item.type === 'procedure')
      items = (pool.length > 0 ? asItems(pool) : asItems(catalog.filter((i) => i.type === 'procedure'))).filter(notExpired).sort(byDeadline)
      break
    }
    case 'event-info': {
      const pool = mentioned.filter((item) => item.type === 'event')
      items = (pool.length > 0 ? asItems(pool) : asItems(catalog.filter((i) => i.type === 'event' && (!careerFilter || i.careers.includes(careerFilter)))))
        .filter(notExpired)
        .sort(byDeadline)
      break
    }
    case 'career-info': {
      const careerTypes = ['professional-development', 'career-opportunity']
      const pool = mentioned.filter((item) => careerTypes.includes(item.type))
      const semester = profile?.currentSemester
      items =
        pool.length > 0
          ? asItems(pool)
          : asItems(
              catalog.filter(
                (i) => careerTypes.includes(i.type) && (!careerFilter || i.careers.includes(careerFilter)) && (!semester || !i.semesters || i.semesters.includes(semester)),
              ),
            )
      items = items.filter(notExpired).sort(byDeadline)
      break
    }
    case 'recommendation-request': {
      items = asItems(await deps.recommendations.recommend(profile, 5))
      break
    }
    case 'deadline-query': {
      if (mentioned.some((item) => item.deadline)) {
        items = asItems(mentioned.filter((item) => item.deadline)).sort(byDeadline)
      } else {
        const dates = await deps.dates.upcoming(profile, 45, today)
        const ids = new Set(dates.map((d) => d.opportunityId))
        items = asItems(catalog.filter((item) => ids.has(item.id))).sort(byDeadline)
      }
      break
    }
    default:
      break
  }

  const needsData = ['scholarship-info', 'course-info', 'procedure-info', 'event-info', 'career-info', 'recommendation-request', 'deadline-query'].includes(intent)
  if (needsData && items.length === 0) notes.push('no-results')
  if (!profile?.career && needsData) notes.push('no-profile')

  return { intent, language, focus, items, missingProfileFields: status.missing, completeness: status.completeness, notes, careerFilter }
}
