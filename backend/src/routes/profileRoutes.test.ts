import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import express from 'express'
import { createProfileRoutes } from './profileRoutes.js'
import type { ProfileRepository } from '../profiles/repository.js'
import type { AuthRequest } from '../auth/identity.js'
import type { StudentProfile } from '../types/studentProfile.js'

test('profiles use verified identity, preserve preferences and update one record per account', async t => {
  const profiles = new Map<string, StudentProfile>()
  let subject: string | undefined
  const repository: ProfileRepository = { get: async id => profiles.get(id), save: async profile => { profiles.set(profile.id, profile) } }
  const app = express()
  app.use(express.json(), (req, _res, next) => {
    if (subject) (req as AuthRequest).verifiedClaims = { sub: subject, 'custom:career': 'finance', 'custom:campusCode': 'CDMX', 'custom:semestre': '2' }
    next()
  })
  app.use('/profiles', createProfileRoutes(repository))
  const server = app.listen(0, '127.0.0.1')
  t.after(() => { server.closeAllConnections(); server.close() })
  await once(server, 'listening')
  const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/profiles'
  const save = (body: unknown) => fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal((await fetch(base)).status, 401)
  assert.equal((await save({})).status, 401)
  assert.equal(profiles.size, 0)
  subject = 'alice'
  const profile = { id: 'bob', name: 'Alias', campus: 'GDL', career: 'law', currentSemester: 8,
    interests: ['Finanzas'], preferences: ['Becas'], completedCourses: ['FIN-301'], goals: 'Banca digital' }
  assert.equal((await save(profile)).status, 201)
  const own = await (await fetch(base + '?studentId=bob')).json() as StudentProfile[]
  assert.equal(own.length, 1)
  assert.equal(own[0].id, 'alice')
  assert.equal(own[0].career, 'finance')
  assert.equal(own[0].campus, 'CDMX')
  assert.equal(own[0].currentSemester, 2)
  assert.deepEqual(own[0].preferences, ['Becas'])
  assert.equal(own[0].goals, 'Banca digital')
  assert.ok(own[0].updatedAt)
  await save({ ...profile, name: 'Nuevo alias' })
  assert.equal(profiles.size, 1)
  assert.equal(profiles.get('alice')?.onboardingCompletedAt, undefined)
  // Solo la confirmación explícita del formulario termina el onboarding.
  const completed = await (await save({ ...profile, completeOnboarding: true, onboardingCompletedAt: 'forged' })).json() as StudentProfile
  assert.ok(completed.onboardingCompletedAt)
  assert.notEqual(completed.onboardingCompletedAt, 'forged')
  await save({ ...profile, completeOnboarding: false, onboardingCompletedAt: 'changed' })
  assert.equal(profiles.get('alice')?.onboardingCompletedAt, completed.onboardingCompletedAt)
  subject = 'bob'
  assert.deepEqual(await (await fetch(base + '?studentId=alice')).json(), [])
  assert.equal((await save({ ...profile, interests: [3] })).status, 400)
  assert.equal(profiles.size, 1)
})

test('profile database failures return 503 rather than confirming a save', async t => {
  const app = express()
  app.use(express.json(), (req, _res, next) => { (req as AuthRequest).verifiedClaims = { sub: 'alice' }; next() })
  app.use('/profiles', createProfileRoutes({ get: async () => { throw new Error('database') }, save: async () => { throw new Error('database') } }))
  const server = app.listen(0, '127.0.0.1')
  t.after(() => { server.closeAllConnections(); server.close() })
  await once(server, 'listening')
  const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/profiles'
  assert.equal((await fetch(base)).status, 503)
  const response = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Demo', campus: 'CDMX', career: 'finance', currentSemester: 2 }) })
  assert.equal(response.status, 503)
})
