import { createHash, createHmac, type Hash, type Hmac } from 'node:crypto'
import { defaultProvider } from '@aws-sdk/credential-provider-node'
import { SignatureV4 } from '@smithy/signature-v4'

class Sha256 {
  private readonly hash: Hash | Hmac
  constructor(secret?: string | ArrayBuffer | ArrayBufferView) {
    this.hash = secret === undefined ? createHash('sha256') : createHmac('sha256', bytes(secret))
  }
  update(data: string | ArrayBuffer | ArrayBufferView, encoding?: 'utf8' | 'ascii' | 'latin1') { this.hash.update(bytes(data, encoding)) }
  async digest() { return this.hash.digest() }
}

function bytes(value: string | ArrayBuffer | ArrayBufferView, encoding?: BufferEncoding) {
  if (typeof value === 'string') return Buffer.from(value, encoding)
  if (value instanceof ArrayBuffer) return Buffer.from(value)
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
}

export function signedRequest(service: string, region = process.env.AWS_REGION ?? 'us-east-1', signal?: AbortSignal) {
  const signer = new SignatureV4({ service, region, credentials: defaultProvider(), sha256: Sha256 })
  return async (url: URL, method: string, headers: Record<string, string>, body?: string, connection = url) => {
    const query: Record<string, string | string[]> = {}
    for (const key of new Set(url.searchParams.keys())) query[key] = url.searchParams.getAll(key)
    const signed = await signer.sign({
      method, protocol: url.protocol, hostname: url.hostname, port: url.port ? Number(url.port) : undefined,
      path: url.pathname, query, headers: { ...headers, host: url.host }, body,
    })
    const timeout = AbortSignal.timeout(9000)
    return fetch(connection, { method, headers: signed.headers, body, redirect: 'error', signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
  }
}
