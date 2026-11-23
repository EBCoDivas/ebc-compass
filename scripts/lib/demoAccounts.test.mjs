import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import test from 'node:test'
import { demoAccessConfig, demoUsername, obsoleteDemoUsers, publicDemoEnvironment } from '../../shared/demoAccounts.mjs'

test('only the explicit jury build exposes its dedicated demo password', () => {
  const password = 'Aa1!' + randomBytes(12).toString('hex')
  assert.deepEqual(publicDemoEnvironment(demoAccessConfig({ JURY_DEMO_PASSWORD: password })), {
    VITE_SHOW_JURY_ACCOUNTS: 'false', VITE_JURY_DEMO_PASSWORD: '',
  })
  assert.deepEqual(publicDemoEnvironment(demoAccessConfig({ JURY_DEMO_ENABLED: 'true', JURY_DEMO_PASSWORD: password })), {
    VITE_SHOW_JURY_ACCOUNTS: 'true', VITE_JURY_DEMO_PASSWORD: password,
  })
  assert.throws(() => demoAccessConfig({ JURY_DEMO_ENABLED: 'true' }), /JURY_DEMO_PASSWORD/)
})

test('only accounts matching both the managed persona claim and email can be pruned', () => {
  const attributes = (id, email) => [{ Name: 'custom:personaId', Value: id }, { Name: 'email', Value: email }]
  const users = [
    { Username: 'kept-username', Attributes: attributes('ana-ingreso', demoUsername('ana-ingreso')) },
    { Username: 'old-user-uuid', Attributes: attributes('old-persona', demoUsername('old-persona')) },
    { Username: 'unmanaged-with-demo-domain', Attributes: attributes('', demoUsername('temporary')) },
    { Username: 'unmanaged-with-persona-claim', Attributes: attributes('old-student', 'student@example.org') },
    { Username: 'different-demo', Attributes: attributes('old-persona', demoUsername('someone-else')) },
    { Username: 'empty-attributes' },
  ]
  assert.deepEqual(obsoleteDemoUsers(users, ['ana-ingreso', 'ana']), ['old-user-uuid'])
})
