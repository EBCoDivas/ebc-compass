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
    storeToken(token('sub-sofia', 'sofia', 'Sofia'))
    const { activePersona, academicDataFromClaims } = await import('./personaService')
    const { getToken } = await import('./session')
    expect(activePersona()?.id).toBe('sofia')
    expect(academicDataFromClaims(getToken())?.fullName).toBe('Sofia')
    expect(academicDataFromClaims(getToken())?.semester).toBe('2.º semestre')
  })
  it('formats academic periods as ordinals', async () => {
    const { periodLabel } = await import('./personaService')
    expect(periodLabel(2)).toBe('2.º semestre')
    expect(periodLabel('3', 'cuatrimestre')).toBe('3.º cuatrimestre')
    expect(periodLabel('Propedéutico', 'periodo')).toBe('Propedéutico periodo')
  })
  it('isolates profiles and conversations and restores each authenticated user', async () => {
    const { storeToken } = await import('./session')
    const { loadProfile, saveProfile } = await import('./profileService')
    const { getStudentId, getConversationId } = await import('./assistantService')
    const { personaStorageKey } = await import('./personaService')
    storeToken(token('sub-sofia', 'sofia', 'Sofia'))
    saveProfile({ ...loadProfile()!, name: 'Vale' })
    window.localStorage.setItem(personaStorageKey('ebc_compass_conversation_id'), 'conversation-sofia')
    storeToken(token('sub-diego', 'diego', 'Diego'))
    expect(getStudentId()).toBe('sub-diego')
    expect(loadProfile()?.name).toBe('Diego')
    expect(getConversationId()).toBeNull()
    storeToken(token('sub-sofia', 'sofia', 'Sofia'))
    expect(loadProfile()?.name).toBe('Vale')
    expect(getConversationId()).toBe('conversation-sofia')
    storeToken(token('sub-new', 'sin-perfil'))
    expect(loadProfile()).toBeNull()
  })
  it('clears expired sessions and clears the active identity on logout', async () => {
    const { storeToken, getToken, signOut } = await import('./session')
    expect(() => storeToken(token('sub', 'sofia', 'Sofia', true))).toThrow()
    sessionStorage.setItem('ebc_compass_id_token', token('sub', 'sofia', 'Sofia', true))
    expect(getToken()).toBeNull()
    storeToken(token('sub', 'sofia', 'Sofia'))
    signOut()
    expect(getToken()).toBeNull()
    const { activePersona } = await import('./personaService')
    expect(activePersona()).toBeUndefined()
  })
})
