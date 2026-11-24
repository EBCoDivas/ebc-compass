import { personalContextQuery } from './personalContext.js'
import type { InputBlock, Language } from '../types.js'
import { classifyIntent } from './intent.js'
import { isStudentFollowUp, studentTopic } from './studentIntent.js'
import { normalize } from './text.js'

/** Reglas conservadoras y reproducibles para la demo; no reemplazan la evaluación nativa del lab. */
export function assessInput(text: string): InputBlock | undefined {
  const value = normalize(text)
  const block = (category: InputBlock['category']): InputBlock => ({ category, source: 'local' })
  if (/(ignora|olvida|omite|desobedece|ignore|forget|disregard|override).{0,60}(instrucciones|reglas|prompt|instructions|rules|system)/.test(value)
    || /(revela|muestra|imprime|repite|reveal|show|print|repeat).{0,50}(prompt|instrucciones del sistema|system instructions|secret|api.?key)/.test(value)
    || /\b(jailbreak|developer mode|modo desarrollador)\b|<\/?(?:system|assistant)>|\[inst\]/i.test(text)) return block('prompt-injection')
  if (/(datos|expediente|calificaciones|telefono|correo|contrasena|grades|records|password|phone|email).{0,60}(otro|otra|companero|companera|other|classmate)|(?:otro|otra|companero|companera|other|classmate).{0,60}(datos|expediente|calificaciones|telefono|correo|grades|records|password|phone|email)/.test(value)) return block('other-person-data')
  const protective = /\b(reportar|reporto|denunciar|denuncio|prevenir|proteger|report|protect|prevent)\b/.test(value)
  if ((!protective && /(como|ayuda|quiero|instrucciones|how|help|want).{0,60}(fabricar.{0,15}bomba|matar|lastimar|acosar|hackear|robar|falsificar|build.{0,15}bomb|kill|hurt|harass|hack|steal|forge)/.test(value))
    || /\b(idiota|imbecil|estupido|pendejo|idiot|moron)\b/.test(value)) return block('harmful-content')
  if (/\b(receta|recetas|recipe|recipes|horoscopo|horoscope|futbol|soccer|football|celebridad|celebrity|presidente|president)\b|capital de (?:francia|italia)|capital of (?:france|italy)|clima de hoy|weather today/.test(value)) return block('out-of-scope')
  const wellbeing = /\b(me siento (?:mal|triste|ansios\w*|abrumad\w*|sol[oa]|perdid\w*|agobiad\w*)|no puedo m[aá]s|no aguanto|estres\w*|ansiedad|deprim\w*|me duele\w*|dolor|enferm\w*|burnt?\s*out|i feel (?:bad|sad|anxious|overwhelmed|lost|hopeless)|stress\w*|anxiety|depress\w*|i am sick|overwhelmed)\b/.test(value)
  if (wellbeing) return block('wellbeing')
  const intent = classifyIntent(value, { hasCourseCode: /\b[a-z]{2,5}-\d{3}\b/i.test(value), entityTypes: [] }).intent
  const relevant = /\b(correo institucional|institutional email|student email|servicios escolares|school services|school hours|opportunities|oportunidad|oportunidades|account|cuenta|ebc|bea|fit|campus|modalidad|modalidades|programa|programas|academico|academicos|academic|degree|reinscribir|reinscripcion|reinscribirme|enroll|re-enroll|servicio social|social service|titulacion|cedula|finanzas|banca|fintech|contabilidad|derecho|marketing|emprendimiento|practicas|internship|certificacion|induccion|nuevo ingreso|primer ingreso|inicio de clases|bienvenida|orientacion|creditos|optativas|inscripcion|taller|talleres|evento|eventos|beca|becas|encuentro|charla|marcas|audiencias|expediente|egreso|horas|carrera|carreras|falta|falte|faltan|pendiente|pendientes|ambas|ambos|cita|control escolar|plan de estudios?|pago|pagos|pagar|microcredencial(?:es)?|curso|cursos|horario|requisitos?|tramites?|constancias?|credencial|documentos?|materias|calendario|fechas?|recuerd\w*|record\w*|payments?|courses?|requirements?|certificates?)\b/.test(value)
  const conversational = /^(hola|hello|hi|gracias|thanks|thank you|adios|bye|si|yes|no|ok|vale|y la fecha|y los requisitos|cuando|when|por que|why|cuanto cuesta|how much|puedes explicarlo|tell me more|continua|continue|y en ingles|y en espanol|in english|in spanish|donde|where)(?: por favor| please)?$/.test(value)
  const preference = /^(yo )?(mi meta|mi objetivo|mis intereses|me interesa|solo puedo|mi disponibilidad|prefiero|mi idioma|recuerda que|no olvides que|my goal|my interests|i am interested|i am available|i can only|i prefer|remember that)\b/.test(value)
  if (intent === 'unknown' && !personalContextQuery(text) && !studentTopic(text) && !isStudentFollowUp(text) && !relevant && !conversational && !preference) return block('out-of-scope')
  return undefined
}

export function inputBlockMessage(block: InputBlock, language: Language): string {
  const reasons: Record<InputBlock['category'], [string, string]> = {
    'prompt-injection': ['No puedo cambiar mis instrucciones ni revelar información interna.', 'I cannot change my instructions or reveal internal information.'],
    'other-person-data': ['No puedo proporcionar datos de otras personas.', 'I cannot provide other people’s data.'],
    'harmful-content': ['No puedo ayudar con solicitudes dañinas o abusivas.', 'I cannot help with harmful or abusive requests.'],
    'wellbeing': ['Lamento que estés pasando por eso. No puedo darte orientación de salud ni emocional, pero la EBC cuenta con una red de apoyo estudiantil a la que puedes unirte por WhatsApp: https://chat.whatsapp.com/LWEnbCVpbXMA6VjqsUJQjF — también puedes acercarte a Servicios Escolares o a tu tutor para que te canalicen.', 'I am sorry you are going through that. I cannot give health or emotional guidance, but EBC has a student support network you can join on WhatsApp: https://chat.whatsapp.com/LWEnbCVpbXMA6VjqsUJQjF — you can also reach out to School Services or your tutor.'],
    'out-of-scope': ['Esa consulta está fuera de mi alcance.', 'That question is outside my scope.'],
    'guardrail-unavailable': ['No pude comprobar tu solicitud. Intenta de nuevo en un momento.', 'I could not check your request. Please try again shortly.'],
  }
  return reasons[block.category][language === 'es' ? 0 : 1] + (language === 'es'
    ? ' Puedo orientarte sobre becas, cursos, trámites, eventos y desarrollo profesional en EBC.'
    : ' I can help with scholarships, courses, procedures, events and career guidance at EBC.')
}
