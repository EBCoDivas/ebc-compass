import type { AcademicProgress } from '../../../shared/contracts/academicProgress.js'
import type { StudentPlanning } from '../../../shared/contracts/studentPlanning.js'

export interface BannerRecord {
  enrollment: string
  personaId: string
  career: string
  campus: string
  asOf: string
  currentPeriod: AcademicProgress['currentPeriod']
  courses?: AcademicProgress['courses']
  credits?: AcademicProgress['credits']
  gpa?: AcademicProgress['gpa']
  firstEntry?: StudentPlanning['firstEntry']
  serviceHours?: Pick<NonNullable<StudentPlanning['socialService']>, 'completedHours' | 'weeklyHours' | 'asOf'>
}

const asOf = '2026-11-16'
const records: BannerRecord[] = [
  { enrollment: 'M0100011', personaId: 'diego', career: 'marketing', campus: 'GDL', asOf,
    currentPeriod: { number: 5, type: 'semestre' }, courses: { completed: 24, total: 54 }, credits: { earned: 144, total: 324 }, gpa: { value: 8.7, scale: 10 } },
  { enrollment: 'M0100012', personaId: 'ana', career: 'accounting', campus: 'QRO', asOf,
    currentPeriod: { number: 7, type: 'semestre' }, courses: { completed: 36, total: 54 }, credits: { earned: 216, total: 324 }, gpa: { value: 9.4, scale: 10 },
    serviceHours: { completedHours: 260, weeklyHours: 6, asOf: '2026-11-22' } },
  { enrollment: 'M0100018', personaId: 'ana-ingreso', career: 'accounting', campus: 'QRO', asOf,
    currentPeriod: { number: 1, type: 'semestre' }, courses: { completed: 0, total: 54 }, credits: { earned: 0, total: 324 },
    firstEntry: { highSchoolGpa: 9.2, admissionLetter: true, motivationLetter: false } },
  { enrollment: 'M0100014', personaId: 'sofia', career: 'law', campus: 'TLC', asOf,
    currentPeriod: { number: 9, type: 'semestre' }, courses: { completed: 48, total: 54 }, credits: { earned: 288, total: 324 }, gpa: { value: 9.2, scale: 10 },
    serviceHours: { completedHours: 468, weeklyHours: 12, asOf: '2026-11-22' } },
]

export const demoAcademicSnapshots = Object.fromEntries([...records.map(record => [record.personaId, record] as const), ['sin-perfil', null]]) as Record<string, BannerRecord | null>

export function fixtureByEnrollment(enrollment: string): BannerRecord | null {
  return records.find(record => record.enrollment === enrollment) ?? null
}
