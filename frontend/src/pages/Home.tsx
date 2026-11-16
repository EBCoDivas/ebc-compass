import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { simulatedAcademicData } from '../types/profile'
import { loadProfile, profileCompleteness } from '../services/profileService'
import { fetchOpportunities, type Opportunity } from '../services/opportunityService'

const labels = { course: 'Curso', scholarship: 'Beca', event: 'Evento', procedure: 'Procedimiento' }

function daysUntil(date: string) {
  return Math.ceil((new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86400000)
}

function formatDate(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export function Home() {
  const profile = loadProfile()
  const [items, setItems] = useState<Opportunity[]>([])
  const [savedIds] = useState<string[]>(() => JSON.parse(window.localStorage.getItem('ebc_compass_saved_opportunities') ?? '[]') as string[])
  useEffect(() => { fetchOpportunities({ career: profile?.career || undefined }).then(setItems).catch(() => setItems([])) }, [profile?.career])
  const upcoming = items.filter((item) => item.deadline).sort((a, b) => a.deadline!.localeCompare(b.deadline!)).slice(0, 4)
  return <main className="page home-page"><p className="eyebrow">TU GUÍA ACADÉMICA Y PROFESIONAL</p><h1>Bienvenido{profile?.name ? `, ${profile.name}` : ''}</h1><p className="intro">Tu resumen y próximos pasos en EBC.</p>{profile ? <><section className="summary-card"><div><span className="summary-label">Mi perfil</span><h2>{simulatedAcademicData.career}</h2><p>{simulatedAcademicData.campus} · {simulatedAcademicData.semester}</p><span>{profileCompleteness(profile)}% completado</span></div><Link className="button primary" to="/perfil">Editar perfil</Link></section><section className="dashboard-section home-dates"><div className="section-heading"><h2>Próximas fechas</h2><Link className="button secondary" to="/catalogo">Ver más oportunidades</Link></div>{upcoming.length === 0 ? <p>No tienes fechas próximas.</p> : <ul className="date-list">{upcoming.map((item) => { const days = daysUntil(item.deadline!); const urgency = days <= 3 ? 'urgent' : days <= 7 ? 'soon' : 'future'; return <li className={urgency} key={item.id}><div><span className="badge">{labels[item.type]}</span><strong>{item.title}</strong><small>Fecha de vencimiento: {formatDate(item.deadline!)}</small></div><span className="days-left">{days < 0 ? 'Vencida' : days === 0 ? 'Hoy' : `${days} días`}</span></li> })}</ul>}</section><section className="dashboard-section"><div className="section-heading"><h2>Recomendaciones para ti</h2><Link className="button secondary" to="/catalogo">Ver más oportunidades</Link></div><div className="opportunity-grid">{items.slice(0, 3).map((item) => <article className="opportunity-card" key={item.id}><span className="badge">{labels[item.type]}</span>{savedIds.includes(item.id) && <span className="saved-label">Guardada</span>}<h3>{item.title}</h3><p>{item.description}</p></article>)}</div></section></> : <section className="welcome-card"><h2>Comienza creando tu perfil</h2><p>Usaremos tus datos para personalizar tu experiencia. La información se guarda solo en este navegador.</p><Link className="button primary" to="/perfil">Crear mi perfil</Link></section>}</main>
}
