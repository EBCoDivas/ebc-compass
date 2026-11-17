import { verifyIdToken } from './tokenVerifier.js'
// Se importa exclusivamente desde server.ts; no forma parte del handler Lambda.
import express, { type Express } from 'express'
import cors from 'cors'
import { createLocalJWKSet } from 'jose'
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider'
import type { AuthRequest } from './identity.js'

export interface LocalAuthConfig { poolId: string; clientId: string; issuer: string; jwksUrl: string }
export async function createAuthenticatedLocalApp(business: Express, config: LocalAuthConfig) {
  if (!config.clientId || !config.issuer || !/^https:\/\/127\.0\.0\.1:9297\//.test(config.jwksUrl) ||
    process.env.AWS_ENDPOINT_URL !== 'https://127.0.0.1:9297') throw new Error('Cognito local requiere el emulador de loopback.')
  const response = await fetch(config.jwksUrl)
  if (!response.ok) throw new Error('No se pudo cargar el JWKS local.')
  const keys = createLocalJWKSet(await response.json())
  const client = new CognitoIdentityProviderClient({})
  const app = express()
  app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
  app.use(express.json({ limit: '8kb' }))
  app.get('/api/health', (_req, res) => { res.json({ status: 'ok', auth: 'cognito-local' }) })
  app.post('/api/dev/session', async (req, res) => {
    const { username, password } = req.body ?? {}
    res.setHeader('Cache-Control', 'no-store')
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password || username.length > 128 || password.length > 256) {
      res.status(400).json({ code: 'INVALID_INPUT', message: 'Ingresa correo y contraseña.' }); return
    }
    try {
      const result = await client.send(new InitiateAuthCommand({ ClientId: config.clientId, AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: username.trim(), PASSWORD: password } }))
      const idToken = result.AuthenticationResult?.IdToken
      if (!idToken) throw new Error('No session')
      res.json({ idToken })
    } catch {
      res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' })
    }
  })
  app.use('/api', async (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1]
    try {
      if (!token) throw new Error('Missing token')
      const payload = await verifyIdToken(token, keys, config.issuer, config.clientId)
      ;(req as AuthRequest).verifiedClaims = payload
      next()
    } catch { res.status(401).json({ code: 'UNAUTHORIZED', message: 'Tu sesión no es válida o expiró. Inicia sesión nuevamente.' }) }
  })
  app.use(business)
  app.use((error: Error & { type?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error.type === 'entity.parse.failed') { res.status(400).json({ code: 'INVALID_INPUT', message: 'JSON inválido.' }); return }
    next(error)
  })
  return app
}
