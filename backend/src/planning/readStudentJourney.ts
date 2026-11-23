import type { DocumentStore } from '../assistant/conversations/store.js'
import type { BannerReader } from '../banner/reader.js'
import { studentPlanning, type PlanningStudent } from '../data/studentPlanning.js'
import { readConfirmedStudentActions } from './confirmedActions.js'
import { buildStudentJourney } from './studentJourney.js'

export type StudentContext = PlanningStudent & { subject: string }

export async function readStudentJourney(student: StudentContext, banner: BannerReader, store: Pick<DocumentStore, 'get'>, today?: string) {
  const academicStudent = { ...student, id: student.subject }
  const [record, actions, bannerActions] = await Promise.all([
    banner.readRecord(academicStudent),
    readConfirmedStudentActions(store, student.subject),
    banner.readActions?.(academicStudent),
  ])
  return buildStudentJourney(studentPlanning(student, record), student.subject, {
    ...actions,
    scholarshipInReview: actions.scholarshipInReview || bannerActions?.scholarship?.status === 'in-review',
    enrollmentPaid: bannerActions?.payment?.status === 'paid',
  }, today)
}
