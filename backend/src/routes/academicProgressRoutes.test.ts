import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import express from 'express'
import type { AuthRequest } from '../auth/identity.js'
import { demoAcademicProgress, demoAcademicSnapshots } from '../data/studentAcademicProgress.js'
import { createAcademicProgressRoutes } from './academicProgressRoutes.js'

test('academic progress requires verified identity and returns only the matching demo snapshot', async t => {
  let claims: Record<string, unknown> | undefined
  const app = express()
  app.use((request, _response, next) => {
    if (claims) (request as AuthRequest).verifiedClaims = claims
    next()
  })
  app.use('/academic-progress', createAcademicProgressRoutes())
  const server = app.listen(0, '127.0.0.1')
  t.after(() => { server.closeAllConnections(); server.close() })
  await once(server, 'listening')
  const url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/academic-progress'

  assert.equal((await fetch(url)).status, 401)
  claims = { sub: 'diego-sub', 'custom:personaId': 'diego', 'custom:career': 'marketing', 'custom:campusCode': 'GDL' }
  const response = await fetch(url)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const { progress } = await response.json() as { progress: { completedCourses?: { code: string; name: string; period: number }[] } & Record<string, unknown> }
  const { completedCourses, ...rest } = progress
  assert.deepEqual(rest, {
    studentId: 'diego-sub', source: 'demo', asOf: '2026-11-16', student: { enrollment: 'M0100011', fullName: 'Diego Ramírez' },
    program: { id: 'marketing', name: 'Mercadotecnia' }, campus: { id: 'GDL', name: 'Guadalajara' },
    currentPeriod: { number: 5, type: 'semestre' }, courses: { completed: 24, total: 54 }, credits: { earned: 144, total: 324 },
    gpa: { value: 8.7, scale: 10 },
  })
  // Las materias completadas vienen de Banner y coinciden con el conteo del expediente.
  assert.equal(completedCourses?.length, 24)
  assert.deepEqual(completedCourses?.[0], { code: 'MER-101', name: 'Fundamentos de mercadotecnia', period: 1 })
  assert.equal(new Set(completedCourses?.map(course => course.code)).size, 24)
  assert.equal(Math.max(...(completedCourses ?? []).map(course => course.period)), 4)

  claims = { sub: 'diego-sub', 'custom:personaId': 'diego', 'custom:career': 'law', 'custom:campusCode': 'TLC' }
  assert.deepEqual(await (await fetch(url)).json(), { progress: null })
  claims = { sub: 'new-student', 'custom:personaId': 'sin-perfil' }
  assert.deepEqual(await (await fetch(url)).json(), { progress: null })
})

test('demo snapshots expose explicit data only and keep optional values absent', async () => {
  const firstYear = await demoAcademicProgress.read({ id: 'ana-ingreso-sub', personaId: 'ana-ingreso', career: 'accounting', campus: 'QRO' })
  assert.equal(firstYear?.courses?.completed, 0)
  assert.equal(firstYear?.gpa, undefined)
  for (const [personaId, snapshot] of Object.entries(demoAcademicSnapshots)) {
    if (!snapshot) continue
    const progress = await demoAcademicProgress.read({ id: personaId + '-sub', personaId, career: snapshot.career, campus: snapshot.campus })
    assert.ok(progress, `${personaId} should have a matching snapshot`)
    assert.equal(progress.currentPeriod.number, snapshot.currentPeriod.number)
    assert.deepEqual(progress.courses, snapshot.courses)
    assert.deepEqual(progress.credits, snapshot.credits)
  }
  assert.equal(await demoAcademicProgress.read({ id: 'new-student', personaId: 'sin-perfil' }), null)
})
