// Prerrequisitos del entorno local, compartidos por `npm run setup` y `npm run doctor`.
// Regla: nunca se instala nada sin que la persona lo confirme, y Node solo genera una alerta
// (cada quien lo configura a su manera: nvm, fnm, instalador oficial…).
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { waitFor } from './wait.mjs'

export const REQUIRED_NODE_MAJOR = 22

/** 'macos' | 'windows' | 'linux' | 'other' */
export function detectPlatform(platform = process.platform) {
  if (platform === 'darwin') return 'macos'
  if (platform === 'win32') return 'windows'
  if (platform === 'linux') return 'linux'
  return 'other'
}

/** Node nunca bloquea: si no es la versión esperada, solo se avisa. */
export function checkNode(version = process.versions.node, required = REQUIRED_NODE_MAJOR) {
  const major = Number(version.split('.')[0])
  return major === required
    ? { state: 'ok', message: `Node ${version}` }
    : { state: 'warn', message: `Node ${version}: el proyecto declara Node ${required} (>=${required} <${required + 1})`,
        fix: `Configura Node ${required} con tu herramienta preferida (nvm, fnm, volta o el instalador oficial). El setup no cambia tu versión.` }
}

const tools = {
  docker: {
    label: 'Docker',
    required: true,
    manual: 'Instala Docker Desktop desde https://www.docker.com/products/docker-desktop',
    install: {
      macos: { manager: 'brew', command: ['brew', 'install', '--cask', 'docker'] },
      windows: { manager: 'winget', command: ['winget', 'install', '-e', '--id', 'Docker.DockerDesktop'] },
    },
  },
  aws: {
    label: 'AWS CLI',
    required: false,
    manual: 'Instala el AWS CLI desde https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html',
    install: {
      macos: { manager: 'brew', command: ['brew', 'install', 'awscli'] },
      windows: { manager: 'winget', command: ['winget', 'install', '-e', '--id', 'Amazon.AWSCLI'] },
    },
  },
}

/**
 * Cómo instalar una herramienta en este sistema.
 * `available` indica qué gestores de paquetes hay (por ejemplo `new Set(['brew'])`).
 * Devuelve `command` solo cuando hay un gestor que lo permita; si no, solo la instrucción manual.
 */
export function installPlan(tool, platform = detectPlatform(), available = new Set()) {
  const spec = tools[tool]
  if (!spec) throw new Error(`Herramienta desconocida: ${tool}`)
  const option = spec.install[platform]
  const command = option && available.has(option.manager) ? option.command : null
  const manual = option && !command
    ? `${spec.manual} (o instala ${option.manager === 'brew' ? 'Homebrew' : 'winget'} y vuelve a ejecutar el setup)`
    : spec.manual
  return { label: spec.label, required: spec.required, command, manual }
}

function run(command, args = []) {
  return spawnSync(command, args, { stdio: 'ignore' })
}
const exists = (command) => run(command, ['--version']).status === 0

export function availableManagers() {
  const managers = new Set()
  if (exists('brew')) managers.add('brew')
  if (spawnSync('winget', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' }).status === 0) managers.add('winget')
  return managers
}

/** 'missing' (no instalado) | 'stopped' (instalado, el servicio no responde) | 'ok' */
export function dockerState() {
  if (!exists('docker')) return 'missing'
  return run('docker', ['info']).status === 0 ? 'ok' : 'stopped'
}
export const awsInstalled = () => exists('aws')

/** Solo pregunta si hay una persona en la terminal; en CI o con --no-prompt devuelve false. */
export async function confirm(question) {
  if (!process.stdin.isTTY || process.argv.includes('--no-prompt') || process.env.CI) return false
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = (await rl.question(`${question} [s/N] `)).trim().toLowerCase()
    return answer === 's' || answer === 'si' || answer === 'sí' || answer === 'y' || answer === 'yes'
  } finally {
    rl.close()
  }
}

/** Ejecuta el comando de instalación mostrando su salida. Devuelve true si terminó bien. */
export function runInstall(command) {
  console.log(`  $ ${command.join(' ')}`)
  return spawnSync(command[0], command.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' }).status === 0
}

/** Pasos para arrancar Docker cuando está instalado pero no responde. */
export function dockerStartHint(platform = detectPlatform()) {
  if (platform === 'macos') return { command: ['open', '-a', 'Docker'], text: 'Abre Docker Desktop y espera a que termine de arrancar.' }
  if (platform === 'windows') return { command: null, text: 'Abre Docker Desktop desde el menú Inicio y espera a que termine de arrancar.' }
  return { command: null, text: 'Inicia el servicio de Docker (por ejemplo: sudo systemctl start docker) y vuelve a ejecutar el setup.' }
}

/**
 * Revisa Docker y, si hace falta, ofrece resolverlo. Devuelve true cuando Docker responde.
 * Nunca instala sin confirmación.
 */
export async function ensureDocker({ log = console.log } = {}) {
  let state = dockerState()
  if (state === 'ok') { log('✔ Docker'); return true }

  const platform = detectPlatform()
  if (state === 'missing') {
    const plan = installPlan('docker', platform, availableManagers())
    log('✖ Docker no está instalado.')
    if (plan.command && await confirm(`  ¿Instalarlo ahora con "${plan.command.join(' ')}"?`)) {
      if (runInstall(plan.command)) log('  Instalado. Ábrelo una vez para completar la configuración y vuelve a ejecutar: npm run setup')
      else log('  La instalación falló. Instálalo a mano y vuelve a ejecutar: npm run setup')
      return false
    }
    log(`    → ${plan.command ? `${plan.command.join(' ')}   (o: ${plan.manual})` : plan.manual}`)
    log('    Después vuelve a ejecutar: npm run setup')
    return false
  }

  const hint = dockerStartHint(platform)
  log('✖ Docker está instalado pero no responde.')
  if (hint.command && await confirm(`  ¿Abrirlo ahora con "${hint.command.join(' ')}"?`)) {
    run(hint.command[0], hint.command.slice(1))
    log('  Esperando a Docker (hasta 45 s)…')
    if (await waitFor(() => dockerState() === 'ok', 45_000, 3000)) { log('✔ Docker'); return true }
  }
  log(`    → ${hint.text}`)
  log('    Después vuelve a ejecutar: npm run setup')
  return false
}

/** Revisa el AWS CLI (opcional). Devuelve un aviso o undefined. */
export async function checkAws({ log = console.log } = {}) {
  if (awsInstalled()) { log('✔ AWS CLI'); return undefined }
  const plan = installPlan('aws', detectPlatform(), availableManagers())
  if (plan.command && await confirm(`⚠ AWS CLI no está instalado (opcional). ¿Instalarlo con "${plan.command.join(' ')}"?`)) {
    if (runInstall(plan.command)) { log('✔ AWS CLI instalado'); return undefined }
    return 'No se pudo instalar el AWS CLI (opcional: solo se usa para depurar).'
  }
  return `AWS CLI no está instalado (opcional, solo se usa para depurar). ${plan.command ? plan.command.join(' ') : plan.manual}`
}

export const composeInstalled = () => run('docker', ['compose', 'version']).status === 0
