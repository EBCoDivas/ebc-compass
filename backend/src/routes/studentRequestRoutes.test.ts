import '../testing/seedCatalog.js'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import express from 'express'
import type { AuthRequest } from '../auth/identity.js'
import { createFixedBannerClient } from '../banner/reader.js'
import { createStudentRequestRoutes } from './studentRequestRoutes.js'

test('my requests need a verified identity and return only that student\'s requests from Banner', async t => {
  let claims: Record<string, unknown> | undefined
  const app = express()
  app.use((request, _response, next) => { if (claims) (request as AuthRequest).verifiedClaims = claims; next() })
  app.use('/student-requests', createStudentRequestRoutes(createFixedBannerClient()))
  const server = app.listen(0, '127.0.0.1')
  t.after(() => { server.closeAllConnections(); server.close() })
  await once(server, 'listening')
  const url = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/student-requests'

  assert.equal((await fetch(url)).status, 401)

  claims = { sub: '11111111-1111-4111-8111-111111111111', 'custom:personaId': 'ana', 'custom:matricula': 'M0100012', 'custom:career': 'accounting', 'custom:campusCode': 'QRO', 'custom:semestre': '7' }
  const response = await fetch(url)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const { requests } = await response.json() as { requests: { kind: string; status: string; outcome?: string; folio: string }[] }
  assert.deepEqual(requests.map(request => [request.kind, request.status, request.outcome]), [['scholarship', 'resolved', 'Aprobada'], ['enrollment-payment', 'resolved', 'Pagada']])
  assert.equal(requests[0].folio, 'BEC-23-0418')

  claims = { sub: '22222222-2222-4222-8222-222222222222', 'custom:personaId': 'diego', 'custom:matricula': 'M0100011', 'custom:career': 'marketing', 'custom:campusCode': 'GDL', 'custom:semestre': '5' }
  assert.deepEqual(await (await fetch(url)).json(), { requests: [] })
})
