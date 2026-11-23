import type { AcademicProgress } from '../../../shared/contracts/academicProgress.js'
import { campuses, programs } from './academic.js'

type Snapshot = { career: string; campus: string; currentPeriod: AcademicProgress['currentPeriod'];
  courses: NonNullable<AcademicProgress['courses']>; credits: NonNullable<AcademicProgress['credits']>; gpa?: AcademicProgress['gpa'] }

/** Expedientes ficticios escritos explícitamente: no representan planes oficiales ni se infieren del semestre. */
export const demoAcademicSnapshots: Record<string, Snapshot | null> = {
  diego: { career: 'marketing', campus: 'GDL', currentPeriod: { number: 5, type: 'semestre' }, courses: { completed: 24, total: 54 }, credits: { earned: 144, total: 324 }, gpa: { value: 8.7, scale: 10 } },
  ana: { career: 'accounting', campus: 'QRO', currentPeriod: { number: 7, type: 'semestre' }, courses: { completed: 36, total: 54 }, credits: { earned: 216, total: 324 }, gpa: { value: 9.4, scale: 10 } },
  'ana-ingreso': { career: 'accounting', campus: 'QRO', currentPeriod: { number: 1, type: 'semestre' }, courses: { completed: 0, total: 54 }, credits: { earned: 0, total: 324 } },
  sofia: { career: 'law', campus: 'TLC', currentPeriod: { number: 9, type: 'semestre' }, courses: { completed: 48, total: 54 }, credits: { earned: 288, total: 324 }, gpa: { value: 9.2, scale: 10 } },
  'sin-perfil': null,
}
export interface AcademicStudent { id: string; personaId?: string; career?: string; campus?: string }
export interface AcademicProgressReader { read(student: AcademicStudent): Promise<AcademicProgress | null> }
export const demoAcademicProgress: AcademicProgressReader = {
  async read(student) {
    const snapshot = student.personaId ? demoAcademicSnapshots[student.personaId] : null
    if (!snapshot || snapshot.career !== student.career || snapshot.campus !== student.campus) return null
    const program = programs.find(item => item.value === snapshot.career)!
    const campus = campuses.find(item => item.value === snapshot.campus)!
    return { studentId: student.id, source: 'demo', asOf: '2026-11-16',
      program: { id: program.value, name: program.label }, campus: { id: campus.value, name: campus.label },
      currentPeriod: { ...snapshot.currentPeriod }, courses: { ...snapshot.courses }, credits: { ...snapshot.credits },
      ...(snapshot.gpa ? { gpa: { ...snapshot.gpa } } : {}),
    }
  },
}
