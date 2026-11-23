import { Link } from 'react-router-dom'
import type { StudentPending, StudentPlanning } from '../../../shared/contracts/studentPlanning'
import { formatShortDate } from '../utils/dates'

const stages = { entry: 'Nuevo ingreso', middle: 'Mitad de carrera', closing: 'Cierre de carrera' }
const statuses: Record<StudentPending['status'], string> = {
  pending: 'Pendiente', 'in-progress': 'En curso', completed: 'Completado',
}

export function StudentPendingList({ planning }: { planning: StudentPlanning }) {
  const catalog = new Map(planning.catalog.map(item => [item.id, item]))
  const service = planning.socialService
  return (
    <section className="home-section" aria-labelledby="student-pending-title">
      <div className="section-heading">
        <h2 id="student-pending-title">Tus pendientes</h2>
        {planning.stage && <span>{stages[planning.stage]}</span>}
      </div>
      <ul className="saved-list">
        {planning.pending.map(pending => {
          const item = catalog.get(pending.opportunityId)
          if (!item) return null
          return (
            <li className="saved-item" key={pending.opportunityId}>
              <strong><Link to={`/catalogo?search=${encodeURIComponent(item.title)}`}>{item.title}</Link></strong>
              <small>{statuses[pending.status]} · <time dateTime={pending.dueDate}>{formatShortDate(pending.dueDate)}</time></small>
            </li>
          )
        })}
      </ul>
      {service && (
        <p>Servicio social al {formatShortDate(service.asOf)}: <strong>{service.completedHours} de {service.requiredHours} horas</strong> registradas, con un ritmo de {service.weeklyHours} horas por semana. Fecha de titulación: <time dateTime={service.graduationDeadline}>{formatShortDate(service.graduationDeadline)}</time>.</p>
      )}
    </section>
  )
}
