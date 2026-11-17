import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAcademicProgress } from './academicProgressService'

afterEach(() => { vi.unstubAllGlobals() })

describe('fetchAcademicProgress', () => {
  it('uses the signed-in session and returns the shared progress shape', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ progress: {
      studentId: 'student-1', source: 'demo', asOf: '2026-11-16',
      program: { id: 'finance', name: 'Finanzas y Banca' }, campus: { id: 'CDMX', name: 'Ciudad de México' },
      currentPeriod: { number: 2, type: 'semestre' }, courses: { completed: 6, total: 54 }, credits: { earned: 36, total: 324 },
    } }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    const progress = await fetchAcademicProgress()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/academic-progress'), expect.any(Object))
    expect(progress?.courses).toEqual({ completed: 6, total: 54 })
  })

  it('preserves absent academic fields and handles a student without a snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ progress: null }), { status: 200 })))
    expect(await fetchAcademicProgress()).toBeNull()
  })
})
