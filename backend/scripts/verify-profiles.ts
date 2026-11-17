// Prueba de DynamoDB real del emulador con identidades temporales; no toca los perfiles demo existentes.
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import assert from 'node:assert/strict'
import express from 'express'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { createProfileRoutes } from '../src/routes/profileRoutes.js'
import { DynamoProfileRepository } from '../src/profiles/repository.js'
import type { AuthRequest } from '../src/auth/identity.js'
if (process.env.AWS_ENDPOINT_URL !== 'https://127.0.0.1:9297') throw new Error('Verificación exclusiva del emulador.')
const table = process.env.PROFILES_TABLE ?? 'StudentProfiles'
const subject = randomUUID()
const other = randomUUID()
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const body = { id: other, name: 'Perfil temporal', campus: 'CDMX', career: 'finance', currentSemester: 2,
  completeOnboarding: true, preferences: ['Becas'], interests: ['Finanzas'], completedCourses: ['FIN-301'], goals: 'Meta simulada' }
async function start(identity: string) {
  const app = express()
  app.use(express.json(), (req, _res, next) => { (req as AuthRequest).verifiedClaims = { sub: identity }; next() })
  app.use('/profiles', createProfileRoutes(new DynamoProfileRepository(table)))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { server, url: 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/profiles' }
}
let instance = await start(subject)
try {
  const response = await fetch(instance.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal(response.status, 201)
  instance.server.closeAllConnections()
  await new Promise<void>(resolve => instance.server.close(() => resolve()))
  // Otro servidor y otro repositorio leen el mismo perfil sin depender de memoria previa.
  instance = await start(subject)
  const profiles = await (await fetch(instance.url)).json() as Array<typeof body & { onboardingCompletedAt?: string }>
  assert.equal(profiles.length, 1)
  assert.equal(profiles[0].id, subject)
  assert.ok(profiles[0].onboardingCompletedAt)
  assert.deepEqual(profiles[0].preferences, body.preferences)
  assert.deepEqual(profiles[0].completedCourses, body.completedCourses)
  assert.equal(profiles[0].goals, body.goals)
  const second = await start(other)
  try { assert.deepEqual(await (await fetch(second.url + '?studentId=' + subject)).json(), []) }
  finally { second.server.closeAllConnections(); second.server.close() }
  console.log('✔ Perfil recuperado desde otro servidor/repositorio; preferencias, metas y materias conservadas; otra identidad aislada.')
} finally {
  instance.server.closeAllConnections()
  instance.server.close()
  await client.send(new DeleteCommand({ TableName: table, Key: { studentId: subject } }))
}
