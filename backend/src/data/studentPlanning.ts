import type { Opportunity, StudentPending, StudentPlanning } from '../../../shared/contracts/studentPlanning.js'
import { allCareers } from './academic.js'
import { legacyOpportunities } from './opportunities.js'
import { matchesOpportunityScope, stageForPeriod, type OpportunityScope } from './opportunityScope.js'
import { careerCatalog, stageCatalog } from './planningCatalog.js'

export interface PlanningStudent extends OpportunityScope { personaId?: string }

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
const demoProgress = {
  ana: {
    opportunityId: 'accounting-social-service', completedHours: 260, requiredHours: 480, weeklyHours: 6,
    asOf: '2026-11-22', graduationId: 'accounting-graduation',
  },
  sofia: {
    opportunityId: 'law-social-service', completedHours: 468, requiredHours: 480, weeklyHours: 12,
    asOf: '2026-11-22', graduationId: 'law-graduation',
  },
} as const

/** Lo que Ana logró en su primer semestre (agosto de 2023): se conserva al llegar a 7.º. */
const demoAchievementHistory = {
  ana: [
    { id: 'payment-slip-generated', earnedAt: '2023-07-24' },
    { id: 'scholarship-requested', earnedAt: '2023-08-04' },
  ],
} as const

export function studentPlanning(student: PlanningStudent): StudentPlanning {
  const stage = stageForPeriod(student.semester)
  const catalog = planningOpportunities(student)
  const progress = student.personaId === 'ana' || student.personaId === 'sofia' ? demoProgress[student.personaId] : undefined
  const graduationDeadline = progress && catalog.find(item => item.id === progress.graduationId)?.deadline
  const pending = catalog.flatMap((item): StudentPending[] => {
    if (!pendingIds.has(item.id) || !item.deadline || (stage && item.id === 'procedure-academic-dates')) return []
    return [{ opportunityId: item.id, dueDate: item.deadline, status: item.id === progress?.opportunityId ? 'in-progress' : 'pending' }]
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return {
    stage, catalog, pending,
    ...(student.personaId === 'ana-ingreso' && student.career === 'accounting' && student.campus === 'QRO' && student.semester === 1
      ? { firstEntry: { highSchoolGpa: 9.2, admissionLetter: true, motivationLetter: false } } : {}),
    ...(student.personaId === 'ana' && student.career === 'accounting' && student.campus === 'QRO'
      ? { achievementHistory: demoAchievementHistory.ana.map(item => ({ ...item })) } : {}),
    ...(progress && graduationDeadline ? { socialService: {
      completedHours: progress.completedHours, requiredHours: progress.requiredHours,
      weeklyHours: progress.weeklyHours, asOf: progress.asOf, graduationDeadline,
    } } : {}),
  }
}
