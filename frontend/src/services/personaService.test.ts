import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function token(sub: string, persona: string, name?: string, expired = false) {
  return 'header.' + btoa(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + (expired ? -60 : 3600),
    'custom:personaId': persona, name, 'custom:career': 'finance', 'custom:campusCode': 'CDMX',
    'custom:programa': 'Finanzas', 'custom:semestre': '2' })) + '.signature'
}
beforeEach(() => {
  vi.resetModules()
  const data = new Map<string, string>()
  const storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) }
  vi.stubGlobal('sessionStorage', storage)
  vi.stubGlobal('window', { location: { search: '?persona=diego' }, localStorage: storage })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('authenticated personas', () => {
  it('ignores the URL persona and derives identity from the session claims', async () => {
    const { storeToken } = await import('./session')
    storeToken(token('sub-valerie', 'valerie', 'Valerie'))
    const { activePersona, academicDataFromClaims } = await import('./personaService')
    const { getToken } = await import('./session')
    expect(activePersona()?.id).toBe('valerie')
    expect(academicDataFromClaims(getToken())?.fullName).toBe('Valerie')
  })
  it('isolates profiles and conversations and restores each authenticated user', async () => {
    const { storeToken } = await import('./session')
    const { loadProfile, saveProfile } = await import('./profileService')
    const { getStudentId, getConversationId } = await import('./assistantService')
    const { personaStorageKey } = await import('./personaService')
    storeToken(token('sub-valerie', 'valerie', 'Valerie'))
    saveProfile({ ...loadProfile()!, name: 'Vale' })
    window.localStorage.setItem(personaStorageKey('ebc_compass_conversation_id'), 'conversation-valerie')
    storeToken(token('sub-diego', 'diego', 'Diego'))
    expect(getStudentId()).toBe('sub-diego')
    expect(loadProfile()?.name).toBe('Diego')
    expect(getConversationId()).toBeNull()
    storeToken(token('sub-valerie', 'valerie', 'Valerie'))
    expect(loadProfile()?.name).toBe('Vale')
    expect(getConversationId()).toBe('conversation-valerie')
    storeToken(token('sub-new', 'sin-perfil'))
    expect(loadProfile()).toBeNull()
  })
  it('clears expired sessions and clears the active identity on logout', async () => {
    const { storeToken, getToken, signOut } = await import('./session')
    expect(() => storeToken(token('sub', 'valerie', 'Valerie', true))).toThrow()
    sessionStorage.setItem('ebc_compass_id_token', token('sub', 'valerie', 'Valerie', true))
    expect(getToken()).toBeNull()
    storeToken(token('sub', 'valerie', 'Valerie'))
    signOut()
    expect(getToken()).toBeNull()
    const { activePersona } = await import('./personaService')
    expect(activePersona()).toBeUndefined()
  })
})
