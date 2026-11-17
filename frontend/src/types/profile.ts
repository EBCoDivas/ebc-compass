import academic from '../../../shared/academic.json'

export type Campus = 'AGS' | 'CNC' | 'CHI' | 'CDMX' | 'CMS' | 'GDL' | 'HMO' | 'LEO' | 'MID' | 'PCH' | 'QRO' | 'SLP' | 'TLA' | 'TLC'
export type Career = 'business-administration' | 'communication-entertainment' | 'tourism' | 'international-business' | 'accounting' | 'law' | 'finance' | 'marketing' | 'executive-administration' | 'executive-accounting' | 'executive-business' | 'digital-transformation' | 'senior-management' | 'financial-management' | 'tax-specialty' | 'banking'

export interface StudentProfile {
  id: string
  name: string
  campus: Campus | ''
  career: Career | ''
  currentSemester: number | 'na' | ''
  interests: string[]
  preferences: string[]
  updatedAt: string
  onboardingCompletedAt?: string
  completedCourses: string[]
  goals: string
  gpa?: number
  availability?: string
}

export const emptyProfile: StudentProfile = {
  id: '',
  name: '',
  campus: '',
  career: '',
  currentSemester: '',
  interests: [],
  preferences: [],
  updatedAt: '',
  completedCourses: [],
  goals: '',
}

export const campusOptions: { value: Campus; label: string }[] = academic.campuses as { value: Campus; label: string }[]
export const careerOptions: { value: Career; label: string }[] = [
  ...academic.programs as { value: Career; label: string }[],
  { value: 'banking', label: 'Banca (identificador anterior)' },
]
