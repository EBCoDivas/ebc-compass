import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { parseEnv } from 'node:util'
import { demoAccessConfig } from '../../shared/demoAccounts.mjs'

function fixture(t, existingLocal) {
  const root = mkdtempSync(join(tmpdir(), 'ebc-env-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const pkg of ['backend', 'frontend', 'local', 'scripts/lab']) mkdirSync(join(root, pkg), { recursive: true })
  for (const pkg of ['backend', 'frontend', 'local', 'scripts/lab']) {
    copyFileSync(new URL(`../../${pkg}/.env.example`, import.meta.url), join(root, pkg, '.env.example'))
  }
  const script = join(root, 'scripts/env-create.mjs')
  copyFileSync(new URL('../env-create.mjs', import.meta.url), script)
  const local = join(root, 'local/.env')
  if (existingLocal !== undefined) writeFileSync(local, existingLocal)
  return { root, local, run: () => {
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout
  } }
}

test('env:create enables the local jury panel, generates a stable password and keeps the lab opt-in', t => {
  const { root, local, run } = fixture(t)
  const stdout = run()
  const first = readFileSync(local, 'utf8')
  const config = demoAccessConfig(parseEnv(first))
  assert.ok(config.enabled && config.password)
  assert.ok(!stdout.includes(config.password))
  assert.deepEqual(demoAccessConfig(parseEnv(readFileSync(join(root, 'scripts/lab/.env'), 'utf8'))), { enabled: false, password: undefined })
  run()
  assert.equal(readFileSync(local, 'utf8'), first)
})

test('env:create fills gaps in older local files and preserves an explicit opt-out', t => {
  const older = fixture(t, 'BRIDGE_PORT=8787\nJURY_DEMO_PASSWORD=\n')
  older.run()
  const migrated = parseEnv(readFileSync(older.local, 'utf8'))
  assert.equal(migrated.BRIDGE_PORT, '8787')
  assert.ok(demoAccessConfig(migrated).enabled && migrated.JURY_DEMO_PASSWORD)

  const optOut = 'BRIDGE_PORT=8787\nJURY_DEMO_ENABLED=false\nJURY_DEMO_PASSWORD=\n'
  const off = fixture(t, optOut)
  off.run()
  assert.equal(readFileSync(off.local, 'utf8'), optOut)
})
