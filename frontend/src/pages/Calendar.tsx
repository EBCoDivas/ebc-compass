import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchOpportunities, type Opportunity } from '../services/opportunityService'
import { Alerts } from '../components/Alerts'

function formatDate(date: string) { const [year, month, day] = date.split('-'); return `${day}/${month}/${year}` }

export function Calendar() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [error, setError] = useState('')
  useEffect(() => { fetchOpportunities().then((all) => setItems(all.filter((item) => item.deadline).sort((a, b) => a.deadline!.localeCompare(b.deadline!)))).catch(() => { setItems([]); setError('No se pudo cargar el calendario. Verifica tu conexión e inténtalo de nuevo.') }) }, [])
  return <main className="page"><div className="page-heading"><p className="eyebrow">ORGANIZA TU SEMESTRE</p><h1>Calendario</h1><p>Consulta fechas importantes, convocatorias y vencimientos.</p><Link className="button secondary" to="/">← Volver a Inicio</Link></div>{error && <p className="form-error" role="alert">{error}</p>}<Alerts /><section className="dashboard-section"><h2>Fechas importantes</h2><ul className="date-list calendar-list">{items.map((item) => <li key={item.id}><div><span className="badge">{item.type === 'scholarship' ? 'Beca' : item.type === 'event' ? 'Evento' : 'Actividad'}</span><strong>{item.title}</strong><small>Fecha de vencimiento: {formatDate(item.deadline!)}</small></div><Link className="button secondary" to={`/catalogo?search=${encodeURIComponent(item.title)}`}>Ver detalle</Link></li>)}</ul></section></main>
}
