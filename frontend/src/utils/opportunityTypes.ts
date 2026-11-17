import type { OpportunityType } from '../services/opportunityService'

export const typeMeta: Record<OpportunityType, { label: string; plural: string; icon: string; dateLabel: string }> = {
  course: { label: 'Curso', plural: 'Cursos', icon: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H12v15H5.5A1.5 1.5 0 0 0 4 20.5v-15ZM20 5.5A1.5 1.5 0 0 0 18.5 4H12v15h6.5a1.5 1.5 0 0 1 1.5 1.5v-15Z', dateLabel: 'Fecha límite' },
  scholarship: { label: 'Beca', plural: 'Becas', icon: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z', dateLabel: 'Fecha límite' },
  event: { label: 'Evento', plural: 'Eventos', icon: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM3 10h18M8 3v4M16 3v4', dateLabel: 'Fecha' },
  procedure: { label: 'Trámite', plural: 'Trámites', icon: 'M7 3h7l5 5v13H7V3ZM14 3v5h5M10 13h6M10 17h6', dateLabel: 'Fecha límite' },
  'professional-development': { label: 'Desarrollo profesional', plural: 'Desarrollo profesional', icon: 'M4 17l5-5 4 4 7-8M15 8h5v5', dateLabel: 'Fecha límite' },
  'career-opportunity': { label: 'Oportunidad laboral', plural: 'Oportunidades laborales', icon: 'M4 8h16v11H4V8ZM9 8V5h6v3M4 13h16', dateLabel: 'Fecha límite' },
}

export function dateLabelFor(type: OpportunityType): string {
  return typeMeta[type].dateLabel
}
