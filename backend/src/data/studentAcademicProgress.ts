import type { AcademicProgress } from '../../../shared/contracts/academicProgress.js'
import { fixedBanner, type AcademicStudent, type BannerReader } from '../banner/reader.js'
import { campuses, programs } from './academic.js'
export { demoAcademicSnapshots } from '../banner/fixtures.js'
export type { AcademicStudent } from '../banner/reader.js'

export interface AcademicProgressReader { read(student: AcademicStudent): Promise<AcademicProgress | null> }

export function academicProgressReader(banner: BannerReader): AcademicProgressReader {
  return {
    async read(student) {
      const snapshot = await banner.readRecord(student)
      if (!snapshot) return null
      const program = programs.find(item => item.value === snapshot.career)
      const campus = campuses.find(item => item.value === snapshot.campus)
      if (!program || !campus) return null
      return { studentId: student.id, source: 'demo', asOf: snapshot.asOf,
        student: { enrollment: snapshot.enrollment, fullName: snapshot.fullName },
        program: { id: program.value, name: program.label }, campus: { id: campus.value, name: campus.label },
        currentPeriod: { ...snapshot.currentPeriod },
        ...(snapshot.courses ? { courses: { ...snapshot.courses } } : {}),
        ...(snapshot.completedCourses?.length ? { completedCourses: snapshot.completedCourses.map(course => ({ ...course })) } : {}),
        ...(snapshot.credits ? { credits: { ...snapshot.credits } } : {}),
        ...(snapshot.gpa ? { gpa: { ...snapshot.gpa } } : {}),
      }
    },
  }
}

export const demoAcademicProgress = academicProgressReader(fixedBanner)
