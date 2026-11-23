import type { Opportunity } from '../../../shared/contracts/studentPlanning.js'
import { allCampuses, allCareers, allLevels } from './academic.js'

type DatedOpportunity = Opportunity & { deadline: string }
type Entry = Omit<DatedOpportunity, 'career' | 'campus' | 'level' | 'simulated'>

function shared(entry: Entry): DatedOpportunity {
  return { ...entry, career: allCareers, campus: allCampuses, level: allLevels, simulated: true }
}

function forCareer(career: string, campus: string, entry: Entry): DatedOpportunity {
  return { ...entry, career: [career], campus: [campus], level: ['licenciatura'], simulated: true }
}

export const stageCatalog = [
  shared({ id: 'event-induction', type: 'event', stage: 'entry', title: 'Inducción de nuevo ingreso',
    description: 'Conoce tu campus y activa tu acceso al portal escolar.', deadline: '2026-11-24' }),
  shared({ id: 'event-welcome', type: 'event', stage: 'entry', title: 'Charla de inicio de clases',
    description: 'Conoce los horarios y canales de apoyo de tu primer periodo.', deadline: '2026-11-27' }),
  shared({ id: 'scholarship-first-entry', type: 'scholarship', stage: 'entry', semester: [1], title: 'Beca de primer ingreso',
    description: 'Prepara tu solicitud de apoyo para el primer periodo.', deadline: '2026-11-26',
    requirements: ['Cursar el primer periodo', 'Presentar carta de admisión y una carta de motivos'],
    scholarshipCriteria: { minimumHighSchoolGpa: 8.5 } }),
  shared({ id: 'procedure-first-enrollment-payment', type: 'procedure', stage: 'entry', title: 'Pago de inscripción de nuevo ingreso',
    description: 'Consulta la tarifa de inscripción del primer periodo.', deadline: '2026-12-01',
    enrollmentFee: { amount: 4800, currency: 'MXN' } }),
  shared({ id: 'procedure-midterm-review', type: 'procedure', stage: 'middle', title: 'Revisión de créditos y optativas',
    description: 'Revisa con Servicios Escolares tus créditos y las optativas del siguiente periodo.', deadline: '2026-12-02' }),
  shared({ id: 'event-midterm-careers', type: 'event', stage: 'middle', title: 'Orientación para prácticas profesionales',
    description: 'Conoce cómo preparar tu primera postulación y dónde buscar prácticas.', deadline: '2026-12-09' }),
  shared({ id: 'procedure-closing-review', type: 'procedure', stage: 'closing', title: 'Revisión del expediente de egreso',
    description: 'Confirma las materias, créditos y documentos de tu expediente.', deadline: '2026-12-04' }),
  shared({ id: 'procedure-academic-dates', type: 'procedure', stage: 'all', title: 'Orientación de Servicios Escolares',
    description: 'Revisa las fechas de tu periodo y confirma los próximos pasos con Servicios Escolares.', deadline: '2026-12-16' }),
]

export const careerCatalog = [
  forCareer('accounting', 'QRO', { id: 'accounting-social-service', type: 'procedure', stage: 'closing', title: 'Liberación de servicio social de Contaduría',
    description: 'Valida tus horas de servicio social para cerrar tu expediente.', deadline: '2027-01-08',
    serviceHoursRequired: 480, requirements: ['Acumular 480 horas', 'Presentar bitácora firmada y carta de liberación'] }),
  forCareer('accounting', 'QRO', { id: 'accounting-graduation', type: 'procedure', stage: 'closing', title: 'Titulación de Contaduría',
    description: 'Prepara la revisión de tu expediente de titulación.', deadline: '2027-01-12',
    requirements: ['Cubrir el 100 % de los créditos', 'Liberar el servicio social', 'Entregar constancia de no adeudo', 'Acreditar el caso integrador contable'] }),
  forCareer('accounting', 'QRO', { id: 'accounting-service-community', type: 'professional-development', stage: 'closing', title: 'Servicio social en asesoría fiscal comunitaria',
    description: 'Orienta a una comunidad sobre sus registros fiscales.', deadline: '2026-11-24', location: 'Campus Querétaro',
    schedule: { days: ['Lunes', 'Miércoles', 'Viernes'], start: '15:00', end: '19:00' } }),
  forCareer('accounting', 'QRO', { id: 'accounting-service-budget', type: 'professional-development', stage: 'closing', title: 'Servicio social en educación financiera',
    description: 'Prepara talleres de presupuesto para una asociación.', deadline: '2026-11-26', location: 'En línea',
    schedule: { days: ['Martes', 'Jueves'], start: '16:00', end: '20:00' } }),
  forCareer('accounting', 'QRO', { id: 'accounting-service-records', type: 'professional-development', stage: 'closing', title: 'Servicio social en control de donativos',
    description: 'Lleva el registro contable de donativos de una asociación.', deadline: '2026-11-27', location: 'Campus Querétaro',
    schedule: { days: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'], start: '08:00', end: '12:00' } }),
  forCareer('accounting', 'QRO', { id: 'accounting-internship', type: 'career-opportunity', stage: 'closing', title: 'Prácticas de auditoría y control interno',
    description: 'Revisa expedientes de auditoría para una empresa.', deadline: '2026-12-15' }),
  forCareer('marketing', 'GDL', { id: 'marketing-internship', type: 'career-opportunity', stage: 'middle', title: 'Prácticas de estrategia de marca',
    description: 'Arma un tablero de métricas para una campaña.', deadline: '2026-11-28' }),
  forCareer('marketing', 'GDL', { id: 'marketing-event', type: 'event', stage: 'middle', title: 'Encuentro de marcas y audiencias',
    description: 'Presenta un concepto creativo y recibe comentarios de un panel.', deadline: '2026-11-25', location: 'Campus Guadalajara' }),
  forCareer('marketing', 'GDL', { id: 'marketing-social-service', type: 'procedure', stage: 'closing', title: 'Liberación de servicio social de Mercadotecnia',
    description: 'Integra la evidencia de tu proyecto de comunicación social.', deadline: '2027-01-08',
    serviceHoursRequired: 480, requirements: ['Acumular 480 horas', 'Entregar el informe de campaña y la carta de liberación'] }),
  forCareer('marketing', 'GDL', { id: 'marketing-graduation', type: 'procedure', stage: 'closing', title: 'Titulación de Mercadotecnia',
    description: 'Prepara tu expediente de egreso y presenta tu portafolio.', deadline: '2027-01-14',
    requirements: ['Cubrir el 100 % de los créditos', 'Liberar el servicio social', 'Presentar el portafolio de estrategia de marca'] }),
  forCareer('law', 'TLC', { id: 'law-social-service', type: 'procedure', stage: 'closing', title: 'Liberación de servicio social de Derecho',
    description: 'Entrega el informe de tu clínica jurídica y acredita las horas restantes.', deadline: '2026-11-25',
    serviceHoursRequired: 480, requirements: ['Acumular 480 horas', 'Entregar informe de la clínica jurídica y constancia de liberación'] }),
  forCareer('law', 'TLC', { id: 'law-graduation', type: 'procedure', stage: 'closing', title: 'Titulación de Derecho',
    description: 'Completa el expediente de titulación antes de que cierre la recepción.', deadline: '2026-11-27',
    requirements: ['Cubrir el 100 % de los créditos', 'Liberar el servicio social', 'Aprobar la evaluación del caso jurídico integrador'] }),
]
