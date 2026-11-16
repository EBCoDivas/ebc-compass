// Punto de entrada para AWS Lambda: el mismo backend Express detrás de API Gateway HTTP API (payload v2).
// Se despliega con platform/infra (SST) en una sola función que atiende `ANY /api/{proxy+}`.
import serverless from 'serverless-http'
import { app } from './app.js'

export const handler = serverless(app, {
  // serverless-http entrega el cuerpo crudo como `req.body` (Buffer) y express.json() lo ignora. Se convierte aquí a
  // objeto cuando es JSON válido; si no lo es, se descarta y Express responde con el error de entrada inválida.
  request: (request: { body?: unknown; headers?: Record<string, string | undefined> }) => {
    if (!Buffer.isBuffer(request.body)) return
    const isJson = (request.headers?.['content-type'] ?? '').includes('application/json')
    try {
      request.body = isJson && request.body.length > 0 ? JSON.parse(request.body.toString('utf8')) : undefined
    } catch {
      request.body = undefined
    }
  },
})
