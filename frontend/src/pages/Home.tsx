import { Link } from 'react-router-dom'
import { simulatedAcademicData } from '../types/profile'
import { loadProfile, profileCompleteness } from '../services/profileService'

export function Home() {
  const profile = loadProfile()
  return <main className="page home-page"><p className="eyebrow">TU GUÍA ACADÉMICA Y PROFESIONAL</p><h1>Bienvenido{profile?.name ? `, ${profile.name}` : ''}</h1><p className="intro">Encuentra tu próximo paso en EBC.</p>{profile ? <section className="summary-card"><div><span className="summary-label">Mi perfil</span><h2>{simulatedAcademicData.career}</h2><p>{simulatedAcademicData.campus} · {simulatedAcademicData.semester}</p><span>{profileCompleteness(profile)}% completado</span></div><Link className="button primary" to="/perfil">Editar perfil</Link></section> : <section className="welcome-card"><h2>Comienza creando tu perfil</h2><p>Usaremos tus datos para personalizar tu experiencia. La información se guarda solo en este navegador.</p><Link className="button primary" to="/perfil">Crear mi perfil</Link></section>}</main>
}
