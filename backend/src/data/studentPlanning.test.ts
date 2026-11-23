import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import type { Request } from 'express'
import type { StudentJourney } from '../../../shared/contracts/studentPlanning.js'
import { verifiedAcademicProfile } from '../auth/academicProfile.js'
import { forgetMemory, memoryContext, seedMemories } from '../assistant/conversations/memory.js'
import { ConversationRepository } from '../assistant/conversations/repository.js'
import { MemoryDocumentStore } from '../assistant/conversations/store.js'
import { levelForCareer } from './academic.js'
import { studentPlanning } from './studentPlanning.js'
process.env.ASSISTANT_STORE = 'memory'
const { handler } = await import('../lambda.js')

const personas = JSON.parse(readFileSync(new URL('../../../shared/personas.json', import.meta.url), 'utf8')) as {
  id: string; name: string; studentId: string; enrollment: string; campus: string; career: string; period: number; hasProfile: boolean
}[]
type Persona = (typeof personas)[number]
type Item = { id: string }

async function get(path: string, persona?: Persona) {
  const result = await handler({
    httpMethod: 'GET', path, headers: {},
    queryStringParameters: { personaId: 'ana', studentId: 'ana', career: 'law', campus: 'TLC', semester: '9', scholarshipInReview: 'true', enrollmentPaymentGenerated: 'true' },
    requestContext: { authorizer: persona ? { claims: {
      sub: persona.studentId, 'custom:personaId': persona.id, 'custom:career': persona.career,
      'custom:campusCode': persona.campus, 'custom:semestre': String(persona.period),
    } } : undefined },
    isBase64Encoded: false,
  }, {} as never) as { statusCode: number; headers: Record<string, string>; body: string }
  return { status: result.statusCode, headers: result.headers, body: JSON.parse(result.body) }
}

test('planning, calendar, alerts and recommendations agree for every demo account with academic claims', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-22T12:00:00-06:00') })
  assert.equal((await get('/api/student-planning')).status, 401)
  const stages = { 1: 'entry', 2: 'entry', 3: 'middle', 4: 'middle', 5: 'middle', 6: 'middle', 7: 'closing', 9: 'closing' } as Record<number, string>
  const scenes: Record<string, string[]> = {
    'ana-ingreso': ['scholarship-first-entry', 'event-induction', 'event-welcome', 'procedure-first-enrollment-payment'],
    ana: ['accounting-social-service', 'accounting-graduation', 'accounting-service-community', 'course-accounting'],
    diego: ['marketing-event', 'marketing-internship', 'course-marketing'],
    sofia: ['law-social-service', 'law-graduation', 'course-law'],
  }

  for (const persona of personas.filter(item => item.hasProfile)) {
    const [planning, calendar, alerts, recommendations] = await Promise.all(
      ['/api/student-planning', '/api/opportunities', '/api/alerts', '/api/recommendations'].map(path => get(path, persona)),
    )
    for (const response of [planning, calendar, alerts, recommendations]) assert.equal(response.status, 200, persona.id)
    assert.equal(planning.headers['cache-control'], 'no-store')
    const { stage, catalog, pending, route, achievements } = planning.body as StudentJourney
    assert.equal(stage, stages[persona.period], persona.id)
    assert.ok(pending.length > 0, persona.id)
    assert.ok(route.length > 0 && route.every(item => pending.some(row => row.opportunityId === item.opportunityId)), persona.id)
    // Sin acciones confirmadas solo hay logros por horas registradas o del historial de etapas anteriores.
    assert.ok(achievements.every(item => !item.earned || item.id === 'social-service-progress' || item.earnedAt), persona.id)
    assert.deepEqual(calendar.body, catalog, persona.id)

    const byId = new Map(catalog.map(item => [item.id, item]))
    for (const item of catalog) {
      assert.ok(item.stage === 'all' || item.stage === stage, item.id)
      assert.ok(!item.semester || item.semester.includes(persona.period), item.id)
      assert.ok(item.career.includes(persona.career), item.id)
      assert.ok(item.campus.includes(persona.campus), item.id)
      assert.ok(item.level.includes(levelForCareer(persona.career)!), item.id)
      if (!scenes[persona.id]) assert.ok(item.career.includes('law') && item.career.includes('accounting'), item.id)
    }
    for (const item of pending) {
      assert.equal(byId.get(item.opportunityId)?.deadline, item.dueDate, item.opportunityId)
      assert.match(item.dueDate, /^\d{4}-\d{2}-\d{2}$/)
    }
    assert.ok(alerts.body.length > 0 && alerts.body.length <= 5, persona.id)
    for (const alert of alerts.body) assert.equal(byId.get(alert.opportunityId)?.deadline, alert.deadline, alert.opportunityId)
    assert.ok(recommendations.body.length > 0, persona.id)
    const recommended = new Set<string>(recommendations.body.map((item: { opportunity: Item }) => item.opportunity.id))
    for (const id of recommended) assert.ok(byId.has(id), persona.id)
    for (const id of scenes[persona.id] ?? []) assert.ok(recommended.has(id), persona.id + ': ' + id)
  }
})

test('the work schedule is seeded for Ana in seventh semester only and stays forgotten', async () => {
  const repo = new ConversationRepository(new MemoryDocumentStore())
  const seed = async (id: string, period: number) => {
    const request = { verifiedClaims: { sub: id, 'custom:personaId': id, 'custom:career': 'accounting',
      'custom:campusCode': 'QRO', 'custom:semestre': String(period) } } as unknown as Request
    await seedMemories(repo, id, verifiedAcademicProfile(request))
    return memoryContext(await repo.memories(id)).find(fact => fact.key === 'workSchedule')?.value
  }
  assert.equal(await seed('ana', 7), 'works-afternoons')
  assert.equal(await seed('ana-ingreso', 1), undefined)
  assert.equal(await seed('another-accounting-student', 7), undefined)
  await forgetMemory(repo, 'ana', 'workSchedule')
  assert.equal(await seed('ana', 7), undefined)
})

test('the scenes carry distinct, coherent simulated student data', () => {
  const forPersona = (id: string) => {
    const { period, campus, career } = personas.find(item => item.id === id)!
    return studentPlanning({ semester: period, campus, career, personaId: id })
  }
  const entry = forPersona('ana-ingreso')
  const closing = forPersona('ana')
  const firstAna = personas.find(item => item.id === 'ana-ingreso')!
  const laterAna = personas.find(item => item.id === 'ana')!
  assert.deepEqual([firstAna.name, firstAna.career, firstAna.campus], [laterAna.name, laterAna.career, laterAna.campus])
  assert.notEqual(firstAna.studentId, laterAna.studentId)
  assert.notEqual(firstAna.enrollment, laterAna.enrollment)
  assert.equal(entry.pending.length, 4)
  assert.ok(entry.catalog.find(item => item.id === 'scholarship-first-entry')?.scholarshipCriteria)
  assert.deepEqual(entry.catalog.find(item => item.id === 'procedure-first-enrollment-payment')?.enrollmentFee, { amount: 4800, currency: 'MXN' })
  assert.equal(entry.socialService, undefined)
  assert.equal(closing.firstEntry, undefined)
  assert.ok(closing.catalog.find(item => item.id === 'accounting-graduation')?.requirements?.length)
  const shifts = closing.catalog.flatMap(item => item.schedule ? [item.schedule.start] : [])
  assert.ok(shifts.filter(start => start >= '12:00').length >= 2 && shifts.some(start => start < '12:00'))
  assert.equal(closing.pending.find(item => item.opportunityId === 'accounting-social-service')?.status, 'in-progress')
  assert.ok(closing.socialService)
  const { completedHours, requiredHours, weeklyHours, asOf, graduationDeadline } = closing.socialService
  const weeksLeft = (Date.parse(graduationDeadline) - Date.parse(asOf)) / (7 * 86_400_000)
  assert.ok(weeksLeft > 0 && completedHours + weeklyHours * weeksLeft < requiredHours)
  assert.equal(forPersona('sofia').socialService?.graduationDeadline, '2026-11-27')

  const withoutProfile = studentPlanning({ personaId: 'sin-perfil' })
  assert.equal(withoutProfile.stage, null)
  assert.deepEqual(withoutProfile.pending.map(item => item.opportunityId), ['procedure-academic-dates'])
  assert.ok(withoutProfile.catalog.every(item => item.stage === 'all' && !item.semester))
})
