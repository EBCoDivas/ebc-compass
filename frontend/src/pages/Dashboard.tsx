import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadProfile } from '../services/profileService'
import { fetchOpportunities, type Opportunity } from '../services/opportunityService'
import { useNavigate } from 'react-router-dom'

const labels = { course: 'Curso', scholarship: 'Beca', 'professional-development': 'Desarrollo profesional', event: 'Evento', procedure: 'Procedimiento', 'career-opportunity': 'Oportunidad laboral' }

export function Dashboard() {
  const profile = loadProfile()
  const navigate = useNavigate()
  const [items, setItems] = useState<Opportunity[]>([])
  useEffect(() => { fetchOpportunities({ career: profile?.career || undefined }).then(setItems).catch(() => setItems([])) }, [profile?.career])
  const progress = profile?.currentSemester && typeof profile.currentSemester === 'number' ? profile.currentSemester * 10 : 20
  return <main className="page dashboard-page"><div className="page-heading"><h1>Dashboard</h1><p>Recomendaciones y fechas importantes para avanzar en EBC.</p></div><section className="dashboard-grid"><article className="metric-card"><span>Avance académico</span><strong>{progress}%</strong><div className="progress-track"><div className="progress-value" style={{ width: `${progress}%` }} /></div><small>Semestre {profile?.currentSemester || 2} de 10</small></article><article className="metric-card"><span>Perfil</span><strong>{profile ? 'Listo' : 'Pendiente'}</strong><Link to="/perfil">{profile ? 'Editar perfil' : 'Completar perfil'}</Link></article></section><section className="dashboard-section"><div className="section-heading"><h2>Recomendado para ti</h2><Link to="/catalogo">Ver catálogo</Link></div><div className="opportunity-grid">{items.slice(0, 4).map((item) => <button className="opportunity-card opportunity-card-button" key={item.id} onClick={() => navigate(`/catalogo?search=${encodeURIComponent(item.title)}`)}><span className="badge">{labels[item.type]}</span><h3>{item.title}</h3><p>{item.description}</p>{item.deadline && <small>Fecha límite: {item.deadline}</small>}<span className="card-action">Ver en catálogo →</span></button>)}</div></section><section className="dashboard-section"><h2>Próximas fechas y alertas</h2><ul className="alert-list">{items.filter((item) => item.deadline).slice(0, 3).map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.deadline}</span></li>)}</ul></section></main>
}
