import test from 'node:test'
import assert from 'node:assert/strict'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, UnsecuredJWT } from 'jose'
import { verifyIdToken } from './tokenVerifier.js'

test('verifies RS256 and rejects invalid identity claims, expiration and signatures', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = await exportJWK(publicKey)
  const keys = createLocalJWKSet({ keys: [{ ...jwk, kid: 'test', alg: 'RS256' }] })
  const issuer = 'https://cognito.example/pool'
  const sign = (claims: Record<string, unknown> = {}) => new SignJWT({
    sub: 'student', token_use: 'id', iss: issuer, aud: 'web',
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, ...claims,
  }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).sign(privateKey)
  const valid = await sign()
  assert.equal((await verifyIdToken(valid, keys, issuer, 'web')).sub, 'student')
  for (const claims of [{ exp: 1 }, { iss: 'other-pool' }, { aud: 'other-client' }, { token_use: 'access' }, { sub: undefined }]) {
    await assert.rejects(verifyIdToken(await sign(claims), keys, issuer, 'web'))
  }
  const parts = valid.split('.')
  parts[1] = Buffer.from(JSON.stringify({ sub: 'attacker' })).toString('base64url')
  await assert.rejects(verifyIdToken(parts.join('.'), keys, issuer, 'web'))
  const unsigned = new UnsecuredJWT({ sub: 'student' }).encode()
  await assert.rejects(verifyIdToken(unsigned, keys, issuer, 'web'))
})
