import type { Opportunity, StudentJourney } from '../../../shared/contracts/studentPlanning.js'
import type { ProactiveNotice, ProactiveNoticeKind } from '../../../shared/contracts/proactive.js'

export type { ProactiveNotice }

export interface ProactiveCandidate {
  id: string
  kind: ProactiveNoticeKind
  title: string
  message: string
  priority: ProactiveNotice['priority']
  reason: string
  opportunityId?: string
  context: ProactiveNotice['context']
}

export interface ProactiveContext {
  journey: StudentJourney
  memory: { key: string; value: string; origin: string }[]
  catalog: Opportunity[]
  today: string
}

export interface StoredProactiveNotices { fingerprint: string; notices: ProactiveNotice[]; version: number }
