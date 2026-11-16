// Esperas de salud sin dependencias.
import { readFileSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import { EMULATOR_PORT, emulatorFiles, emulatorReady } from './emulator-env.mjs'

/** GET simple; resuelve { status, body } o lanza si no hay conexión. */
export function httpGet(url, { ca, timeout = 3000 } = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const request = lib.get(url, { ca, timeout }, (response) => {
      let body = ''
      response.on('data', (chunk) => (body += chunk))
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body }))
    })
    request.on('timeout', () => request.destroy(new Error('timeout')))
    request.on('error', reject)
  })
}

export async function emulatorHealthy(port = EMULATOR_PORT) {
  if (!emulatorReady(port)) return false
  try {
    const { status } = await httpGet(`https://127.0.0.1:${port}/__admin/health`, { ca: readFileSync(emulatorFiles(port).ca) })
    return status === 200
  } catch {
    return false
  }
}

export async function waitFor(check, timeoutMs, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return true
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  return false
}

export const waitForEmulator = (timeoutMs = 60_000) => waitFor(() => emulatorHealthy(), timeoutMs)
export const waitForUrl = (url, timeoutMs = 60_000) =>
  waitFor(async () => {
    try {
      return (await httpGet(url)).status < 500
    } catch {
      return false
    }
  }, timeoutMs)
