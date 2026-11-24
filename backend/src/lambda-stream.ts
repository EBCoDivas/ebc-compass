// Solo la ruta de streaming usa este handler; las demás conservan serverless-http.
import type { Writable } from 'node:stream'
import type { Request } from 'express'
import { createAssistant, ensureConversation, maintainConversation, runTurnStreaming } from './assistant/index.js'
import { createBannerReader } from './banner/reader.js'
import { ensureCatalog } from './catalog/catalog.js'
import { parseStudentTurn, writeSse } from './routes/assistantRoutes.js'
type GatewayEvent = {
  httpMethod?: string; path?: string; rawPath?: string; body?: string; isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string }; authorizer?: { claims?: Record<string, unknown>; jwt?: { claims?: Record<string, unknown> } } }
}
declare const awslambda: {
  streamifyResponse: (handler: (event: GatewayEvent, stream: Writable) => Promise<void>) => unknown
  HttpResponseStream: { from: (stream: Writable, metadata: { statusCode: number; headers: Record<string, string> }) => Writable }
}
const banner = createBannerReader()
const assistant = createAssistant({ banner })
const headers = { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'Access-Control-Allow-Origin': '*' }
export const handler = awslambda.streamifyResponse(async (event, raw) => {
  let output = raw
  let started = false
  const abort = new AbortController()
  const close = () => { if (!output.writableEnded) abort.abort() }
  raw.on('close', close)
  try {
    const claims = event.requestContext?.authorizer?.claims ?? event.requestContext?.authorizer?.jwt?.claims
    if (typeof claims?.sub !== 'string') {
      output = awslambda.HttpResponseStream.from(raw, { statusCode: 401, headers: { ...headers, 'Content-Type': 'application/json' } })
      output.end(JSON.stringify({ code: 'UNAUTHORIZED', message: 'Inicia sesión.' })); return
    }
    if ((event.httpMethod ?? event.requestContext?.http?.method) !== 'POST' || (event.path ?? event.rawPath) !== '/api/assistant/messages/stream') {
      output = awslambda.HttpResponseStream.from(raw, { statusCode: 404, headers })
      output.end(); return
    }
    await ensureCatalog(banner)
    const body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body ?? '', 'base64').toString('utf8') : event.body ?? '{}')
    const { input, studentId, conversationId } = await parseStudentTurn({ body, apiGateway: { event } } as unknown as Request, assistant)
    await ensureConversation(assistant.graph, studentId, conversationId, !input.requireExisting)
    output = awslambda.HttpResponseStream.from(raw, { statusCode: 200, headers })
    started = true
    const time = performance.now()
    await writeSse(output, 'meta', { conversationId })
    const reply = await runTurnStreaming(assistant.graph, input, abort.signal, async event => {
      const { event: name, ...data } = event
      await writeSse(output, name, { conversationId, ...data })
    })
    await writeSse(output, 'done', { conversationId, message: { role: 'assistant', ...reply },
      meta: { mode: reply.generatedBy, latencyMs: reply.latencyMs ?? Math.round(performance.now() - time), degraded: reply.degraded, historyStatus: reply.historyStatus, ...(reply.usage ? { usage: reply.usage } : {}) } })
    output.end()
    await maintainConversation(assistant.graph, input.threadId)
  } catch (error) {
    if (!started) {
      const failure = error as { status?: number; code?: string; message?: string }
      output = awslambda.HttpResponseStream.from(raw, { statusCode: failure.status ?? 400, headers: { ...headers, 'Content-Type': 'application/json' } })
      output.end(JSON.stringify({ code: failure.code ?? 'INVALID_INPUT', message: failure.status ? failure.message : 'La solicitud no es válida.' }))
    } else {
      await writeSse(output, 'error', { code: 'STREAM_FAILED', message: 'La respuesta se interrumpió. Puedes reintentar.' })
      output.end()
    }
  } finally { raw.off('close', close) }
})
