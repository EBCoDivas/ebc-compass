#!/usr/bin/env node
// Prepara el entorno local completo. Idempotente: puedes ejecutarlo las veces que quieras.
//   npm run setup                 instala todo y levanta el emulador
//   npm run setup -- --skip-platform   omite instalar dependencias de platform/ (SST)

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { cleanBaseEnv, emulatorEnv, emulatorReady, loadEnvFile, root } from './lib/emulator-env.mjs'
import { waitForEmulator } from './lib/wait.mjs'

const skipPlatform = process.argv.includes('--skip-platform')
const warnings = []

function step(title) {
  console.log(`\n▶ ${title}`)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: cleanBaseEnv(), ...options })
  if (result.status !== 0) {
    console.error(`✖ Falló: ${command} ${args.join(' ')}`)
    process.exit(result.status ?? 1)
  }
}

step('1/5 Verificando prerrequisitos')
const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor !== 22) {
  console.error(`✖ Se requiere Node 22 (tienes ${process.versions.node}).`)
  process.exit(1)
}
console.log(`✔ Node ${process.versions.node}`)

if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  console.error('✖ Docker no responde. Abre Docker Desktop, espera a que arranque y vuelve a ejecutar: npm run setup')
  process.exit(1)
}
console.log('✔ Docker')

if (spawnSync('aws', ['--version'], { stdio: 'ignore' }).status === 0) console.log('✔ AWS CLI')
else warnings.push('AWS CLI no está instalado (solo se usa en el spike y para depurar).')

step('2/5 Creando archivos .env')
run('node', ['scripts/env-create.mjs'])

step('3/5 Instalando dependencias')
const packages = ['backend', 'frontend', 'local', 'scripts/lab', ...(skipPlatform ? [] : ['platform'])]
for (const pkg of packages) {
  console.log(`  · ${pkg}`)
  run('npm', ['--prefix', pkg, 'install', '--no-audit', '--no-fund'], { stdio: ['ignore', 'ignore', 'inherit'] })
}
if (skipPlatform) warnings.push('Se omitió platform/ (SST). Instálalo con: npm --prefix platform install')

step('4/5 Levantando AWS Emulator')
run('npm', ['--prefix', 'local', 'run', '-s', 'up'])
if (!(await waitForEmulator(60_000))) {
  console.error('✖ El emulador no respondió en 60 s. Revisa: docker logs ebc-aws-emulator')
  process.exit(1)
}
console.log('✔ Emulador listo en https://127.0.0.1:9297')

step('5/5 Aprovisionando recursos')
run('npm', ['--prefix', 'local', 'run', '-s', 'provision'], { env: { ...cleanBaseEnv(), ...emulatorEnv() } })

const apiKey = loadEnvFile(join(root, 'local', '.env')).OPENAI_API_KEY
if (!apiKey) warnings.push('Falta OPENAI_API_KEY en local/.env. Sin ella el asistente solo puede usar el modo "rules" (npm run dev:rules).')
console.log('\nNota: la base de conocimiento (npm run kb:upload) se agrega en la Fase 3.')

console.log('\n✔ Entorno listo.')
for (const warning of warnings) console.log(`⚠ ${warning}`)
console.log('\nSiguiente paso: npm run dev   (y npm run doctor para diagnosticar)')
