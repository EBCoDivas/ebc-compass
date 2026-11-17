import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { needsProfileSetup, profileCompleteness } from './profileService'
import { emptyProfile } from '../types/profile'

describe('profileCompleteness', () => {
  it('requires confirmation even when preloaded academic data are complete', () => {
    const profile = { ...emptyProfile, name: 'Demo', campus: 'CMS' as const, career: 'finance' as const, currentSemester: 2 }
    expect(profileCompleteness(profile)).toBe(100)
    expect(needsProfileSetup(profile)).toBe(true)
    expect(needsProfileSetup(null)).toBe(true)
    expect(needsProfileSetup({ ...profile, onboardingCompletedAt: '2026-11-16T12:00:00Z' })).toBe(false)
  })
  it('uses the four required profile fields', () => {
    expect(profileCompleteness({ ...emptyProfile, name: 'Valerie', campus: 'CMS', career: 'banking', currentSemester: 2 })).toBe(100)
    expect(profileCompleteness({ ...emptyProfile, name: 'Valerie', campus: 'CMS' })).toBe(50)
  })
})

describe('durable profile synchronization', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())
  async function session() {
    const data = new Map<string, string>()
    const storage = { getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key) }
    vi.stubGlobal('sessionStorage', storage)
    vi.stubGlobal('window', { localStorage: storage, location: { assign: vi.fn() } })
    const { storeToken } = await import('./session')
    storeToken('header.' + btoa(JSON.stringify({ sub: 'alice', exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature')
    return import('./profileService')
  }

  it('loads the server profile over a previous browser cache', async () => {
    const service = await session()
    service.saveProfile({ ...emptyProfile, id: 'alice', name: 'Cache' })
    const remote = { ...emptyProfile, id: 'alice', name: 'Durable', preferences: ['Becas'], goals: 'Banca digital' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [remote] })
    vi.stubGlobal('fetch', fetchMock)
    await service.synchronizeProfile()
    expect(service.loadProfile()?.name).toBe('Durable')
    expect(service.loadProfile()?.preferences).toEqual(['Becas'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not change the cached profile when the database rejects a save', async () => {
    const service = await session()
    service.saveProfile({ ...emptyProfile, id: 'alice', name: 'Previous' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(service.saveProfileRemote({ ...emptyProfile, id: 'alice', name: 'Unsaved' })).rejects.toThrow()
    expect(service.loadProfile()?.name).toBe('Previous')
  })

  it('migrates existing settings only when the server has no profile', async () => {
    const service = await session()
    const profile = { ...emptyProfile, id: 'alice', name: 'Migrated' }
    service.saveProfile(profile)
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => profile })
    vi.stubGlobal('fetch', fetchMock)
    await service.synchronizeProfile()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1].method).toBe('POST')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).completeOnboarding).toBeUndefined()
  })
})
