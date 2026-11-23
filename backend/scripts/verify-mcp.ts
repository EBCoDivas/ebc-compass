// Ejecutar con el wrapper del emulador y el backend en modo reglas.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { emulatorEnv, loadEnvFile, root } from '../../scripts/lib/emulator-env.mjs'
import { createStudentMcpClient } from '../src/mcp/client.js'
import { createToolRuntime } from '../src/mcp/runtime.js'
import { smokeStudent, verifyMcpStudent } from '../src/mcp/smoke.js'

if (process.env.AWS_ENDPOINT_URL !== emulatorEnv().AWS_ENDPOINT_URL || process.env.APP_STAGE) throw new Error('Usa npm run mcp:verify con AWS Emulator.')
const state = JSON.parse(readFileSync(join(root, 'local/.state/mcp.json'), 'utf8'))
const config = loadEnvFile(join(root, 'backend/.env'))
const api = 'http://127.0.0.1:' + (config.PORT ?? '3000')
process.env.BANNER_FUNCTION_NAME = state.bannerFunctionName
process.env.MCP_TRANSPORT = state.transport
process.env.MCP_GATEWAY_URL = state.gatewayUrl ?? ''
process.env.MCP_KNOWLEDGE_MODE = 'keyword'
process.env.CONVERSATION_HISTORY_TABLE = config.CONVERSATION_HISTORY_TABLE ?? 'Conversations'
const accounts = JSON.parse(readFileSync(join(root, 'local/.state/cognito.json'), 'utf8')).users as Record<string, { username: string; password: string }>
const tools = state.transport === 'local' ? createToolRuntime() : undefined
for (const persona of ['ana-ingreso', 'ana']) {
  const account = accounts[persona]
  if (!account) throw new Error('No existe la cuenta ' + persona)
  const response = await fetch(api + '/api/dev/session', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: account.username, password: account.password }),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error('No se pudo iniciar la sesión local de ' + persona)
  const { idToken } = await response.json() as { idToken: string }
  const student = smokeStudent(idToken, persona)
  await verifyMcpStudent(createStudentMcpClient(student, tools), student, api, idToken, { search: persona === 'ana-ingreso' })
  console.log('✔ MCP (' + state.transport + '): ' + persona)
}
