export type Career = 'business-administration' | 'communication-entertainment' | 'tourism' | 'international-business' | 'accounting' | 'law' | 'finance' | 'marketing' | 'executive-administration' | 'executive-accounting' | 'executive-business' | 'digital-transformation' | 'senior-management' | 'financial-management' | 'tax-specialty' | 'banking'

export interface StudentProfile {
  id: string
  name: string
  campus: string
  career: Career
  currentSemester: number
  completedCourses: string[]
  preferences: string[]
  updatedAt: string
  onboardingCompletedAt?: string
  interests: string[]
  goals: string
  gpa?: number
  availability?: string
}

export type CreateStudentProfile = Omit<StudentProfile, 'id' | 'updatedAt' | 'onboardingCompletedAt'>
