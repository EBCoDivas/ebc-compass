#!/usr/bin/env node
// Diagnóstico del entorno local. ✔ correcto · ⚠ aviso (no bloquea) · ✖ problema (con la acción correctiva).
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { cleanBaseEnv, emulatorEnv, loadEnvFile, root } from './lib/emulator-env.mjs'
import { emulatorHealthy, httpGet } from './lib/wait.mjs'

let failures = 0
const ok = (text) => console.log(`✔ ${text}`)
const warn = (text, fix) => console.log(`⚠ ${text}${fix ? `\n    → ${fix}` : ''}`)
const bad = (text, fix) => {
  failures += 1
  console.log(`✖ ${text}${fix ? `\n    → ${fix}` : ''}`)
}

async function probe(url) {
  try {
    const { status, body } = await httpGet(url)
    return { status, body }
  } catch {
    return undefined
  }
}

console.log('EBC Compass · doctor\n')

// Node y Docker
Number(process.versions.node.split('.')[0]) === 22 ? ok(`Node ${process.versions.node}`) : bad(`Node ${process.versions.node} (se requiere 22)`, 'Instala Node 22')
spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0
  ? ok('Docker responde')
  : bad('Docker no responde', 'Abre Docker Desktop')

// Archivos .env y clave (sin imprimir valores)
for (const pkg of ['backend', 'frontend', 'local']) {
  const exists = Object.keys(loadEnvFile(join(root, pkg, '.env'))).length > 0
  exists ? ok(`${pkg}/.env existe`) : bad(`Falta ${pkg}/.env`, 'npm run env:create')
}
const key = loadEnvFile(join(root, 'local', '.env')).OPENAI_API_KEY
key ? ok('OPENAI_API_KEY definida en local/.env') : bad('OPENAI_API_KEY vacía en local/.env', 'Edita local/.env y pega tu clave (o usa npm run dev:rules)')

// Emulador y recursos
if (await emulatorHealthy()) {
  ok('AWS Emulator responde (https://127.0.0.1:9297)')
  const result = spawnSync('npm', ['--prefix', 'local', 'run', '-s', 'provision', '--', '--check'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...cleanBaseEnv(), ...emulatorEnv() },
  })
  result.status === 0 ? ok('Tablas DynamoDB, cuentas Cognito y bucket S3 verificados') : bad('Faltan recursos en el emulador', 'npm run provision')
} else {
  bad('AWS Emulator no responde', 'npm run emulator:up   (o npm run dev)')
}

// Puente, backend, frontend (avisos: pueden no estar corriendo)
const bridge = await probe('http://127.0.0.1:8787/health?deep=1')
if (!bridge) warn('El puente no está corriendo', 'npm run dev')
else {
  const info = JSON.parse(bridge.body)
  info.upstream === 'ok' ? ok(`Puente y OpenAI responden (modelo ${info.model})`) : bad(`El puente no puede usar OpenAI: ${info.detail ?? 'error'}`, 'Revisa OPENAI_API_KEY y OPENAI_MODEL en local/.env')
  info.vectorStoreLoaded ? ok('Base de conocimiento cargada') : warn('Base de conocimiento sin cargar', 'npm run kb:upload (Fase 3)')
}
;(await probe('http://127.0.0.1:3000/api/health')) ? ok('Backend responde (:3000)') : warn('El backend no está corriendo', 'npm run dev')
;(await probe('http://localhost:5173')) ? ok('Frontend responde (:5173)') : warn('El frontend no está corriendo', 'npm run dev')

console.log(failures ? `\n${failures} problema(s) por resolver.` : '\nTodo en orden.')
process.exit(failures ? 1 : 0)
