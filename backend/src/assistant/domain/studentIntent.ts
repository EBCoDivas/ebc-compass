import type { BannerActionKind } from '../../../../shared/contracts/studentActions.js'
import { normalize } from './text.js'

export const studentTopic = (value: string) => {
  const text = normalize(value)
  if (/\b(beca|scholarship)\b/.test(text) && /\b(primer ingreso|nuevo ingreso|primera|first entry|first year|first semester|incoming)\b/.test(text)) return 'request-scholarship'
  if (/\b(inscripcion|enrollment|matricula|tuition)\b/.test(text) && /\b(pag\w*|ficha|comprobante|recibo|tarifa|cuesta|importe|cost\w*|pay\w*|receipt|fee|how much)\b/.test(text)) return 'pay-enrollment'
  if (/\b(servicio social|social service)\b/.test(text) && /\b(mi|my|horas|hours|ritmo|tarda\w*|alcanza\w*|proyeccion|opciones|titul\w*|trabajo|horario|complet\w*|puedo|finish|deadline|options|schedule)\b/.test(text)) return 'social-service'
  if (/\b(avance academico|mis materias|mis creditos|mis calificaciones|mi promedio|academic progress|my credits|my grades|my gpa)\b/.test(text)) return 'progress'
  if (/\b(mi ruta|mis pendientes|que (?:tengo|me falta) pendiente|que (?:hago|me toca|me queda|sigue)|my route|my next steps|what should i do next)\b/.test(text)) return 'route'
}

export function isActionFollowUp(text: string) {
  return /^(?:si |yes |por favor |please )?(?:prepara\w*|solicita\w*|genera\w*|tramita\w*|paga\w*|hazlo|adelante|prepare (?:it|the application)|apply|go ahead)(?: por favor| please)?$/.test(normalize(text))
}

export function isStudentFollowUp(text: string) {
  return isActionFollowUp(text) || /^(?:y |and )?(?:la fecha(?: limite)?|los requisitos|que me falta|cuanto cuesta|cual es el importe|what is the deadline|how much|what am i missing)$/.test(normalize(text))
}

export function asksToPrepare(text: string, kind: BannerActionKind) {
  const value = normalize(text)
  if (/\b(?:no|not|don t|dont) (?:la |lo |me )?(?:quiero |want to |puedes )?(?:prepar|solicit|gener|envi|tram|pag|hagas|apply|submit|generate|prepare|pay)\w*/.test(value)) return false
  if (isActionFollowUp(text)) return true
  return kind === 'request-scholarship'
    ? /\b(solicit\w*|prepar\w*|postul\w*|tramit\w*|apply|submit|send)\b/.test(value) && !/\b(requisitos|que necesito|documentos|requirements|what do i need)\b/.test(value)
    : /\b(prepar\w*|pagalo|pagala|paga|pagar|pagues|como pago|pay|payment)\b/.test(value) && !/\b(comprobante|recibo|receipt|cuanto|how much)\b/.test(value)
}
