import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CreateFunctionCommand, GetFunctionCommand, LambdaClient, UpdateFunctionCodeCommand, UpdateFunctionConfigurationCommand, waitUntilFunctionUpdatedV2, waitUntilFunctionActiveV2 } from '@aws-sdk/client-lambda'
import { STUDENT_CONTEXT_HEADER, TARGET_NAME, toolList } from './contract.js'
import { loadEnvFile } from '../../../scripts/lib/emulator-env.mjs'
import { signedRequest } from './signedRequest.js'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const bannerName = 'ebc-compass-banner-mock'
const toolsName = 'ebc-compass-mcp-tools'
const gatewayName = 'ebc-compass-local'
const roleName = 'ebc-compass-local-mcp'
const statePath = join(root, 'local', '.state', 'mcp.json')
const region = 'us-east-1'

function pack(entry: string, includeKnowledge = false) {
  const dir = mkdtempSync(join(tmpdir(), 'ebc-mcp-'))
  try {
    const handler = join(dir, 'index.js')
    execFileSync(join(root, 'backend/node_modules/.bin/esbuild'), [
      join(root, 'backend/src', entry), '--bundle', '--platform=node', '--target=node22', '--format=cjs',
      // El runtime del emulador no ofrece node:module: se empaqueta en CommonJS y se define import.meta.url a mano.
      '--define:import.meta.url=__metaUrl', '--banner:js=var __metaUrl = require("node:url").pathToFileURL(__filename).href;',
      '--outfile=' + handler,
    ], { stdio: 'pipe' })
    // El runtime del emulador no trae todos los módulos de Node: process es global y los que no existen se sustituyen por un marcador que falla al usarse.
    const missing = ['http2', 'net', 'tls', 'zlib', 'child_process', 'async_hooks', 'worker_threads', 'perf_hooks', 'dns', 'readline']
    const unavailable = 'new Proxy(function () {}, { get: (_t, key) => key === "constants" ? {} : () => { throw new Error("Módulo no disponible en el runtime del emulador") } })'
    writeFileSync(handler, readFileSync(handler, 'utf8')
      .replace(/require\((["'])(?:node:)?process\1\)/g, 'globalThis.process')
      .replace(new RegExp('require\\((["\'])(?:node:)?(?:' + missing.join('|') + ')\\1\\)', 'g'), '(globalThis.__unavailable ??= ' + unavailable + ')')
      .replace(/(["'`])node:/g, '$1'))
    const files = ['index.js']
    if (includeKnowledge) {
      mkdirSync(join(dir, 'knowledge'))
      for (const name of readdirSync(join(root, 'knowledge')).filter(name => name.endsWith('.md')).sort()) {
        const path = 'knowledge/' + name
        copyFileSync(join(root, path), join(dir, path))
        files.push(path)
      }
    }
    const timestamp = new Date('2000-01-01T12:00:00Z')
    for (const path of files) utimesSync(join(dir, path), timestamp, timestamp)
    const archive = join(dir, 'function.zip')
    execFileSync('zip', ['-X', '-q', archive, ...files], { cwd: dir })
    return readFileSync(archive)
  } finally { rmSync(dir, { recursive: true, force: true }) }
}

async function ensureLambda(client: LambdaClient, name: string, role: string, entry: string,
  check: boolean, variables: Record<string, string> = {}, includeKnowledge = false) {
  const key = { FunctionName: name }
  const existing = await client.send(new GetFunctionCommand(key)).catch(error => {
    if (error.name === 'ResourceNotFoundException') return undefined
    throw error
  })
  if (check) {
    if (!existing?.Configuration?.FunctionArn || existing.Configuration.State !== 'Active') throw new Error('Lambda local no está activa: ' + name)
    return existing.Configuration.FunctionArn
  }
  const zip = pack(entry, includeKnowledge)
  if (!existing) {
    const result = await client.send(new CreateFunctionCommand({ ...key, Runtime: 'nodejs22.x', Handler: 'index.handler', Role: role,
      Timeout: 10, Code: { ZipFile: zip }, Environment: { Variables: variables } }))
    await waitUntilFunctionActiveV2({ client, maxWaitTime: 45, minDelay: 1 }, key)
    return result.FunctionArn!
  }
  if (existing.Configuration?.CodeSha256 !== createHash('sha256').update(zip).digest('base64')) {
    await client.send(new UpdateFunctionCodeCommand({ ...key, ZipFile: zip }))
    await waitUntilFunctionUpdatedV2({ client, maxWaitTime: 45, minDelay: 1 }, key)
  }
  const before = existing.Configuration?.Environment?.Variables ?? {}
  if (Object.keys(before).length !== Object.keys(variables).length || Object.entries(variables).some(([key, value]) => before[key] !== value)) {
    await client.send(new UpdateFunctionConfigurationCommand({ ...key, Environment: { Variables: variables } }))
    await waitUntilFunctionUpdatedV2({ client, maxWaitTime: 45, minDelay: 1 }, key)
  }
  return existing.Configuration!.FunctionArn!
}

async function iamStatus(endpoint: string, action: string, parameters: Record<string, string>) {
  const body = new URLSearchParams({ Action: action, Version: '2010-05-08', ...parameters }).toString()
  const response = await signedRequest('iam', region)(new URL(endpoint), 'POST', {
    'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
  }, body)
  await response.body?.cancel().catch(() => {})
  return response.status
}

async function gatewayRole(endpoint: string, check: boolean) {
  const RoleName = roleName
  const status = await iamStatus(endpoint, 'GetRole', { RoleName })
  const arn = 'arn:aws:iam::000000000000:role/' + RoleName
  if (status === 200) return arn
  if (check || status !== 404) throw new Error('IAM local no pudo leer el rol MCP (HTTP ' + status + ').')
  const created = await iamStatus(endpoint, 'CreateRole', { RoleName, AssumeRolePolicyDocument: JSON.stringify({
    Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: 'sts:AssumeRole',
      Principal: { Service: ['lambda.amazonaws.com', 'bedrock-agentcore.amazonaws.com'] } }],
  }) })
  if (created !== 200 && created !== 409) throw new Error('IAM local no pudo crear el rol MCP (HTTP ' + created + ').')
  return arn
}

class ControlError extends Error { constructor(readonly status: number) { super('AgentCore local respondió HTTP ' + status) } }
async function controlPlane(endpoint: string, method: string, path: string, input?: object) {
  // El emulador valida la firma contra el host al que llega la petición, no contra el host real de AWS.
  const url = new URL(path, endpoint)
  const response = await signedRequest('bedrock-agentcore', region)(url, method, { 'content-type': 'application/json' },
    input ? JSON.stringify(input) : undefined)
  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    throw new ControlError(response.status)
  }
  return await response.json()
}

async function findResource<T>(endpoint: string, path: string, field: string, predicate: (item: T) => boolean): Promise<T | undefined> {
  let token: string | undefined
  do {
    const page = await controlPlane(endpoint, 'GET', path + (token ? '?nextToken=' + encodeURIComponent(token) : ''))
    const match = (page[field] as T[] | undefined)?.find(predicate)
    if (match) return match
    token = page.nextToken
  } while (token)
}

function saveState(transport: 'gateway' | 'local', gatewayUrl?: string) {
  mkdirSync(join(root, 'local', '.state'), { recursive: true })
  writeFileSync(statePath, JSON.stringify({ bannerFunctionName: bannerName, transport, gatewayUrl }) + '\n', { mode: 0o600 })
}

interface Gateway { name: string; gatewayId: string; gatewayUrl?: string; status?: string }
interface Target { name: string; targetId: string; status?: string }

async function waitReady<T extends { status?: string }>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const snapshot = await read()
    if (snapshot.status === 'READY') return snapshot
    if (snapshot.status?.includes('FAILED')) throw new Error('AgentCore local no pudo activar el recurso: ' + snapshot.status)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error('AgentCore local no llegó a READY.')
}

export async function provisionStudentMcp(check: boolean) {
  const endpoint = process.env.AWS_ENDPOINT_URL
  if (!endpoint || !/^https:\/\/127\.0\.0\.1:9297\/?$/.test(endpoint)) throw new Error('MCP local solo se aprovisiona en AWS Emulator de loopback.')
  const transport = process.env.MCP_TRANSPORT ?? 'gateway'
  if (transport !== 'gateway' && transport !== 'local') throw new Error('MCP_TRANSPORT debe ser gateway o local.')
  const lambda = new LambdaClient({ endpoint, region, maxAttempts: 2 })
  const role = await gatewayRole(endpoint, check)
  await ensureLambda(lambda, bannerName, role, 'banner/lambda.ts', check)
  if (transport === 'local') {
    if (!check) saveState('local')
    console.log('✔ Banner Lambda y MCP local sin Gateway')
    return
  }

  if (!check) saveState('gateway')
  try {
    const toolsArn = await ensureLambda(lambda, toolsName, role, 'mcp/lambda.ts', check, {
      AWS_ENDPOINT_URL: endpoint,
      ...(process.env.AWS_SHARED_CREDENTIALS_FILE ? { AWS_SHARED_CREDENTIALS_FILE: process.env.AWS_SHARED_CREDENTIALS_FILE } : {}),
      ...(process.env.NODE_EXTRA_CA_CERTS ? { NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS } : {}),
      AWS_DISABLE_HOST_PREFIX_INJECTION: 'true',
      BANNER_FUNCTION_NAME: bannerName,
      CONVERSATION_HISTORY_TABLE: process.env.CONVERSATION_HISTORY_TABLE ?? loadEnvFile(join(root, 'backend', '.env')).CONVERSATION_HISTORY_TABLE ?? 'Conversations',
      MCP_PACKAGED_KNOWLEDGE: 'true',
      MCP_KNOWLEDGE_MODE: 'keyword',
    }, true)
    if (!check) {
      const status = await iamStatus(endpoint, 'PutRolePolicy', { RoleName: roleName, PolicyName: 'compass-invoke-tools',
        PolicyDocument: JSON.stringify({
          Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: 'lambda:InvokeFunction', Resource: toolsArn }],
        }),
      })
      if (status !== 200) throw new Error('IAM local no pudo asignar la política MCP (HTTP ' + status + ').')
    }

    let gateway = await findResource<Gateway>(endpoint, '/gateways/', 'items', item => item.name === gatewayName)
    if (!gateway && !check) gateway = await controlPlane(endpoint, 'POST', '/gateways/', {
      name: gatewayName, roleArn: role, protocolType: 'MCP', authorizerType: 'AWS_IAM',
    }) as Gateway
    if (!gateway) throw new Error('Falta AgentCore Gateway local.')
    const base = '/gateways/' + encodeURIComponent(gateway.gatewayId) + '/'
    const activeGateway: Gateway = check ? await controlPlane(endpoint, 'GET', base) : await waitReady<Gateway>(() => controlPlane(endpoint, 'GET', base))
    const targetPath = base + 'targets/'
    let target = await findResource<Target>(endpoint, targetPath, 'items', item => item.name === TARGET_NAME)
    if (!check) {
      const config = {
        name: TARGET_NAME, credentialProviderConfigurations: [{ credentialProviderType: 'GATEWAY_IAM_ROLE' }],
        metadataConfiguration: { allowedRequestHeaders: [STUDENT_CONTEXT_HEADER] },
        targetConfiguration: { mcp: { lambda: { lambdaArn: toolsArn, toolSchema: { inlinePayload: toolList } } } },
      }
      target = target
        ? await controlPlane(endpoint, 'PUT', targetPath + encodeURIComponent(target.targetId) + '/', config) as Target
        : await controlPlane(endpoint, 'POST', targetPath, config) as Target
      const path = targetPath + encodeURIComponent(target.targetId) + '/'
      target = await waitReady<Target>(() => controlPlane(endpoint, 'GET', path))
    }
    if (!target || target.status !== 'READY' || activeGateway.status !== 'READY' || !activeGateway.gatewayUrl) throw new Error('Gateway o destino local no están listos.')
    if (!check) saveState('gateway', activeGateway.gatewayUrl)
    console.log('✔ Banner Lambda y AgentCore Gateway aprovisionados. Comprueba el transporte con npm run mcp:verify.')
  } catch (error) {
    if (!check && error instanceof ControlError && error.status === 501) {
      console.warn('⚠ El emulador devolvió 501 para AgentCore. Banner sigue disponible. Usa MCP_TRANSPORT=local en local/.env para probar el transporte de respaldo.')
      return
    }
    throw error
  }
}
