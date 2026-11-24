export type ProactiveNoticeKind = 'scholarship' | 'social-service' | 'deadline' | 'opportunity'

export interface ProactiveNotice {
  id: string
  kind: ProactiveNoticeKind
  title: string
  message: string
  priority: 'high' | 'medium' | 'low'
  reason: string
  opportunityId?: string
  createdAt: string
  context: { topic: 'scholarship' | 'social-service'; opportunityId?: string }
}
