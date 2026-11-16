const opportunities = [
  { id: 'course-fin-301', type: 'course', title: 'Mercados financieros', description: 'Fortalece tus bases para analizar mercados e inversiones.' },
  { id: 'course-data', type: 'course', title: 'Análisis de datos para negocios', description: 'Herramientas para convertir datos en decisiones.' },
  { id: 'course-marketing', type: 'course', title: 'Marketing digital', description: 'Diseña campañas digitales con métricas de negocio.' },
  { id: 'scholarship-ebc', type: 'scholarship', title: 'Beca Fundación EBC', description: 'Apoyo para estudiantes con desempeño destacado.', deadline: '2026-12-15' },
  { id: 'scholarship-santander', type: 'scholarship', title: 'Beca Santander Excelencia', description: 'Convocatoria para estudiantes con alto promedio.', deadline: '2026-11-30' },
  { id: 'event-fintech', type: 'event', title: 'Foro Fintech EBC', description: 'Conversación con especialistas del ecosistema financiero.', deadline: '2026-11-25' },
  { id: 'event-networking', type: 'event', title: 'Networking empresarial', description: 'Conoce empresas y oportunidades profesionales.', deadline: '2026-12-05' },
  { id: 'procedure-enrollment', type: 'procedure', title: 'Reinscripción al siguiente periodo', description: 'Consulta requisitos y fechas para continuar tus estudios.', deadline: '2026-12-20' },
  { id: 'procedure-scholarship', type: 'procedure', title: 'Solicitud de beca', description: 'Prepara tus documentos y registra tu solicitud.', deadline: '2026-11-28' },
  { id: 'course-fintech', type: 'course', title: 'Introducción a fintech', description: 'Conoce modelos digitales para servicios financieros.' },
  { id: 'course-entrepreneurship', type: 'course', title: 'Emprendimiento', description: 'Convierte una idea de negocio en un proyecto viable.' },
  { id: 'scholarship-merit', type: 'scholarship', title: 'Beca al mérito académico', description: 'Reconocimiento para estudiantes con desempeño sobresaliente.', deadline: '2026-12-10' },
  { id: 'development-amib', type: 'professional-development', title: 'Certificación AMIB', description: 'Prepárate para una certificación relevante del sector financiero.', deadline: '2027-01-20' },
  { id: 'development-bloomberg', type: 'professional-development', title: 'Bloomberg Market Concepts', description: 'Curso práctico sobre mercados y herramientas financieras.', deadline: '2026-12-18' },
  { id: 'event-career', type: 'event', title: 'Feria de empleabilidad EBC', description: 'Conecta con reclutadores y conoce vacantes para estudiantes.', deadline: '2027-01-15' },
  { id: 'event-marketing', type: 'event', title: 'Taller de estrategia digital', description: 'Sesión práctica con especialistas en comunicación digital.', deadline: '2026-12-08' },
  { id: 'procedure-transcript', type: 'procedure', title: 'Solicitud de constancia', description: 'Solicita una constancia de estudios para tus trámites.' },
  { id: 'career-internship', type: 'career-opportunity', title: 'Prácticas profesionales en banca', description: 'Programa de prácticas para estudiantes de últimos semestres.', deadline: '2027-01-30' },
  { id: 'career-marketing', type: 'career-opportunity', title: 'Becario de marketing digital', description: 'Vacante de medio tiempo para apoyar campañas digitales.', deadline: '2026-12-22' },
  { id: 'career-finance', type: 'career-opportunity', title: 'Analista financiero junior', description: 'Oportunidad inicial para estudiantes de finanzas.', deadline: '2027-02-05' },
];

export async function handler() {
  return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(opportunities) };
}
