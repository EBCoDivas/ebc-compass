#!/usr/bin/env node
// Ejecuta un comando con las variables del emulador de AWS ya definidas.
// Uso: node scripts/with-emulator-env.mjs <comando> [argumentos...]
// NODE_EXTRA_CA_CERTS solo se lee al arrancar Node, por eso se define antes de lanzar el proceso hijo.
import { spawn } from 'node:child_process'
import { cleanBaseEnv, emulatorEnv, emulatorReady } from './lib/emulator-env.mjs'

const [command, ...args] = process.argv.slice(2)
if (!command) {
  console.error('Uso: with-emulator-env.mjs <comando> [argumentos...]')
  process.exit(2)
}
if (!emulatorReady()) {
  console.error('✖ El emulador no está en marcha (faltan sus credenciales en ~/.aws/emulator/9297/). Ejecuta: npm run emulator:up')
  process.exit(1)
}
const child = spawn(command, args, { stdio: 'inherit', env: { ...cleanBaseEnv(), ...emulatorEnv() } })
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
