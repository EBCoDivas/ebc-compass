// Utilidades compartidas por los scripts de la raíz y de local/.
// Sin dependencias: se ejecutan con Node plano.

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const EMULATOR_PORT = 9297

/** Lee un archivo .env simple (KEY=VALUE). Devuelve {} si no existe. */
export function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    env[match[1]] = value
  }
  return env
}

/** Rutas de credenciales y certificado que genera el emulador en cada arranque. */
export function emulatorFiles(port = EMULATOR_PORT) {
  const dir = join(homedir(), '.aws', 'emulator', String(port))
  return {
    dir,
    credentials: join(dir, 'emulator_credentials'),
    config: join(dir, 'config'),
    ca: join(dir, 'ca.pem'),
  }
}

export function emulatorReady(port = EMULATOR_PORT) {
  const f = emulatorFiles(port)
  return existsSync(f.credentials) && existsSync(f.ca)
}

/**
 * Variables que necesita el SDK de AWS para hablar con el emulador (HTTPS con certificado propio
 * y credenciales nuevas en cada arranque). Rutas absolutas: el "~" no se expande en archivos .env.
 */
export function emulatorEnv(port = EMULATOR_PORT) {
  const f = emulatorFiles(port)
  return {
    AWS_ENDPOINT_URL: `https://127.0.0.1:${port}`,
    AWS_SHARED_CREDENTIALS_FILE: f.credentials,
    AWS_CONFIG_FILE: f.config,
    AWS_CA_BUNDLE: f.ca,
    NODE_EXTRA_CA_CERTS: f.ca,
    AWS_EC2_METADATA_DISABLED: 'true',
    AWS_DISABLE_HOST_PREFIX_INJECTION: 'true',
    AWS_REGION: 'us-east-1',
    AWS_DEFAULT_REGION: 'us-east-1',
  }
}

/** Copia de process.env sin variables que pisarían las credenciales del emulador. */
export function cleanBaseEnv() {
  const env = { ...process.env }
  for (const key of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_PROFILE']) delete env[key]
  return env
}
