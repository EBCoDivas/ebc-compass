export type OpportunityType = 'course' | 'scholarship' | 'professional-development' | 'event' | 'procedure' | 'career-opportunity'

export interface Opportunity {
  id: string
  type: OpportunityType
  title: string
  description: string
  career: string[]
  semester?: number[]
  deadline?: string
  location?: string
}

export const opportunities: Opportunity[] = [
  { id: 'course-fin-301', type: 'course', title: 'Mercados financieros', description: 'Fortalece tus bases para analizar mercados e inversiones.', career: ['finance', 'banking'], semester: [3, 4, 5] },
  { id: 'course-data', type: 'course', title: 'Análisis de datos para negocios', description: 'Herramientas para convertir datos en decisiones.', career: ['finance', 'marketing', 'business-administration'], semester: [4, 5, 6] },
  { id: 'course-marketing', type: 'course', title: 'Marketing digital', description: 'Diseña campañas digitales con métricas de negocio.', career: ['marketing'], semester: [2, 3, 4] },
  { id: 'scholarship-ebc', type: 'scholarship', title: 'Beca Fundación EBC', description: 'Apoyo para estudiantes con desempeño destacado.', career: ['banking', 'finance', 'marketing', 'business-administration'], deadline: '2026-12-15' },
  { id: 'scholarship-santander', type: 'scholarship', title: 'Beca Santander Excelencia', description: 'Convocatoria para estudiantes con alto promedio.', career: ['finance', 'banking'], deadline: '2026-11-30' },
  { id: 'event-fintech', type: 'event', title: 'Foro Fintech EBC', description: 'Conversación con especialistas del ecosistema financiero.', career: ['finance', 'banking'], deadline: '2026-11-25', location: 'Campus Ciudad de México' },
  { id: 'event-networking', type: 'event', title: 'Networking empresarial', description: 'Conoce empresas y oportunidades profesionales.', career: ['marketing', 'business-administration'], deadline: '2026-12-05', location: 'Campus Guadalajara' },
  { id: 'procedure-enrollment', type: 'procedure', title: 'Reinscripción al siguiente periodo', description: 'Consulta requisitos y fechas para continuar tus estudios.', career: ['banking', 'finance', 'marketing', 'business-administration'], deadline: '2026-12-20' },
  { id: 'procedure-scholarship', type: 'procedure', title: 'Solicitud de beca', description: 'Prepara tus documentos y registra tu solicitud.', career: ['banking', 'finance', 'marketing', 'business-administration'], deadline: '2026-11-28' },
  { id: 'course-fintech', type: 'course', title: 'Introducción a fintech', description: 'Conoce modelos digitales para servicios financieros.', career: ['finance', 'banking'], semester: [1, 2, 3] },
  { id: 'course-entrepreneurship', type: 'course', title: 'Emprendimiento', description: 'Convierte una idea de negocio en un proyecto viable.', career: ['business-administration', 'marketing'], semester: [5, 6, 7] },
  { id: 'scholarship-merit', type: 'scholarship', title: 'Beca al mérito académico', description: 'Reconocimiento para estudiantes con desempeño sobresaliente.', career: ['banking', 'finance', 'marketing', 'business-administration'], deadline: '2026-12-10' },
  { id: 'development-amib', type: 'professional-development', title: 'Certificación AMIB', description: 'Prepárate para una certificación relevante del sector financiero.', career: ['finance', 'banking'], deadline: '2027-01-20' },
  { id: 'development-bloomberg', type: 'professional-development', title: 'Bloomberg Market Concepts', description: 'Curso práctico sobre mercados y herramientas financieras.', career: ['finance'], deadline: '2026-12-18' },
  { id: 'event-career', type: 'event', title: 'Feria de empleabilidad EBC', description: 'Conecta con reclutadores y conoce vacantes para estudiantes.', career: ['banking', 'finance', 'marketing', 'business-administration'], deadline: '2027-01-15', location: 'Campus Ciudad de México' },
  { id: 'event-marketing', type: 'event', title: 'Taller de estrategia digital', description: 'Sesión práctica con especialistas en comunicación digital.', career: ['marketing'], deadline: '2026-12-08', location: 'Campus Guadalajara' },
  { id: 'procedure-transcript', type: 'procedure', title: 'Solicitud de constancia', description: 'Solicita una constancia de estudios para tus trámites.', career: ['banking', 'finance', 'marketing', 'business-administration'] },
  { id: 'career-internship', type: 'career-opportunity', title: 'Prácticas profesionales en banca', description: 'Programa de prácticas para estudiantes de últimos semestres.', career: ['banking', 'finance'], semester: [7, 8, 9, 10], deadline: '2027-01-30' },
  { id: 'career-marketing', type: 'career-opportunity', title: 'Becario de marketing digital', description: 'Vacante de medio tiempo para apoyar campañas digitales.', career: ['marketing'], semester: [5, 6, 7, 8, 9, 10], deadline: '2026-12-22' },
  { id: 'career-finance', type: 'career-opportunity', title: 'Analista financiero junior', description: 'Oportunidad inicial para estudiantes de finanzas.', career: ['finance', 'business-administration'], semester: [7, 8, 9, 10], deadline: '2027-02-05' },
]
