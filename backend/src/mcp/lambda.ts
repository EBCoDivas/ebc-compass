import { asObject, decodeStudentContext, STUDENT_CONTEXT_HEADER, TARGET_NAME } from './contract.js'
import { createToolRuntime } from './runtime.js'
import type { ToolHandler } from './tools.js'

export interface GatewayContext { clientContext?: { custom?: unknown } }

export function makeGatewayHandler(tools: ToolHandler) {
  return async (event: unknown, context: GatewayContext) => {
    const custom = asObject(context.clientContext?.custom)
    const tool = custom?.bedrockAgentCoreToolName
    const headers = asObject(custom?.bedrockAgentCorePropagatedHeaders)
    const header = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === STUDENT_CONTEXT_HEADER)?.[1]
    const student = decodeStudentContext(Array.isArray(header) && header.length === 1 ? header[0] : header)
    if (typeof tool !== 'string' || !tool.startsWith(TARGET_NAME + '___')) return { ok: false, code: 'INVALID_INPUT' } as const
    return tools(tool.slice(TARGET_NAME.length + 3), event, student)
  }
}

let tools: ToolHandler | undefined
export const handler = makeGatewayHandler((...args) => (tools ??= createToolRuntime())(...args))
