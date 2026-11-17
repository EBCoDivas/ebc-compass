const TOKEN_KEY = 'ebc_compass_id_token'

/** Decodifica claims para presentar la sesión; la autorización siempre se valida en backend. */
export function tokenClaims(token: string | null): Record<string, unknown> | null {
  try {
    const base = token?.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/')
    if (!base) return null
    const json = new TextDecoder().decode(Uint8Array.from(atob(base.padEnd(Math.ceil(base.length / 4) * 4, '=')), c => c.charCodeAt(0)))
    const claims: unknown = JSON.parse(json)
    return claims && typeof claims === 'object' && !Array.isArray(claims) ? claims as Record<string, unknown> : null
  } catch { return null }
}
export function signOut(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    const keys = Object.keys(sessionStorage).filter(key => key.startsWith('CognitoIdentityServiceProvider.'))
    for (const key of keys) sessionStorage.removeItem(key)
  } catch { /* Sesión ya inaccesible. */ }
}
export function storeToken(token: string) {
  const claims = tokenClaims(token)
  if (typeof claims?.sub !== 'string' || typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) throw new Error('Sesión inválida.')
  sessionStorage.setItem(TOKEN_KEY, token)
}
export function getToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY)
    const claims = tokenClaims(token)
    if (typeof claims?.exp !== 'number' || claims.exp * 1000 <= Date.now()) { signOut(); return null }
    return token
  } catch { return null }
}
export function sessionSubject(): string | undefined {
  const sub = tokenClaims(getToken())?.sub
  return typeof sub === 'string' ? sub : undefined
}
export async function sessionFetch(input: string, init?: RequestInit) {
  const token = getToken()
  const response = await fetch(input, { ...init, headers: { ...init?.headers, ...(token ? { authorization: 'Bearer ' + token } : {}) } })
  if (response.status === 401) {
    signOut()
    if (typeof window !== 'undefined') window.location.assign('/acceso')
  }
  return response
}
