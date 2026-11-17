#!/usr/bin/env node
// Prepara el entorno local completo. Idempotente: puedes ejecutarlo las veces que quieras.
//   npm run setup                 instala todo y levanta el emulador
//   npm run setup -- --skip-platform   omite instalar dependencias de platform/ (SST)

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { cleanBaseEnv, emulatorEnv, emulatorReady, loadEnvFile, root } from './lib/emulator-env.mjs'
import { waitForEmulator } from './lib/wait.mjs'
import { checkAws, checkNode, ensureDocker, composeInstalled } from './lib/prerequisites.mjs'

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
// Node solo genera una alerta: cada quien lo configura a su manera.
const node = checkNode()
if (node.state === 'ok') console.log(`✔ ${node.message}`)
else {
  console.log(`⚠ ${node.message}`)
  console.log(`    → ${node.fix}`)
  warnings.push(node.fix)
}

// Docker es obligatorio: si falta o no responde, se ofrece resolverlo (siempre con confirmación).
const dockerReady = await ensureDocker()
const awsWarning = await checkAws()
if (awsWarning) { warnings.push(awsWarning); console.log(`⚠ ${awsWarning}`) }
const composeReady = composeInstalled()
console.log(composeReady ? '✔ Docker Compose' : '✖ Falta Docker Compose. Instala Docker Desktop o el plugin Compose y ejecuta npm run setup.')
if (!dockerReady || !composeReady) {
  console.error('\n✖ Prerrequisitos incompletos. Corrige lo indicado y ejecuta npm run setup (npm run doctor para diagnosticar).')
  process.exit(1)
}

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
console.log('\nConfigura OPENAI_VECTOR_STORE_ID en local/.env para consultar el store compartido. kb:upload es una tarea de mantenimiento.')

console.log('\n✔ Entorno listo.')
for (const warning of warnings) console.log(`⚠ ${warning}`)
console.log('\nSiguiente paso: npm run dev   (y npm run doctor para diagnosticar)')
