import type { Request } from 'express'
import { resolvePlanningStudent } from '../auth/planningStudent.js'
import type { StudentContext } from '../planning/readStudentJourney.js'
import { asObject, encodeStudentContext, MCP_VERSION, STUDENT_CONTEXT_HEADER, TARGET_NAME, toolList, type ToolName, type ToolReply } from './contract.js'
import { signedRequest } from './signedRequest.js'
import { createToolRuntime } from './runtime.js'
import type { ToolHandler } from './tools.js'

type RpcMessage = { jsonrpc: '2.0'; id?: number; method: string; params?: object }
type RpcReply = { id?: number; result?: unknown; error?: unknown }
type Transport = (message: RpcMessage) => Promise<RpcReply | undefined>

function asToolReply(result: unknown): ToolReply {
  const wrapper = asObject(result)
  if (!wrapper || wrapper.isError) throw new Error('MCP_TOOL_FAILED')
  let output = asObject(wrapper.structuredContent)
  if (!output && Array.isArray(wrapper.content)) {
    const text = wrapper.content.map(asObject).find(item => item?.type === 'text')?.text
    if (typeof text === 'string') {
      try { output = asObject(JSON.parse(text)) } catch { /* No se expone la respuesta cruda del servicio. */ }
    }
  }
  if (output?.ok === true && asObject(output.data)) return { ok: true, data: asObject(output.data)! }
  if (output?.ok === false && ['UNAUTHORIZED', 'INVALID_INPUT', 'NOT_FOUND', 'UNAVAILABLE'].includes(String(output.code))) return output as ToolReply
  throw new Error('MCP_INVALID_TOOL_RESPONSE')
}

function client(transport: Transport) {
  let nextId = 0
  let ready: Promise<void> | undefined
  const rpc = async (method: string, params?: object) => {
    const id = ++nextId
    const reply = await transport({ jsonrpc: '2.0', id, method, params })
    if (!reply || reply.id !== id || reply.error || reply.result === undefined) throw new Error('MCP_REQUEST_FAILED')
    return reply.result
  }
  const initialize = () => ready ??= (async () => {
    const reply = asObject(await rpc('initialize', {
      protocolVersion: MCP_VERSION, capabilities: {}, clientInfo: { name: 'ebc-compass', version: '1.0.0' },
    }))
    if (!reply?.capabilities || !['2025-03-26', MCP_VERSION, '2025-11-25'].includes(String(reply.protocolVersion))) throw new Error('MCP_VERSION_UNSUPPORTED')
    await transport({ jsonrpc: '2.0', method: 'notifications/initialized' })
  })()
  return {
    async list() {
      await initialize()
      const result = asObject(await rpc('tools/list'))
      if (!result || !Array.isArray(result.tools)) throw new Error('MCP_INVALID_TOOL_LIST')
      return result.tools.map(asObject).map(item => String(item?.name))
    },
    async call(name: ToolName, args: object = {}) {
      await initialize()
      return asToolReply(await rpc('tools/call', { name: TARGET_NAME + '___' + name, arguments: args }))
    },
  }
}

export function localMcpClient(student: StudentContext, tools: ToolHandler) {
  let initialized = false
  return client(async ({ id, method, params }) => {
    if (method === 'initialize') return { id, result: { protocolVersion: MCP_VERSION, capabilities: { tools: {} }, serverInfo: { name: 'compass-local', version: '1.0.0' } } }
    if (method === 'notifications/initialized') { initialized = true; return }
    if (!initialized) return { id, error: { code: -32600 } }
    if (method === 'tools/list') return { id, result: { tools: toolList.map(item => ({ ...item, name: TARGET_NAME + '___' + item.name })) } }
    if (method === 'tools/call') {
      const input = asObject(params)
      const name = typeof input?.name === 'string' && input.name.startsWith(TARGET_NAME + '___') ? input.name.slice(TARGET_NAME.length + 3) : ''
      const result = await tools(name, input?.arguments, student)
      return { id, result: { content: [{ type: 'text', text: JSON.stringify(result) }] } }
    }
    return { id, error: { code: -32601 } }
  })
}

async function readRpcEvent(response: Response, id: number): Promise<RpcReply | undefined> {
  const reader = response.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary: RegExpMatchArray | null
      while ((boundary = buffer.match(/\r?\n\r?\n/))) {
        const event = buffer.slice(0, boundary.index)
        buffer = buffer.slice(boundary.index! + boundary[0].length)
        const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
        if (!data) continue
        const reply = JSON.parse(data) as RpcReply
        if (reply.id === id) return reply
      }
      if (buffer.length > 1024 * 1024) throw new Error('MCP_RESPONSE_TOO_LARGE')
    }
  } finally { await reader.cancel().catch(() => {}) }
}

export function gatewayMcpClient(student: StudentContext, endpoint: string, emulator?: string, signal?: AbortSignal) {
  const url = new URL(endpoint)
  const loopback = emulator && /^https:\/\/127\.0\.0\.1:9297\/?$/.test(emulator)
  const gatewayRegion = /^[a-z0-9-]+\.gateway\.bedrock-agentcore\.([a-z0-9-]+)\.amazonaws\.com$/.exec(url.hostname)?.[1]
  if (emulator && !loopback) throw new Error('MCP_INVALID_EMULATOR_ENDPOINT')
  if (url.protocol !== 'https:' || url.username || url.password || (!loopback && (!gatewayRegion || url.port))) throw new Error('MCP_INVALID_GATEWAY_URL')
  const connection = loopback ? new URL(emulator) : url
  if (loopback) {
    connection.pathname = url.pathname
    connection.search = url.search
  }
  const send = signedRequest('bedrock-agentcore', gatewayRegion, signal)
  let session: string | null = null
  let version = MCP_VERSION
  return client(async message => {
    const response = await send(url, 'POST', {
      'content-type': 'application/json', accept: 'application/json, text/event-stream',
      [STUDENT_CONTEXT_HEADER]: encodeStudentContext(student),
      ...(message.method !== 'initialize' ? { 'mcp-protocol-version': version } : {}),
      ...(session ? { 'mcp-session-id': session } : {}),
    }, JSON.stringify(message), connection)
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      throw new Error('MCP_GATEWAY_HTTP_' + response.status)
    }
    if (message.id === undefined) { await response.body?.cancel().catch(() => {}); return }
    const reply = response.headers.get('content-type')?.includes('text/event-stream')
      ? await readRpcEvent(response, message.id) : await response.json() as RpcReply
    if (message.method === 'initialize') {
      session = response.headers.get('mcp-session-id')
      const negotiated = asObject(reply?.result)?.protocolVersion
      if (typeof negotiated === 'string') version = negotiated
    }
    return reply
  })
}

export function createStudentMcpClient(student: StudentContext, local?: ToolHandler, signal?: AbortSignal) {
  if (process.env.MCP_TRANSPORT === 'local') {
    if (process.env.APP_STAGE || !/^https:\/\/127\.0\.0\.1:9297\/?$/.test(process.env.AWS_ENDPOINT_URL ?? '')) throw new Error('MCP_LOCAL_ONLY')
    return localMcpClient(student, local ?? createToolRuntime())
  }
  const url = process.env.MCP_GATEWAY_URL
  if (!url) throw new Error('Falta MCP_GATEWAY_URL.')
  return gatewayMcpClient(student, url, process.env.APP_STAGE ? undefined : process.env.AWS_ENDPOINT_URL, signal)
}

/** El navegador y los argumentos de herramientas nunca fijan el contexto. */
export async function mcpClientForRequest(request: Request, local?: ToolHandler) {
  const student = await resolvePlanningStudent(request)
  if (!student) throw new Error('UNAUTHORIZED')
  return createStudentMcpClient(student, local)
}
