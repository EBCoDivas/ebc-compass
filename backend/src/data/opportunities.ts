export type OpportunityType = 'course' | 'scholarship' | 'event' | 'procedure'

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
]
