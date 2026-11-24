import type { ProactiveCandidate, ProactiveContext } from './types.js'

const afternoons = (start: string) => start >= '12:00'

export function proactiveCandidates({ journey, memory, catalog, today }: ProactiveContext): ProactiveCandidate[] {
  const candidates: ProactiveCandidate[] = []
  const scholarship = journey.catalog.find(item => item.id === 'scholarship-first-entry')
  const scholarshipPending = journey.pending.find(item => item.opportunityId === scholarship?.id && item.status === 'pending')
  const eligibility = journey.calculations.scholarship
  if (journey.stage === 'entry' && scholarship && scholarshipPending && scholarship.deadline && scholarship.deadline >= today && eligibility?.status === 'eligible') {
    const missing = eligibility.missingDocuments.includes('motivation-letter') ? 'Todavía necesitas completar tu carta de motivos.'
      : eligibility.missingDocuments.length ? 'Todavía necesitas completar documentación de tu expediente.' : 'Ya puedes revisar los requisitos para enviar tu solicitud.'
    candidates.push({ id: 'scholarship-first-entry', kind: 'scholarship', title: 'Tu beca de primer ingreso',
      message: `Revisé tus pendientes: cumples con los criterios principales y la fecha se acerca. ${missing}`, priority: 'high', reason: 'Hay una beca vigente y pendiente de primer ingreso.',
      opportunityId: scholarship.id, context: { topic: 'scholarship', opportunityId: scholarship.id } })
  }

  const projection = journey.calculations.socialService
  if (journey.stage === 'closing' && projection && !projection.onTrack && projection.shortfallHours > 0) {
    const worksAfternoons = memory.some(item => item.key === 'workSchedule' && item.value === 'works-afternoons')
    const options = catalog.filter(item => item.schedule && (!worksAfternoons || afternoons(item.schedule.start)))
    const option = options[0]
    candidates.push({ id: 'social-service-pace', kind: 'social-service', title: 'Servicio social',
      message: `Detecté que a tu ritmo actual podrías no completar tus horas antes de titulación.${option ? ` Encontré ${option.title}, una opción vigente${worksAfternoons ? ' por la tarde' : ''}.` : ''}`,
      priority: 'high', reason: 'La proyección oficial indica que las horas no alcanzan para la fecha prevista.',
      ...(option ? { opportunityId: option.id } : {}), context: { topic: 'social-service', ...(option ? { opportunityId: option.id } : {}) } })
  }
  return candidates.slice(0, 3)
}
