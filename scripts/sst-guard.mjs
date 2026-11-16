#!/usr/bin/env node
// Guard de los comandos de SST que cambian infraestructura (dev, deploy, remove).
// El README los reserva para actividades con autorización de infraestructura: requieren --confirm explícito.
import { spawnSync } from 'node:child_process'
import { root } from './lib/emulator-env.mjs'

const [action, ...rest] = process.argv.slice(2)
if (!['dev', 'deploy', 'remove'].includes(action)) {
  console.error('Uso: node scripts/sst-guard.mjs <dev|deploy|remove> --confirm')
  process.exit(2)
}
if (!rest.includes('--confirm')) {
  console.error(`✖ "sst ${action}" está reservado a actividades con autorización de infraestructura (README).`)
  console.error(`  Si la tienes, ejecuta: npm run sst:${action} -- --confirm`)
  process.exit(1)
}
const result = spawnSync('npm', ['--prefix', 'platform', 'run', action], { cwd: root, stdio: 'inherit' })
process.exit(result.status ?? 1)
