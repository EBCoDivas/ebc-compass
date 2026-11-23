export type StudentStage = 'entry' | 'middle' | 'closing'
export type OpportunityStage = StudentStage | 'all'
export type OpportunityType = 'course' | 'scholarship' | 'professional-development' | 'event' | 'procedure' | 'career-opportunity'

export interface Opportunity {
  id: string
  type: OpportunityType
  title: string
  description: string
  stage: OpportunityStage
  career: string[]
  campus: string[]
  level: ('licenciatura' | 'ejecutiva' | 'posgrado')[]
  simulated: true
  semester?: number[]
  deadline?: string
  location?: string
  requirements?: string[]
  scholarshipCriteria?: { minimumHighSchoolGpa: number }
  enrollmentFee?: { amount: number; currency: 'MXN' }
  serviceHoursRequired?: number
  schedule?: { days: string[]; start: string; end: string }
}

export interface StudentPending {
  opportunityId: string
  status: 'pending' | 'in-progress' | 'in-review' | 'completed'
  dueDate: string
}

export interface StudentPlanning {
  stage: StudentStage | null
  catalog: Opportunity[]
  pending: StudentPending[]
  firstEntry?: { highSchoolGpa: number; admissionLetter: boolean; motivationLetter: boolean }
  /** Logros desbloqueados en etapas anteriores; siguen visibles cuando el alumno avanza de etapa. */
  achievementHistory?: { id: StudentAchievement['id']; earnedAt: string }[]
  socialService?: {
    completedHours: number
    requiredHours: number
    weeklyHours: number
    asOf: string
    graduationDeadline: string
  }
}

export interface StudentRouteItem extends StudentPending {
  required: boolean
  overdue: boolean
  nextStep: string
}

export interface StudentAchievement {
  id: 'scholarship-requested' | 'payment-slip-generated' | 'social-service-progress'
  earned: boolean
  /** Solo en logros de una etapa anterior: fecha en que se desbloqueó (historial). */
  earnedAt?: string
}

export interface ScholarshipEligibility {
  status: 'eligible' | 'not-eligible' | 'missing-data' | 'closed'
  missingDocuments: ('admission-letter' | 'motivation-letter')[]
  canSubmit: boolean
}

export interface EnrollmentPaymentDetails {
  amount: number
  currency: 'MXN'
  reference: string
  dueDate: string
}

export interface EnrollmentPaymentQuote extends EnrollmentPaymentDetails {
  canGenerate: boolean
  scholarshipInReview: boolean
}

export interface SocialServiceProjection {
  projectedHours: number
  shortfallHours: number
  onTrack: boolean
}

export interface StudentJourney extends StudentPlanning {
  route: StudentRouteItem[]
  achievements: StudentAchievement[]
  calculations: {
    scholarship?: ScholarshipEligibility
    enrollmentPayment?: EnrollmentPaymentQuote
    socialService?: SocialServiceProjection
  }
}
