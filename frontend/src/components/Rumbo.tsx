import { Link } from 'react-router-dom'
import type { Opportunity } from '../services/opportunityService'
import { AskAssistantLink } from './assistant/AskAssistantLink'
import { daysLabel, daysUntil, urgencyFor } from '../utils/dates'
import { typeMeta } from '../utils/opportunityTypes'

const monthFormat = new Intl.DateTimeFormat('es-MX', { month: 'short' })

function dayAndMonth(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return { day, month: monthFormat.format(new Date(year, month - 1, day)).replace('.', '') }
}

/**
 * El "rumbo": las próximas fechas en orden, desde hoy. La primera es el siguiente paso.
 * Las paradas van espaciadas por igual; la distancia real se lee en "Faltan N días".
 */
export function Rumbo({ items }: { items: Opportunity[] }) {
  if (items.length === 0) {
    return (
      <section className="rumbo rumbo-empty" aria-labelledby="rumbo-title">
        <h2 id="rumbo-title">Tu rumbo</h2>
        <p>No hay fechas próximas. Revisa las <Link to="/catalogo">oportunidades abiertas</Link>.</p>
      </section>
    )
  }
  const [next] = items
  return (
    <section className="rumbo" aria-labelledby="rumbo-title">
      <div className="rumbo-head">
        <h2 id="rumbo-title">Tu rumbo</h2>
        <Link to="/calendario">Ver calendario</Link>
      </div>
      <ol className="rumbo-track">
        <li className="rumbo-today">
          <span className="rumbo-dot" aria-hidden="true" />
          <span className="rumbo-today-label">Hoy</span>
        </li>
        {items.map((item, index) => {
          const days = daysUntil(item.deadline!)
          const { day, month } = dayAndMonth(item.deadline!)
          return (
            <li key={item.id} className={`rumbo-stop ${urgencyFor(days)}${index === 0 ? ' next' : ''}`}>
              <span className="rumbo-dot" aria-hidden="true" />
              <time dateTime={item.deadline}>
                <strong>{day}</strong> {month}
              </time>
              <span className="rumbo-title">{item.title}</span>
              <span className="rumbo-meta">
                {typeMeta[item.type].label}, {daysLabel(days).toLowerCase()}
              </span>
            </li>
          )
        })}
      </ol>
      <div className="rumbo-next">
        <p>
          Tu siguiente paso es <strong>{next.title}</strong>.
        </p>
        <AskAssistantLink className="button primary" question={`¿Qué necesito para ${next.title}?`}>
          Preguntar qué necesito
        </AskAssistantLink>
      </div>
    </section>
  )
}
