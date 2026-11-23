import type { Opportunity, StudentPending, StudentPlanning } from '../../../shared/contracts/studentPlanning.js'
import { allCareers } from './academic.js'
import { legacyOpportunities } from './opportunities.js'
import { matchesOpportunityScope, stageForPeriod, type OpportunityScope } from './opportunityScope.js'
import { careerCatalog, stageCatalog } from './planningCatalog.js'
import { demoAcademicSnapshots, type BannerRecord } from '../banner/fixtures.js'
import { matchesBannerStudent } from '../banner/reader.js'

export interface PlanningStudent extends OpportunityScope { personaId?: string; enrollment?: string }

const continuingEducation = new Set(['course-data', 'event-exu', 'development-exu', 'course-accounting', 'course-marketing', 'course-law', 'career-law'])
const planningCatalog = [...stageCatalog, ...careerCatalog, ...legacyOpportunities.filter(item => continuingEducation.has(item.id))]

export function planningOpportunities(student: PlanningStudent): Opportunity[] {
  const stage = stageForPeriod(student.semester)
  return planningCatalog.filter(item =>
    (stage || (item.stage === 'all' && !item.semester)) &&
    (student.career || item.career.length === allCareers.length) &&
    matchesOpportunityScope(item, student),
  )
}

const pendingIds = new Set([
  ...stageCatalog.map(item => item.id),
  'accounting-social-service', 'accounting-graduation', 'marketing-internship',
  'marketing-social-service', 'marketing-graduation', 'law-social-service', 'law-graduation',
])

/** Lo que Ana logró en su primer semestre (agosto de 2023): se conserva al llegar a 7.º. */
const demoAchievementHistory = {
  ana: [
    { id: 'payment-slip-generated', earnedAt: '2023-07-24' },
    { id: 'scholarship-requested', earnedAt: '2023-08-04' },
  ],
} as const

export function studentPlanning(student: PlanningStudent,
  record = (student.personaId && Object.hasOwn(demoAcademicSnapshots, student.personaId) ? demoAcademicSnapshots[student.personaId] : null) as BannerRecord | null,
): StudentPlanning {
  const stage = stageForPeriod(student.semester)
  const catalog = planningOpportunities(student)
  const academic = record && matchesBannerStudent(record, student) ? record : null
  const hours = academic?.serviceHours
  const service = hours && catalog.find(item => item.id === student.career + '-social-service')
  const graduationDeadline = service && catalog.find(item => item.id === student.career + '-graduation')?.deadline
  const pending = catalog.flatMap((item): StudentPending[] => {
    if (!pendingIds.has(item.id) || !item.deadline || (stage && item.id === 'procedure-academic-dates')) return []
    return [{ opportunityId: item.id, dueDate: item.deadline, status: item.id === service?.id ? 'in-progress' : 'pending' }]
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return {
    stage, catalog, pending,
    ...(academic?.firstEntry && stage === 'entry' ? { firstEntry: academic.firstEntry } : {}),
    ...(student.personaId === 'ana' && student.career === 'accounting' && student.campus === 'QRO'
      ? { achievementHistory: demoAchievementHistory.ana.map(item => ({ ...item })) } : {}),
    ...(hours && service?.serviceHoursRequired && graduationDeadline
      ? { socialService: { ...hours, requiredHours: service.serviceHoursRequired, graduationDeadline } } : {}),
  }
}
