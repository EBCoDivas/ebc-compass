import type { ProactiveNotice } from '../../../../shared/contracts/proactive'
import { sessionSubject } from '../../services/session'

export function proactiveNoticeKey(notice: ProactiveNotice) { return `${sessionSubject() ?? 'anonymous'}:${notice.id}:${notice.createdAt}` }
export function proactiveNoticeSeen(notice: ProactiveNotice) {
  try { return sessionStorage.getItem('proactive-notice-seen:' + proactiveNoticeKey(notice)) === 'true' } catch { return false }
}
export function markProactiveNoticeSeen(notice: ProactiveNotice) {
  try { sessionStorage.setItem('proactive-notice-seen:' + proactiveNoticeKey(notice), 'true') } catch { /* El aviso sigue siendo utilizable sin almacenamiento de sesión. */ }
}

export function proactiveQuestion(notice: ProactiveNotice) {
  if (notice.context.topic === 'scholarship') return 'Quiero revisar mi beca de primer ingreso y lo que me falta para solicitarla.'
  return `Quiero revisar mi servicio social y opciones compatibles con mi horario${notice.context.opportunityId ? `, incluida la oportunidad ${notice.context.opportunityId}` : ''}.`
}

export function proactivePreview(notice: ProactiveNotice) {
  return notice.kind === 'social-service'
    ? 'Tu servicio social podría no alcanzar la meta antes de titulación.'
    : 'Hay algo importante en tus pendientes. Tu beca de primer ingreso todavía requiere atención.'
}
