import type { Intent, CareerId } from '../types.js'

// Léxico bilingüe (ES/EN) ya normalizado (sin acentos). Peso 3 = palabra decisiva, 2 = fuerte, 1 = pista débil.
// Las frases (varias palabras) se buscan sobre el texto normalizado completo.

export interface Cue {
  word: string
  weight: number
}

type Scored = Exclude<Intent, 'unknown'>

const words = (weight: number, list: string): Cue[] => list.split(/\s+/).filter(Boolean).map((word) => ({ word, weight }))

export const INTENT_WORDS: Record<Scored, Cue[]> = {
  'scholarship-info': [
    ...words(3, 'beca becas scholarship scholarships bursary'),
    ...words(2, 'becado grant grants financiamiento funding'),
    ...words(1, 'apoyo excelencia monto promedio'),
  ],
  'course-info': [
    ...words(3, 'curso cursos materia materias asignatura asignaturas course courses prerrequisito prerrequisitos prerequisite prerequisites'),
    ...words(2, 'subject subjects class classes seriacion creditos credits'),
  ],
  'procedure-info': [
    ...words(3, 'tramite tramites reinscripcion reinscribo reinscribirme inscripcion inscribo inscribirme procedure procedures enroll enrollment reenroll reenrollment registration'),
    ...words(2, 'register solicitud solicito solicitar apply documentos documents pasos steps constancia'),
    ...words(1, 'oficina office'),
  ],
  'event-info': [
    ...words(3, 'evento eventos foro feria conferencia conferencias networking event events forum fair conference'),
    ...words(2, 'taller talleres workshop workshops'),
    ...words(1, 'fintech vinculacion'),
  ],
  'career-info': [
    ...words(3, 'certificacion certificaciones certification certifications diplomado diplomados practicas internship internships empleo vacante vacantes bolsa becario empleabilidad'),
    ...words(2, 'bloomberg amib trabajo job jobs analista profesional professional reclutadores recruiters'),
    ...words(1, 'carrera career'),
  ],
  'recommendation-request': [
    ...words(3, 'recomienda recomiendas recomendacion recomendaciones recomendar recommend recommendation recommendations'),
    ...words(2, 'sugiere sugieres sugerencia sugerencias suggest suggestions conviene'),
    ...words(1, 'oportunidades opportunities siguiente next'),
  ],
  'deadline-query': [
    ...words(3, 'fecha fechas vence vencen vencimiento calendario deadline deadlines calendar upcoming dates'),
    ...words(2, 'limite proxima proximas proximo proximos due date'),
    ...words(1, 'pendiente pendientes cuando when'),
  ],
  'profile-help': [
    ...words(3, 'perfil profile completitud completeness'),
    ...words(2, 'missing'),
    ...words(1, 'completar complete falta faltan'),
  ],
  greeting: [...words(3, 'hola buenas hi hello hey saludos'), ...words(2, 'gracias thanks')],
  help: [...words(3, 'ayuda help'), ...words(2, 'ayudar funciones capabilities')],
}

export const INTENT_PHRASES: Record<Scored, Cue[]> = {
  'scholarship-info': [],
  'course-info': [],
  'procedure-info': [{ word: 'como me inscribo', weight: 3 }, { word: 'how do i enroll', weight: 3 }],
  'event-info': [],
  'career-info': [{ word: 'primer empleo', weight: 4 }, { word: 'first job', weight: 4 }, { word: 'practicas profesionales', weight: 4 }],
  'recommendation-request': [
    { word: 'que me recomiendas', weight: 4 },
    { word: 'que me conviene', weight: 4 },
    { word: 'que deberia', weight: 3 },
    { word: 'what should i', weight: 4 },
    { word: 'what do you recommend', weight: 4 },
    { word: 'que opciones', weight: 3 },
  ],
  'deadline-query': [
    { word: 'que fechas', weight: 4 },
    { word: 'que vence', weight: 4 },
    { word: 'que vencen', weight: 4 },
    { word: 'fecha limite', weight: 4 },
    { word: 'what is due', weight: 4 },
  ],
  'profile-help': [{ word: 'mi perfil', weight: 3 }, { word: 'my profile', weight: 3 }],
  greeting: [
    { word: 'buenos dias', weight: 4 },
    { word: 'buenas tardes', weight: 4 },
    { word: 'buenas noches', weight: 4 },
    { word: 'good morning', weight: 4 },
  ],
  help: [
    { word: 'que puedes hacer', weight: 5 },
    { word: 'que haces', weight: 4 },
    { word: 'what can you do', weight: 5 },
    { word: 'como funcionas', weight: 4 },
    { word: 'como me ayudas', weight: 4 },
    { word: 'how can you help', weight: 5 },
  ],
}

/** Palabras que señalan sobre qué faceta pregunta el seguimiento ("¿y la fecha límite?"). */
export const FOCUS_DEADLINE = ['fecha', 'fechas', 'limite', 'vence', 'vencen', 'cuando', 'deadline', 'when', 'due', 'plazo']
export const FOCUS_REQUIREMENTS = [
  'requisitos', 'requisito', 'requirements', 'requirement', 'prerrequisitos', 'prerrequisito', 'prerequisites', 'documentos', 'documents', 'pasos', 'steps',
]

/** Intents que admiten seguimiento ("¿y los requisitos?") heredando el tema anterior. */
export const FOLLOW_UP_INTENTS: Intent[] = ['scholarship-info', 'course-info', 'procedure-info', 'event-info', 'career-info']

export const CAREER_WORDS: Record<string, CareerId> = {
  contaduria: 'accounting', contabilidad: 'accounting', accounting: 'accounting', derecho: 'law', law: 'law',
  turismo: 'tourism', tourism: 'tourism', programacion: 'digital-transformation',
  banca: 'banking', banking: 'banking', bancaria: 'banking', bancario: 'banking',
  finanzas: 'finance', finance: 'finance', financiera: 'finance', financieras: 'finance',
  marketing: 'marketing', mercadotecnia: 'marketing',
  administracion: 'business-administration', administration: 'business-administration', negocios: 'business-administration', business: 'business-administration',
}

export const CAREER_PHRASES: Record<string, CareerId> = {
  'comercio y negocios internacionales': 'international-business',
  'negocios internacionales': 'international-business',
  'international business': 'international-business',
  'negocios turisticos': 'tourism',
  'turismo y hospitalidad': 'tourism',
  'comunicacion y el entretenimiento': 'communication-entertainment',
  'comunicacion y entretenimiento': 'communication-entertainment',
  'direccion financiera': 'financial-management',
  'alta direccion': 'senior-management',
  'especialidad en impuestos': 'tax-specialty',
  'programacion y transformacion digital': 'digital-transformation',
  'transformacion digital': 'digital-transformation',
  'administracion y comercializacion': 'executive-administration',
  'contabilidad y finanzas': 'executive-accounting',
  'ejecutiva en negocios': 'executive-business',
  'finanzas y banca': 'finance',
}
