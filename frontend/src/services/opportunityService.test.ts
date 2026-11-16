import { describe, expect, it, vi } from 'vitest'
import { fetchRecommendations } from './opportunityService'

describe('fetchRecommendations', () => {
  it('sends profile criteria to the recommendations API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)
    await fetchRecommendations({ career: 'finance', currentSemester: 5, interests: ['Finanzas'] })
    expect(fetchMock).toHaveBeenCalled()
    expect(fetchMock.mock.calls[0][0]).toContain('career=finance')
    vi.unstubAllGlobals()
  })
})
