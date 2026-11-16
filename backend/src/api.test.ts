import test from 'node:test'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { app } from './app.js'

test('backend exposes the documented local API flow', async (t) => {
  const server = app.listen(0)
  t.after(() => server.close())
  await new Promise<void>((resolve) => server.once('listening', () => resolve()))
  const address = server.address()
  assert.equal(typeof address, 'object')
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`

  const health = await fetch(`${baseUrl}/api/health`)
  assert.equal(health.status, 200)

  const catalog = await fetch(`${baseUrl}/api/opportunities?type=scholarship`)
  const scholarships = await catalog.json() as Array<{ type: string }>
  assert.equal(catalog.status, 200)
  assert.equal(scholarships.every((item) => item.type === 'scholarship'), true)

  const recommendations = await fetch(`${baseUrl}/api/recommendations?career=finance&semester=5&interests=finanzas`)
  const recommended = await recommendations.json() as Array<{ relevanceScore: number }>
  assert.equal(recommendations.status, 200)
  assert.equal(recommended.length > 0, true)
  assert.equal(recommended[0].relevanceScore > 0, true)

  const alerts = await fetch(`${baseUrl}/api/alerts`)
  const upcomingAlerts = await alerts.json() as Array<{ daysRemaining: number }>
  assert.equal(alerts.status, 200)
  assert.equal(upcomingAlerts.length <= 5, true)
  assert.equal(upcomingAlerts.every((item, index) => index === 0 || item.daysRemaining >= upcomingAlerts[index - 1].daysRemaining), true)

  const profile = await fetch(`${baseUrl}/api/profiles`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Valerie', campus: 'CMS', career: 'finance', currentSemester: 5 }) })
  assert.equal(profile.status, 201)
})
