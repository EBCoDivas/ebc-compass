import { describe, expect, it } from 'vitest'
import type { ProactiveNotice } from '../../../../shared/contracts/proactive'
import { proactiveNoticeKey, proactivePreview, proactiveQuestion } from './proactiveNotice'

const notice: ProactiveNotice = { id: 'social-service-pace', kind: 'social-service', title: 'Servicio social',
  message: 'Detecté un riesgo.', priority: 'high', reason: 'Reglas', opportunityId: 'accounting-service-community', createdAt: '2026-11-22T12:00:00.000Z',
  context: { topic: 'social-service', opportunityId: 'accounting-service-community' } }

describe('proactive dock content', () => {
  it('keeps the seen key stable and opens chat with the notice context', () => {
    expect(proactiveNoticeKey(notice)).toMatch(/:social-service-pace:2026-11-22T12:00:00\.000Z$/)
    expect(proactiveQuestion(notice)).toContain('accounting-service-community')
    expect(proactivePreview(notice)).toMatch(/servicio social/)
  })
})
