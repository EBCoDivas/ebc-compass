import type { Request } from 'express'
import { DynamoProfileRepository } from '../profiles/repository.js'
import type { PlanningStudent } from '../data/studentPlanning.js'
import { planningOpportunities } from '../data/studentPlanning.js'
import { opportunities } from '../data/opportunities.js'
import { matchesOpportunityScope } from '../data/opportunityScope.js'
import { verifiedAcademicProfile } from './academicProfile.js'
import { identityClaims, identitySubject } from './identity.js'

const profiles = new DynamoProfileRepository()

export async function resolvePlanningStudent(request: Request): Promise<(PlanningStudent & { subject: string }) | undefined> {
  const subject = identitySubject(request)
  if (!subject) return undefined
  const claims = identityClaims(request)
  const verified = verifiedAcademicProfile(request)
  const saved = verified.career && verified.campus && verified.currentSemester ? undefined : await profiles.get(subject)
  const personaId = claims?.['custom:personaId']
  return {
    subject,
    enrollment: typeof claims?.['custom:matricula'] === 'string' ? claims['custom:matricula'] : undefined,
    career: verified.career ?? saved?.career,
    campus: verified.campus ?? saved?.campus,
    semester: verified.currentSemester ?? saved?.currentSemester,
    personaId: typeof personaId === 'string' ? personaId : undefined,
  }
}

export async function resolveOpportunityCatalog(request: Request) {
  const student = await resolvePlanningStudent(request)
  if (student) return { scope: student, catalog: planningOpportunities(student) }
  const text = (key: string) => typeof request.query[key] === 'string' ? request.query[key] as string : undefined
  const scope = { career: text('career'), campus: text('campus'), level: text('level'), semester: Number(text('semester')) }
  return { scope, catalog: opportunities.filter(item => matchesOpportunityScope(item, scope)) }
}
