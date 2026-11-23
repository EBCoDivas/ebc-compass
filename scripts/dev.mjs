#!/usr/bin/env node
// Levanta toda la demo local: emulador de AWS, aprovisionamiento, puente Bedrock->OpenAI, backend y frontend.
//   npm run dev         asistente con LLM (requiere OPENAI_API_KEY en local/.env)
//   npm run dev:rules   asistente solo con reglas y plantillas (sin OpenAI; plan B de la demo)
// Ctrl+C detiene backend, frontend y puente. El emulador sigue en marcha (conserva sus datos en memoria);
// detenlo con `npm run stop`.

import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { cleanBaseEnv, emulatorEnv, loadEnvFile, root } from './lib/emulator-env.mjs'
import { waitForEmulator, waitForUrl } from './lib/wait.mjs'
import { demoAccessConfig, publicDemoEnvironment } from '../shared/demoAccounts.mjs'

const rulesOnly = process.argv.includes('--rules')

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(1)
}

function runSync(command, args, env = cleanBaseEnv()) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env })
  if (result.status !== 0) fail(`Falló: ${command} ${args.join(' ')}`)
}

// 1. Archivos .env
for (const pkg of ['backend', 'frontend', 'local']) {
  if (!existsSync(join(root, pkg, '.env'))) {
    console.log(`▶ Falta ${pkg}/.env: ejecutando env:create`)
    runSync('node', ['scripts/env-create.mjs'])
    break
  }
}

const localEnv = loadEnvFile(join(root, 'local', '.env'))
let jury
try { jury = demoAccessConfig({ ...localEnv, ...process.env }) }
catch (error) { fail(error.message) }

// 2. Docker + emulador
if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  fail('Docker no responde. Abre Docker Desktop y vuelve a ejecutar.')
}
console.log('▶ Emulador de AWS')
runSync('npm', ['--prefix', 'local', 'run', '-s', 'up'])
if (!(await waitForEmulator(60_000))) fail('El emulador no respondió. Revisa: docker logs ebc-aws-emulator')

// 3. Recursos (el emulador guarda todo en memoria: se aprovisiona en cada arranque; es idempotente)
console.log('▶ Aprovisionando recursos')
runSync('npm', ['--prefix', 'local', 'run', '-s', 'provision'], {
  ...cleanBaseEnv(), ...emulatorEnv(),
  JURY_DEMO_ENABLED: String(jury.enabled), JURY_DEMO_PASSWORD: jury.password ?? '',
})

// 4. Modo del asistente
let mode = rulesOnly ? 'rules' : (loadEnvFile(join(root, 'backend', '.env')).ASSISTANT_MODE ?? 'llm')
if (mode === 'llm' && !localEnv.OPENAI_API_KEY) {
  console.warn('⚠ Falta OPENAI_API_KEY en local/.env: se arranca en modo "rules" (sin LLM).')
  mode = 'rules'
}

// 5. Puertos libres: si ya hay algo escuchando (p. ej. un backend viejo con otro entorno), se avisa en vez de confundirlo con el nuevo.
const portInUse = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    socket.once('connect', () => (socket.destroy(), resolve(true)))
    socket.once('error', () => resolve(false))
  })
const wanted = [Number(loadEnvFile(join(root, 'backend', '.env')).PORT ?? 3000), 5173, ...(mode === 'llm' ? [8787] : [])]
const busy = []
for (const port of wanted) if (await portInUse(port)) busy.push(port)
if (busy.length > 0) fail(`Puerto(s) ocupado(s): ${busy.join(', ')}. Cierra lo que los use (lsof -i :${busy[0]}) y vuelve a ejecutar.`)

// 6. Procesos
// Cada servicio tiene su color para distinguir sus líneas. Se desactiva con NO_COLOR o si la salida no es una terminal.
const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const COLORS = { bridge: 35, backend: 36, frontend: 32 } // magenta, cian, verde
const tag = (name) => (useColor && COLORS[name] ? `\x1b[1;${COLORS[name]}m[${name}]\x1b[0m` : `[${name}]`)

const children = []
function start(name, command, args, env) {
  const child = spawn(command, args, { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  const pipe = (stream, out) => {
    let pending = ''
    stream.on('data', (chunk) => {
      pending += chunk
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) out.write(`${tag(name)} ${line}\n`)
    })
  }
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`✖ ${tag(name)} terminó con código ${code}. Deteniendo todo.`)
      shutdown(1)
    }
  })
  children.push(child)
}

let shuttingDown = false
function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      /* ya terminó */
    }
  }
  setTimeout(() => process.exit(code), 500)
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

const base = cleanBaseEnv()
if (mode === 'llm') start('bridge', 'npm', ['--prefix', 'local', 'run', '-s', 'bridge'], base)

const backendEnv = {
  ...base,
  ...loadEnvFile(join(root, 'backend', '.env')),
  ...emulatorEnv(),
  ASSISTANT_MODE: mode,
  LOCAL_COGNITO_STATE: join(root, 'local', '.state', 'cognito.json'),
}
start('backend', 'npm', ['--prefix', 'backend', 'run', '-s', 'dev'], backendEnv)
start('frontend', 'npm', ['--prefix', 'frontend', 'run', 'dev', '--', '--port', '5173', '--strictPort'], { ...base, VITE_LOCAL_AUTH: 'true', ...publicDemoEnvironment(jury) })

const port = backendEnv.PORT ?? '3000'
const ready = await Promise.all([
  waitForUrl(`http://127.0.0.1:${port}/api/health`, 60_000),
  waitForUrl('http://localhost:5173', 60_000),
  mode === 'llm' ? waitForUrl('http://127.0.0.1:8787/health', 60_000) : Promise.resolve(true),
])
// 7. Base de conocimiento: el emulador la pierde al reiniciarse. Se vuelve a cargar en S3 Vectors (embeddings en caché).
if (mode === 'llm' && ready[2] && localEnv.KNOWLEDGE_STORE !== 'openai') {
  console.log('▶ Cargando la base de conocimiento en S3 Vectors')
  const indexed = spawnSync('npm', ['--prefix', 'local', 'run', '-s', 'kb:index'], { cwd: root, stdio: 'inherit', env: base })
  if (indexed.status !== 0) console.warn('⚠ No se cargó la base de conocimiento: Compass responderá con la búsqueda por palabras. Reintenta con: npm run kb:index')
}

if (ready.every(Boolean)) {
  console.log('\n✔ Todo listo')
  console.log('  Frontend:  http://localhost:5173')
  console.log(`  Backend:   http://localhost:${port}/api/health`)
  console.log('  Emulador:  https://127.0.0.1:9297')
  if (mode === 'llm') console.log('  Puente:    http://127.0.0.1:8787/health')
  console.log(`  Asistente: modo ${mode}`)
  console.log('  Ctrl+C detiene backend, frontend y puente (el emulador sigue; npm run stop lo detiene)\n')
} else {
  console.error('⚠ Algún servicio tardó demasiado en responder; revisa los logs de arriba o ejecuta: npm run doctor')
}
