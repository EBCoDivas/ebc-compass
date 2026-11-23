import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadProfile } from '../services/profileService'
import { fetchOpportunities, fetchStudentPlanning, type Opportunity } from '../services/opportunityService'
import { sessionSubject } from '../services/session'
import { toggleSaved, useSavedOpportunities } from '../services/savedOpportunities'
import { TypeBadge } from '../components/TypeBadge'
import { calendarEntries, type CalendarEntry, type CalendarLayer } from '../utils/calendarEntries'
import { daysLabel, daysUntil, urgencyFor } from '../utils/dates'
import type { StudentRouteItem } from '../../../shared/contracts/studentPlanning'

const monthShort = new Intl.DateTimeFormat('es-MX', { month: 'short' })
const monthLong = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' })
const layerNames: Record<CalendarLayer, string> = { route: 'Lo que te toca', saved: 'Guardada', more: 'Más fechas' }

const pad = (value: number) => String(value).padStart(2, '0')
const keyOf = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`

function BookmarkIcon() {
  return <svg aria-hidden="true" className="layer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3.5h12v17l-6-4.2-6 4.2z" /></svg>
}

function EntryRow({ entry, saved }: { entry: CalendarEntry; saved: boolean }) {
  const { item, date, layer, required } = entry
  const days = daysUntil(date)
  const [year, month, day] = date.split('-').map(Number)
  return (
    <li className={`${urgencyFor(days)} layer-${layer}`} id={`fecha-${item.id}`}>
      <time className="date-chip" dateTime={date}><strong>{day}</strong>{monthShort.format(new Date(year, month - 1, day)).replace('.', '')}</time>
      <div className="date-body">
        <span className="date-tags">
          <TypeBadge type={item.type} />
          {layer === 'route' && <span className={`route-tag${required ? ' required' : ''}`}>{required ? 'Obligatorio' : 'Opcional'}</span>}
          {layer === 'saved' && <span className="saved-tag"><BookmarkIcon />Guardada</span>}
        </span>
        <strong>{item.title}</strong>
        <small>{item.type === 'event' ? 'Día del evento' : 'Fecha límite'}</small>
      </div>
      <div className="date-side">
        <span className="days-left">{daysLabel(days)}</span>
        <Link className="date-link" to={`/catalogo?search=${encodeURIComponent(item.title)}`}>Ver detalle<span className="visually-hidden"> de {item.title}</span></Link>
        {layer !== 'route' && (
          <button type="button" className="date-toggle" onClick={() => toggleSaved(item.id)}>
            {saved ? 'Quitar' : 'Agregar'}<span className="visually-hidden"> {item.title} {saved ? 'de' : 'a'} mi calendario</span>
          </button>
        )}
      </div>
    </li>
  )
}

export function Calendar() {
  const profile = loadProfile()
  const signedIn = Boolean(sessionSubject())
  const saved = useSavedOpportunities()
  const [catalog, setCatalog] = useState<Opportunity[]>([])
  const [route, setRoute] = useState<StudentRouteItem[]>([])
  const [error, setError] = useState('')
  const [showMore, setShowMore] = useState(!signedIn)
  const now = new Date()
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    let active = true
    const load = signedIn
      ? fetchStudentPlanning().then(planning => ({ catalog: planning.catalog, route: planning.route }))
      : fetchOpportunities({ campus: profile?.campus || undefined, career: profile?.career || undefined,
          semester: typeof profile?.currentSemester === 'number' ? profile.currentSemester : undefined }).then(all => ({ catalog: all, route: [] }))
    load.then(value => { if (active) { setCatalog(value.catalog); setRoute(value.route) } })
      .catch(() => { if (active) setError('No se pudo cargar el calendario. Verifica tu conexión e inténtalo de nuevo.') })
    return () => { active = false }
  }, [signedIn, profile?.campus, profile?.career, profile?.currentSemester])

  const entries = calendarEntries(catalog, route, saved)
  const upcoming = entries.filter(entry => daysUntil(entry.date) >= 0)
  const byLayer = (layer: CalendarLayer) => upcoming.filter(entry => entry.layer === layer)
  const visibleLayers = new Set<CalendarLayer>(['route', 'saved', ...(showMore ? ['more' as const] : [])])

  const shown = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const year = shown.getFullYear()
  const month = shown.getMonth()
  const firstDay = shown.getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const todayKey = keyOf(now.getFullYear(), now.getMonth(), now.getDate())
  const byDate = new Map<string, CalendarEntry[]>()
  for (const entry of entries) if (visibleLayers.has(entry.layer)) byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry])

  return (
    <main className="page">
      <div className="page-heading"><h1>Tu calendario</h1><p>Lo que te toca, lo que agregaste y, si quieres, más fechas para tu etapa.</p></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="calendar-layout">
        <section className="dashboard-section calendar-month" aria-labelledby="month-title">
          <div className="calendar-month-head">
            <button type="button" className="month-nav" onClick={() => setOffset(value => value - 1)} aria-label="Mes anterior">‹</button>
            <h2 id="month-title" aria-live="polite">{monthLong.format(shown)}</h2>
            <button type="button" className="month-nav" onClick={() => setOffset(value => value + 1)} aria-label="Mes siguiente">›</button>
          </div>
          <div className="calendar-week" aria-hidden="true"><span>Dom</span><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span></div>
          <div className="calendar-grid">
            {Array.from({ length: firstDay }).map((_, index) => <span className="calendar-empty" key={`empty-${index}`} />)}
            {Array.from({ length: days }, (_, index) => index + 1).map(day => {
              const date = keyOf(year, month, day)
              const list = byDate.get(date) ?? []
              const isToday = date === todayKey
              const label = `${day}${isToday ? ', hoy' : ''}${list.length ? ', ' + list.map(entry => entry.item.title).join('; ') : ''}`
              const className = `calendar-day${isToday ? ' today' : ''}`
              const dots = <span className="calendar-dots" aria-hidden="true">{[...new Set(list.map(entry => entry.layer))].map(layer => <span key={layer} className={`dot ${layer}`} />)}</span>
              if (list.length && daysUntil(date) >= 0) {
                return <a className={`${className} has-deadline ${urgencyFor(daysUntil(date))}`} href={`#fecha-${list[0].item.id}`} title={list.map(entry => entry.item.title).join(' · ')} aria-label={label} key={date}>{day}{dots}</a>
              }
              return <span className={`${className}${list.length ? ' past-deadline' : ''}`} title={list.map(entry => entry.item.title).join(' · ') || undefined} aria-label={label} key={date}>{day}{list.length > 0 && dots}</span>
            })}
          </div>
          <ul className="calendar-legend">
            <li><span className="dot route" aria-hidden="true" />Lo que te toca</li>
            <li><span className="dot saved" aria-hidden="true" />Guardadas</li>
            {showMore && <li><span className="dot more" aria-hidden="true" />Más fechas</li>}
          </ul>
        </section>
        <div className="calendar-lists">
          {signedIn && (
            <section className="dashboard-section" aria-labelledby="route-dates-title">
              <h2 id="route-dates-title">{layerNames.route}</h2>
              {byLayer('route').length === 0
                ? <p className="calendar-empty-note">No tienes fechas pendientes en tu ruta.</p>
                : <ol className="date-list calendar-list">{byLayer('route').map(entry => <EntryRow key={entry.item.id} entry={entry} saved={false} />)}</ol>}
            </section>
          )}
          <section className="dashboard-section" aria-labelledby="saved-dates-title">
            <h2 id="saved-dates-title">Guardadas</h2>
            {byLayer('saved').length === 0
              ? <p className="calendar-empty-note">Agrega fechas desde <Link to="/catalogo">Oportunidades</Link> con «Agregar a mi calendario» y aparecerán aquí y en tu rumbo.</p>
              : <ol className="date-list calendar-list">{byLayer('saved').map(entry => <EntryRow key={entry.item.id} entry={entry} saved />)}</ol>}
          </section>
          {byLayer('more').length > 0 && (
            <details className="dashboard-section calendar-more" open={showMore} onToggle={event => setShowMore(event.currentTarget.open)}>
              <summary><span>Más fechas para tu etapa</span> <span className="calendar-more-count">{byLayer('more').length}</span></summary>
              <ol className="date-list calendar-list">{byLayer('more').map(entry => <EntryRow key={entry.item.id} entry={entry} saved={false} />)}</ol>
            </details>
          )}
        </div>
      </div>
    </main>
  )
}
