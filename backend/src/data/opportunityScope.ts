import type { Opportunity, OpportunityStage, StudentStage } from '../../../shared/contracts/studentPlanning.js'
import { matchesAcademicScope } from './academic.js'

export interface OpportunityScope {
  career?: string
  campus?: string
  level?: string
  semester?: number
}

export function stageForPeriod(period?: number): StudentStage | null {
  if (period === undefined || !Number.isInteger(period) || period < 1 || period > 20) return null
  if (period <= 2) return 'entry'
  if (period <= 6) return 'middle'
  return 'closing'
}

export function matchesOpportunityStage(stage: OpportunityStage, semesters?: number[], period?: number): boolean {
  const studentStage = stageForPeriod(period)
  return period === undefined || !studentStage ||
    ((stage === 'all' || stage === studentStage) && (!semesters || semesters.includes(period)))
}

export function matchesOpportunityScope(item: Opportunity, scope: OpportunityScope): boolean {
  return matchesAcademicScope(item, scope) &&
    (!scope.career || item.career.includes(scope.career)) &&
    matchesOpportunityStage(item.stage, item.semester, scope.semester)
}
