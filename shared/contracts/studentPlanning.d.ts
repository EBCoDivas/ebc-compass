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
  schedule?: { days: string[]; start: string; end: string }
}

export interface StudentPending {
  opportunityId: string
  status: 'pending' | 'in-progress' | 'completed'
  dueDate: string
}

export interface StudentPlanning {
  stage: StudentStage | null
  catalog: Opportunity[]
  pending: StudentPending[]
  firstEntry?: { highSchoolGpa: number; admissionLetter: boolean; motivationLetter: boolean }
  socialService?: {
    completedHours: number
    requiredHours: number
    weeklyHours: number
    asOf: string
    graduationDeadline: string
  }
}
