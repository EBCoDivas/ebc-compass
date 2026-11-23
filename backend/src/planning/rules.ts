import { createHash } from 'node:crypto'
import type {
  EnrollmentPaymentQuote, Opportunity, ScholarshipEligibility, SocialServiceProjection, StudentPlanning,
} from '../../../shared/contracts/studentPlanning.js'

const calendar = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' })

export function planningDate(now = new Date()): string {
  return calendar.format(now)
}

export function evaluateScholarship(
  opportunity: Opportunity | undefined, firstEntry: StudentPlanning['firstEntry'], today: string,
): ScholarshipEligibility | undefined {
  const criteria = opportunity?.scholarshipCriteria
  if (!criteria || !opportunity.deadline) return undefined

  const missingDocuments: ScholarshipEligibility['missingDocuments'] = []
  if (firstEntry && !firstEntry.admissionLetter) missingDocuments.push('admission-letter')
  if (firstEntry && !firstEntry.motivationLetter) missingDocuments.push('motivation-letter')

  let status: ScholarshipEligibility['status']
  if (today > opportunity.deadline) status = 'closed'
  else if (!firstEntry) status = 'missing-data'
  else status = firstEntry.highSchoolGpa >= criteria.minimumHighSchoolGpa ? 'eligible' : 'not-eligible'

  return { status, missingDocuments, canSubmit: status === 'eligible' && missingDocuments.length === 0 }
}

export function quoteEnrollmentPayment(
  subject: string, opportunity: Opportunity | undefined, today: string,
): EnrollmentPaymentQuote | undefined {
  if (!opportunity?.enrollmentFee || !opportunity.deadline) return undefined

  const reference = createHash('sha256')
    .update(JSON.stringify([subject, opportunity.id, opportunity.deadline]))
    .digest('hex').slice(0, 16).toUpperCase()
  return {
    ...opportunity.enrollmentFee,
    reference: 'EBC-' + reference,
    dueDate: opportunity.deadline,
    canPay: today <= opportunity.deadline,
  }
}

export function projectSocialService(
  service: NonNullable<StudentPlanning['socialService']>, today: string,
): SocialServiceProjection {
  const from = today > service.asOf ? today : service.asOf
  const days = Math.max(0, (Date.parse(service.graduationDeadline) - Date.parse(from)) / 86_400_000)
  const projectedHours = service.completedHours + Math.floor(service.weeklyHours * days / 7)
  const shortfallHours = Math.max(0, service.requiredHours - projectedHours)
  return { projectedHours, shortfallHours, onTrack: shortfallHours === 0 }
}
