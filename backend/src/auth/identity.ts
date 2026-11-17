import type { Request } from 'express'

export type Claims = Record<string, unknown>
export type AuthRequest = Request & { verifiedClaims?: Claims }

/** Solo middleware local o contexto del authorizer de API Gateway; nunca headers del cliente. */
export function identityClaims(request: Request): Claims | undefined {
  const local = (request as AuthRequest).verifiedClaims
  if (local) return local
  const gateway = (request as Request & { apiGateway?: { event?: { requestContext?: { authorizer?: {
    jwt?: { claims?: Claims }; claims?: Claims
  } } } } }).apiGateway
  const auth = gateway?.event?.requestContext?.authorizer
  return auth?.jwt?.claims ?? auth?.claims
}
export function identitySubject(request: Request): string | undefined {
  const sub = identityClaims(request)?.sub
  return typeof sub === 'string' ? sub : undefined
}
