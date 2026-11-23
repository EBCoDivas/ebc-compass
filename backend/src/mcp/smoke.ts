import assert from 'node:assert/strict'
import { decodeJwt } from 'jose'
import type { StudentContext } from '../planning/readStudentJourney.js'
import { asObject, decodeStudentContext, encodeStudentContext, TARGET_NAME, toolList } from './contract.js'
import type { createStudentMcpClient } from './client.js'

// Solo recibe tokens devueltos por Cognito/servidor local en la misma prueba. En aplicación el contexto viene del authorizer.
export function smokeStudent(token: string, expectedPersona: string): StudentContext {
  const claims = decodeJwt(token)
  assert.equal(claims['custom:personaId'], expectedPersona)
  assert.ok(claims.sub)
  const str = (key: string) => typeof claims[key] === 'string' && claims[key] ? claims[key] as string : undefined
  const student = {
    subject: claims.sub, personaId: expectedPersona, enrollment: str('custom:matricula'), career: str('custom:career'),
    campus: str('custom:campusCode'), semester: Number(str('custom:semestre')) || undefined,
  }
  assert.ok(decodeStudentContext(encodeStudentContext(student)))
  return student
}

export async function verifyMcpStudent(client: ReturnType<typeof createStudentMcpClient>, student: StudentContext,
  apiUrl: string, token: string, options: { search: boolean }) {
  const names = await client.list()
  assert.deepEqual(names.sort(), toolList.map(tool => TARGET_NAME + '___' + tool.name).sort())
  const context = await client.call('get_student_context')
  assert.ok(context.ok)
  const progress = await client.call('get_academic_progress')
  assert.ok(progress.ok)
  const response = await fetch(apiUrl.replace(/\/+$/, '') + '/api/academic-progress', {
    headers: { authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(8000),
  })
  assert.equal(response.status, 200)
  assert.deepEqual(progress.data, await response.json())
  const snapshot = asObject(asObject(progress.data)?.progress)
  assert.equal(snapshot?.studentId, student.enrollment ? student.subject : undefined)
  const opportunities = await client.call('list_opportunities')
  assert.ok(opportunities.ok && Array.isArray(asObject(opportunities.data)?.opportunities))
  const selected = student.personaId === 'ana-ingreso' ? 'scholarship-first-entry' : 'accounting-graduation'
  assert.ok((await client.call('get_requirements', { opportunityId: selected })).ok)
  const another = student.personaId === 'ana-ingreso' ? 'accounting-graduation' : 'scholarship-first-entry'
  assert.deepEqual(await client.call('get_requirements', { opportunityId: another }), { ok: false, code: 'NOT_FOUND' })
  if (options.search) {
    const search = await client.call('search_knowledge', { query: '¿Qué es la Beca de Excelencia Académica BEA?', language: 'es' })
    assert.ok(search.ok)
    const passages = asObject(search.data)?.passages
    assert.ok(Array.isArray(passages) && passages.some(item => typeof asObject(item)?.source === 'string'))
  }
}
