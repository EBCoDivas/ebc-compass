// Cognito real del emulador: usa el registro privado sin imprimir credenciales ni tokens.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { createAuthenticatedLocalApp } from '../src/auth/localAuth.js'
process.env.ASSISTANT_MODE = 'rules'
const { app } = await import('../src/app.js')
const state = JSON.parse(readFileSync(new URL('../../local/.state/cognito.json', import.meta.url), 'utf8'))
const server = (await createAuthenticatedLocalApp(app, state)).listen(0, '127.0.0.1')
await once(server, 'listening')
const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
const call = (path: string, token?: string, body?: unknown, method = body ? 'POST' : 'GET') =>
  fetch(base + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })
try {
  assert.equal((await call('/opportunities')).status, 401)
  assert.equal((await call('/dev/session', undefined, { username: state.users['ana-ingreso'].username, password: 'incorrect' })).status, 401)
  const tokens: Record<string, string> = {}
  for (const [id, account] of Object.entries(state.users) as [string, { username: string; password: string }][]) {
    const response = await call('/dev/session', undefined, account)
    assert.equal(response.status, 200, id + ' login')
    tokens[id] = (await response.json() as { idToken: string }).idToken
    assert.equal((await call('/opportunities', tokens[id])).status, 200)
    const profilesResponse = await call('/profiles', tokens[id])
    assert.equal(profilesResponse.status, 200)
    const profiles = await profilesResponse.json() as { id: string }[]
    assert.ok(profiles.every(profile => profile.id === state.users[id].sub))
    console.log('✔ ' + id + ': login, acceso firmado y perfil aislado')
  }
  const ana = tokens['ana-ingreso']
  const diego = tokens.diego
  const posted = await call('/assistant/messages', ana, { message: 'Hola', studentId: state.users.diego.sub, profile: { name: 'Impostor', career: 'law' } })
  assert.equal(posted.status, 200)
  const reply = await posted.json() as { conversationId: string; message: { content: string } }
  assert.ok(reply.message.content.includes('Ana'))
  const path = '/assistant/conversations/' + reply.conversationId
  assert.equal((await call(path, ana)).status, 200)
  assert.equal((await call(path + '?studentId=' + state.users['ana-ingreso'].sub, diego)).status, 404)
  assert.equal((await call(path, diego, undefined, 'DELETE')).status, 404)
  assert.equal((await call(path, ana)).status, 200)
  assert.equal((await call(path, ana, undefined, 'DELETE')).status, 204)
  const parts = ana.split('.')
  parts[1] = Buffer.from(JSON.stringify({ sub: state.users.diego.sub })).toString('base64url')
  assert.equal((await call('/opportunities', parts.join('.'))).status, 401)
  console.log('✔ Sin token, contraseña incorrecta, suplantación y acceso/borrado ajenos rechazados.')
} finally { server.closeAllConnections(); server.close() }
