import type {
  StudentAchievement, StudentJourney, StudentPending, StudentPlanning, StudentRouteItem, StudentStage,
} from '../../../shared/contracts/studentPlanning.js'
import type { ConfirmedStudentActions } from './confirmedActions.js'
import { evaluateScholarship, planningDate, projectSocialService, quoteEnrollmentPayment } from './rules.js'

const scholarshipId = 'scholarship-first-entry'
const paymentId = 'procedure-first-enrollment-payment'
const routeLimits: Record<StudentStage | 'general', number> = { entry: 4, middle: 3, closing: 3, general: 1 }
const requiredIds = new Set([
  'event-induction', paymentId, 'procedure-midterm-review', 'procedure-closing-review',
  'accounting-social-service', 'accounting-graduation',
  'marketing-social-service', 'marketing-graduation', 'law-social-service', 'law-graduation',
])
const documentNames = { 'admission-letter': 'carta de admisión', 'motivation-letter': 'carta de motivos' }

function nextStep(
  item: StudentPending, description: string, calculations: StudentJourney['calculations'], actions: ConfirmedStudentActions,
): string {
  const { scholarship, enrollmentPayment } = calculations
  if (item.opportunityId === scholarshipId && scholarship) {
    if (actions.scholarshipInReview) return 'Consulta el estado de tu solicitud con Servicios Escolares.'
    if (scholarship.status === 'closed') return 'Consulta con Servicios Escolares si hay otra convocatoria disponible.'
    if (scholarship.status === 'missing-data') return 'Completa los datos de tu expediente con Servicios Escolares.'
    if (scholarship.status === 'not-eligible') return 'Consulta otras opciones de apoyo con Servicios Escolares.'
    if (scholarship.missingDocuments.length) return 'Prepara la documentación que falta: ' + scholarship.missingDocuments.map(key => documentNames[key]).join(' y ') + '.'
    return 'Revisa los requisitos y prepara tu solicitud.'
  }
  if (item.opportunityId === paymentId && enrollmentPayment) {
    if (!enrollmentPayment.canGenerate) return 'Consulta con Servicios Escolares cómo continuar tu inscripción.'
    if (actions.enrollmentPaymentGenerated) return 'Consulta la ficha que generaste y revisa su fecha límite.'
    return 'Revisa el monto y solicita tu ficha de pago.'
  }
  return description
}

export function buildStudentJourney(
  planning: StudentPlanning, subject: string, actions: ConfirmedStudentActions, today = planningDate(),
): StudentJourney {
  const catalog = new Map(planning.catalog.map(item => [item.id, item]))
  const calculations: StudentJourney['calculations'] = {
    scholarship: evaluateScholarship(catalog.get(scholarshipId), planning.firstEntry, today),
    enrollmentPayment: quoteEnrollmentPayment(subject, catalog.get(paymentId), today, actions.scholarshipInReview),
    socialService: planning.socialService && projectSocialService(planning.socialService, today),
  }
  const pending = planning.pending.map(item => {
    if (item.status === 'completed') return item
    if (item.opportunityId === scholarshipId && actions.scholarshipInReview) return { ...item, status: 'in-review' as const }
    if (item.opportunityId === paymentId && actions.enrollmentPaymentGenerated) return { ...item, status: 'in-progress' as const }
    return item
  })
  const items = pending.flatMap((item): StudentRouteItem[] => {
    const opportunity = catalog.get(item.opportunityId)
    if (!opportunity || item.status === 'completed') return []
    const required = requiredIds.has(item.opportunityId)
    const overdue = item.dueDate < today && item.status !== 'in-review'
    return [{ ...item, required, overdue, nextStep: nextStep(item, opportunity.description, calculations, actions) }]
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.opportunityId.localeCompare(b.opportunityId))
  const required = items.filter(item => item.required)
  const optional = items.filter(item => !item.required)
  const remaining = Math.max(0, routeLimits[planning.stage ?? 'general'] - required.length)

  // Primero el historial de etapas anteriores, en orden; luego los logros de la etapa actual que no estén ya ganados.
  const achievements: StudentAchievement[] = [...(planning.achievementHistory ?? [])]
    .sort((a, b) => a.earnedAt.localeCompare(b.earnedAt))
    .map(item => ({ id: item.id, earned: true, earnedAt: item.earnedAt }))
  const inHistory = new Set(achievements.map(item => item.id))
  const add = (item: StudentAchievement) => { if (!inHistory.has(item.id)) achievements.push(item) }
  if (calculations.scholarship || actions.scholarshipInReview) {
    add({ id: 'scholarship-requested', earned: actions.scholarshipInReview })
  }
  if (calculations.enrollmentPayment || actions.enrollmentPaymentGenerated) {
    add({ id: 'payment-slip-generated', earned: actions.enrollmentPaymentGenerated })
  }
  if (planning.socialService) {
    const { completedHours, requiredHours } = planning.socialService
    add({ id: 'social-service-progress', earned: requiredHours > 0 && completedHours * 2 >= requiredHours })
  }

  return { ...planning, pending, route: [...required, ...optional.slice(0, remaining)], achievements, calculations }
}
