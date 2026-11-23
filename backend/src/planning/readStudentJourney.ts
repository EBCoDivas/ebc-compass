import type { DocumentStore } from '../assistant/conversations/store.js'
import type { BannerReader } from '../banner/reader.js'
import { studentPlanning, type PlanningStudent } from '../data/studentPlanning.js'
import { readConfirmedStudentActions } from './confirmedActions.js'
import { buildStudentJourney } from './studentJourney.js'

export type StudentContext = PlanningStudent & { subject: string }

export async function readStudentJourney(student: StudentContext, banner: BannerReader, store: Pick<DocumentStore, 'get'>, today?: string) {
  const [record, actions] = await Promise.all([
    banner.readRecord({ ...student, id: student.subject }),
    readConfirmedStudentActions(store, student.subject),
  ])
  return buildStudentJourney(studentPlanning(student, record), student.subject, actions, today)
}
