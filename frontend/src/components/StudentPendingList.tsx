import { Link } from 'react-router-dom'
import type { StudentJourney, StudentPending } from '../../../shared/contracts/studentPlanning'
import { daysLabel, daysUntil, formatShortDate, urgencyFor } from '../utils/dates'
import { AskAssistantLink } from './assistant/AskAssistantLink'
import { StudentAchievements } from './StudentAchievements'

const stages = { entry: 'Nuevo ingreso', middle: 'Mitad de carrera', closing: 'Cierre de carrera' }
const statuses: Record<StudentPending['status'], string> = {
  pending: 'Pendiente', 'in-progress': 'En curso', 'in-review': 'En revisión', completed: 'Completado',
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** Horas de servicio social: barra con lo registrado, lo que alcanzarías a tu ritmo y la meta. */
function SocialServiceProgress({ planning }: { planning: StudentJourney }) {
  const service = planning.socialService
  const projection = planning.calculations.socialService
  if (!service || service.requiredHours <= 0) return null
  const percent = (hours: number) => Math.min(100, Math.round((hours / service.requiredHours) * 100))
  const done = percent(service.completedHours)
  const projected = projection ? percent(projection.projectedHours) : done
  return (
    <div className={`service-progress${projection && !projection.onTrack ? ' at-risk' : ''}`}>
      <div className="service-progress-head">
        <h3>Tu servicio social</h3>
        <p><strong>{service.completedHours}</strong> de {service.requiredHours} horas</p>
      </div>
      <div className="service-bar" role="img" aria-label={`${service.completedHours} de ${service.requiredHours} horas registradas${projection ? `; a tu ritmo llegarías a ${projection.projectedHours}` : ''}`}>
        <span className="service-bar-projected" style={{ width: `${projected}%` }} />
        <span className="service-bar-done" style={{ width: `${done}%` }} />
      </div>
      <p className="service-progress-note">
        Registradas al {formatShortDate(service.asOf)}, a un ritmo de {service.weeklyHours} horas por semana. Titulación: <time dateTime={service.graduationDeadline}>{formatShortDate(service.graduationDeadline)}</time>.
      </p>
      {projection && (projection.onTrack
        ? <p className="service-progress-verdict">Con tu ritmo actual alcanzas las horas a tiempo.</p>
        : <p className="service-progress-verdict">Con tu ritmo actual te faltarían <strong>{projection.shortfallHours} horas</strong> para la fecha de titulación.</p>)}
      {projection && !projection.onTrack && (
        <AskAssistantLink className="service-progress-action" question="¿Qué opciones de servicio social tengo para alcanzar mis horas a tiempo?">Ver opciones con Compass</AskAssistantLink>
      )}
    </div>
  )
}

export function StudentPendingList({ planning }: { planning: StudentJourney }) {
  const catalog = new Map(planning.catalog.map(item => [item.id, item]))
  const steps = planning.route.flatMap(pending => {
    const item = catalog.get(pending.opportunityId)
    return item ? [{ pending, item }] : []
  })
  const required = steps.filter(step => step.pending.required).length
  const optional = steps.length - required
  return <>
    <section className="home-section route" aria-labelledby="student-pending-title">
      <div className="section-heading">
        <h2 id="student-pending-title">Lo que te toca ahora</h2>
        {planning.stage && <span className="stage-pill">{stages[planning.stage]}</span>}
      </div>
      {steps.length === 0
        ? <p className="route-summary">Estás al día con tus pendientes.</p>
        : <p className="route-summary">Tienes <strong>{plural(required, 'obligatorio', 'obligatorios')}</strong>{optional > 0 && <> y {plural(optional, 'opcional', 'opcionales')}</>} por resolver, en orden de prioridad.</p>}
      <ol className="route-steps">
        {steps.map(({ pending, item }) => {
          const days = daysUntil(pending.dueDate)
          const urgency = pending.overdue || days < 0 ? 'overdue' : urgencyFor(days)
          return (
            <li className={`route-step is-${pending.status}${pending.required ? ' is-required' : ' is-optional'}`} key={pending.opportunityId}>
              <span className="route-marker" aria-hidden="true" />
              <div className="route-card">
                <div className="route-card-head">
                  <strong><Link to={`/catalogo?search=${encodeURIComponent(item.title)}`}>{item.title}</Link></strong>
                  <time className={`route-due ${urgency}`} dateTime={pending.dueDate}>
                    {pending.overdue ? 'Venció el ' : ''}{formatShortDate(pending.dueDate)}
                    {!pending.overdue && <span>{daysLabel(days)}</span>}
                  </time>
                </div>
                <small className="route-meta">
                  <span className={`route-tag${pending.required ? ' required' : ''}`}>{pending.required ? 'Obligatorio' : 'Opcional'}</span>
                  <span className="route-status">{statuses[pending.status]}</span>
                </small>
                <p className="route-next">{pending.nextStep}</p>
                {!pending.overdue && pending.status === 'pending' && item.id === 'scholarship-first-entry' && (
                  <AskAssistantLink className="service-progress-action" question="¿Me ayudas a solicitar la beca de primer ingreso?">Preparar con Compass</AskAssistantLink>
                )}
                {item.id === 'procedure-first-enrollment-payment' && (!pending.overdue || pending.status === 'in-progress') && (
                  <AskAssistantLink className="service-progress-action" question="Quiero pagar mi inscripción">Pagar con Compass</AskAssistantLink>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <SocialServiceProgress planning={planning} />
    </section>
    <StudentAchievements planning={planning} />
  </>
}
