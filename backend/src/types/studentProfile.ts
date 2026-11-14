export type Career =
  | 'banking'
  | 'finance'
  | 'marketing'
  | 'business-administration'

export interface StudentProfile {
  id: string
  name: string
  campus: string
  career: Career
  currentSemester: number
  completedCourses: string[]
  interests: string[]
  goals: string
}

export type CreateStudentProfile = Omit<StudentProfile, 'id'>
