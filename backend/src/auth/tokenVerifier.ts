import { jwtVerify, type JWTVerifyGetKey } from 'jose'

export async function verifyIdToken(token: string, key: JWTVerifyGetKey, issuer: string, audience: string) {
  const { payload } = await jwtVerify(token, key, {
    issuer, audience, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat'],
  })
  if (payload.token_use !== 'id') throw new Error('Invalid token use')
  return payload
}
