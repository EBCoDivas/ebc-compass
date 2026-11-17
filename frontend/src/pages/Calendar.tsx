import { loadProfile } from '../services/profileService'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchOpportunities, type Opportunity } from '../services/opportunityService'
import { TypeBadge } from '../components/TypeBadge'
import { daysLabel, daysUntil, urgencyFor } from '../utils/dates'

const monthShort = new Intl.DateTimeFormat('es-MX', { month: 'short' })

function monthDays(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }

export function Calendar() {
  const profile = loadProfile()
  const [items, setItems] = useState<Opportunity[]>([])
  const [error, setError] = useState('')
  useEffect(() => { fetchOpportunities({ campus: profile?.campus || undefined, career: profile?.career || undefined }).then((all) => setItems(all.filter((item) => item.deadline).sort((a, b) => a.deadline!.localeCompare(b.deadline!)))).catch(() => { setItems([]); setError('No se pudo cargar el calendario. Verifica tu conexión e inténtalo de nuevo.') }) }, [profile?.campus, profile?.career])
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const days = Array.from({ length: monthDays(year, month) }, (_, index) => index + 1)
  const deadlines = new Map(items.map((item) => [item.deadline, item]))
  const todayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const upcoming = items.filter((item) => daysUntil(item.deadline!) >= 0)
  return (
    <main className="page">
      <div className="page-heading"><h1>Calendario</h1><p>Fechas importantes, convocatorias y vencimientos de tu semestre.</p></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="calendar-layout">
        <section className="dashboard-section calendar-month" aria-labelledby="month-title">
          <h2 id="month-title">{now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</h2>
          <div className="calendar-week" aria-hidden="true"><span>Dom</span><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span></div>
          <div className="calendar-grid">
            {Array.from({ length: firstDay }).map((_, index) => <span className="calendar-empty" key={`empty-${index}`} />)}
            {days.map((day) => {
              const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const item = deadlines.get(date)
              const isToday = date === todayKey
              const label = `${day}${isToday ? ', hoy' : ''}${item ? `, ${item.title}` : ''}`
              const className = `calendar-day${isToday ? ' today' : ''}`
              if (item && daysUntil(item.deadline!) >= 0) {
                return <a className={`${className} has-deadline ${urgencyFor(daysUntil(item.deadline!))}`} href={`#fecha-${item.id}`} title={item.title} aria-label={label} key={date}>{day}</a>
              }
              return <span className={`${className}${item ? ' past-deadline' : ''}`} title={item?.title} aria-label={label} key={date}>{day}</span>
            })}
          </div>
          <p className="calendar-legend"><span className="legend-dot" aria-hidden="true" />Día con una fecha. Selecciónalo para verla en la lista.</p>
        </section>
        <section className="dashboard-section" aria-labelledby="dates-title">
          <h2 id="dates-title">Próximas fechas</h2>
          {upcoming.length === 0 && <p>No hay fechas próximas. Revisa las <Link to="/catalogo">oportunidades abiertas</Link>.</p>}
          <ol className="date-list calendar-list">
            {upcoming.map((item) => {
              const days = daysUntil(item.deadline!)
              const [, mm, dd] = item.deadline!.split('-').map(Number)
              return (
                <li className={urgencyFor(days)} id={`fecha-${item.id}`} key={item.id}>
                  <time className="date-chip" dateTime={item.deadline}><strong>{dd}</strong>{monthShort.format(new Date(year, mm - 1, dd)).replace('.', '')}</time>
                  <div className="date-body">
                    <TypeBadge type={item.type} />
                    <strong>{item.title}</strong>
                    <small>{item.type === 'event' ? 'Día del evento' : 'Fecha límite'}</small>
                  </div>
                  <div className="date-side">
                    <span className="days-left">{daysLabel(days)}</span>
                    <Link className="date-link" to={`/catalogo?search=${encodeURIComponent(item.title)}`}>Ver detalle<span className="visually-hidden"> de {item.title}</span></Link>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      </div>
    </main>
  )
}
