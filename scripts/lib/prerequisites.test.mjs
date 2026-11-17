import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkNode, detectPlatform, dockerStartHint, installPlan } from './prerequisites.mjs'

describe('Node', () => {
  it('con la versión esperada todo está bien', () => {
    assert.equal(checkNode('22.23.0').state, 'ok')
  })
  it('con otra versión solo avisa: nunca bloquea ni propone instalar', () => {
    for (const version of ['20.11.0', '24.1.0', '18.0.0']) {
      const result = checkNode(version)
      assert.equal(result.state, 'warn')
      assert.match(result.message, /Node 22/)
      assert.match(result.fix, /no cambia tu versión/)
    }
  })
})

describe('sistema operativo', () => {
  it('reconoce los tres sistemas principales', () => {
    assert.equal(detectPlatform('darwin'), 'macos')
    assert.equal(detectPlatform('win32'), 'windows')
    assert.equal(detectPlatform('linux'), 'linux')
    assert.equal(detectPlatform('freebsd'), 'other')
  })
})

describe('plan de instalación', () => {
  it('en macOS con Homebrew ofrece el comando de Docker', () => {
    const plan = installPlan('docker', 'macos', new Set(['brew']))
    assert.deepEqual(plan.command, ['brew', 'install', '--cask', 'docker'])
    assert.equal(plan.required, true)
  })
  it('en Windows con winget ofrece el comando de Docker', () => {
    const plan = installPlan('docker', 'windows', new Set(['winget']))
    assert.deepEqual(plan.command, ['winget', 'install', '-e', '--id', 'Docker.DockerDesktop'])
  })
  it('sin gestor de paquetes solo da la instrucción manual, sin comando', () => {
    const plan = installPlan('docker', 'macos', new Set())
    assert.equal(plan.command, null)
    assert.match(plan.manual, /docker\.com/)
    assert.match(plan.manual, /Homebrew/)
  })
  it('en Linux nunca propone instalar (requiere sudo): solo instrucciones', () => {
    const plan = installPlan('docker', 'linux', new Set(['brew', 'winget']))
    assert.equal(plan.command, null)
    assert.match(plan.manual, /docker\.com/)
  })
  it('el AWS CLI es opcional', () => {
    assert.equal(installPlan('aws', 'macos', new Set(['brew'])).required, false)
  })
  it('no existe un plan para instalar Node', () => {
    assert.throws(() => installPlan('node', 'macos', new Set(['brew'])), /desconocida/)
  })
})

describe('arrancar Docker', () => {
  it('en macOS puede abrirlo; en Windows y Linux solo explica cómo', () => {
    assert.deepEqual(dockerStartHint('macos').command, ['open', '-a', 'Docker'])
    assert.equal(dockerStartHint('windows').command, null)
    assert.equal(dockerStartHint('linux').command, null)
    assert.match(dockerStartHint('linux').text, /systemctl/)
  })
})


describe('setup sin herramientas instaladas', () => {
  it('revisa Docker, Compose y AWS antes de detenerse y no instala en una terminal no interactiva', () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../setup.mjs', import.meta.url)), '--no-prompt'], {
      env: { ...process.env, PATH: '', CI: '1' }, encoding: 'utf8', timeout: 10000,
    })
    assert.equal(result.status, 1)
    const output = result.stdout + result.stderr
    assert.match(output, /Docker no está instalado/)
    assert.match(output, /AWS CLI no está instalado/)
    assert.match(output, /Falta Docker Compose/)
    assert.match(output, /Prerrequisitos incompletos/)
    assert.doesNotMatch(output, /Instalando dependencias|Creando archivos/)
  })
})
