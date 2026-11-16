import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchOpportunities, type Opportunity } from '../services/opportunityService'
import { TypeBadge } from '../components/TypeBadge'
import { daysLabel, daysUntil, formatDate, urgencyFor } from '../utils/dates'
import { dateLabelFor } from '../utils/opportunityTypes'

function monthDays(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }

export function Calendar() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [error, setError] = useState('')
  useEffect(() => { fetchOpportunities().then((all) => setItems(all.filter((item) => item.deadline).sort((a, b) => a.deadline!.localeCompare(b.deadline!)))).catch(() => { setItems([]); setError('No se pudo cargar el calendario. Verifica tu conexión e inténtalo de nuevo.') }) }, [])
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const days = Array.from({ length: monthDays(year, month) }, (_, index) => index + 1)
  const deadlines = new Map(items.map((item) => [item.deadline, item]))
  const todayKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const upcoming = items.filter((item) => daysUntil(item.deadline!) >= 0)
  return <main className="page"><div className="page-heading"><h1>Calendario</h1><p>Consulta fechas importantes, convocatorias y vencimientos.</p></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="calendar-layout"><section className="dashboard-section calendar-month"><h2>{now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</h2><div className="calendar-week"><span>Dom</span><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span></div><div className="calendar-grid">{Array.from({ length: firstDay }).map((_, index) => <span className="calendar-empty" key={`empty-${index}`} />)}{days.map((day) => { const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const item = deadlines.get(date); return <span className={`calendar-day${item ? ' has-deadline' : ''}${date === todayKey ? ' today' : ''}`} title={item?.title} aria-label={`${day}${date === todayKey ? ', hoy' : ''}${item ? `, ${item.title}` : ''}`} key={date}>{day}</span> })}</div></section><section className="dashboard-section"><h2>Fechas importantes</h2>{upcoming.length === 0 && <p>No hay fechas próximas.</p>}<ul className="date-list calendar-list">{upcoming.map((item) => <li className={urgencyFor(daysUntil(item.deadline!))} key={item.id}><div><TypeBadge type={item.type} /><strong>{item.title}</strong><small>{dateLabelFor(item.type)}: {formatDate(item.deadline!)}</small></div><span className="days-left">{daysLabel(daysUntil(item.deadline!))}</span><Link className="button secondary" to={`/catalogo?search=${encodeURIComponent(item.title)}`}>Ver detalle</Link></li>)}</ul></section></div></main>
}
