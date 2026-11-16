import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { simulatedAcademicData } from '../types/profile'
import { loadProfile, profileCompleteness } from '../services/profileService'
import { fetchOpportunities, fetchRecommendations, type Opportunity } from '../services/opportunityService'
import { assistantPath } from '../services/assistantService'
import { TypeBadge } from '../components/TypeBadge'
import { Rumbo } from '../components/Rumbo'
import { daysUntil, formatDate } from '../utils/dates'
import { dateLabelFor } from '../utils/opportunityTypes'

const SAVED_KEY = 'ebc_compass_saved_opportunities'

/** Próximas fechas (hoy o después), de la más cercana a la más lejana. */
function upcomingOf(list: Opportunity[], limit: number) {
  return list
    .filter((item) => item.deadline && daysUntil(item.deadline) >= 0)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
    .slice(0, limit)
}

export function Home() {
  const profile = loadProfile()
  const [all, setAll] = useState<Opportunity[]>([])
  const [recommended, setRecommended] = useState<Opportunity[]>([])
  const [savedIds, setSavedIds] = useState<string[]>(() => JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? '[]') as string[])

  useEffect(() => {
    const updateSaved = (event: Event) => setSavedIds((event as CustomEvent<string[]>).detail)
    window.addEventListener('ebc-saved-opportunities', updateSaved)
    return () => window.removeEventListener('ebc-saved-opportunities', updateSaved)
  }, [])

  useEffect(() => {
    fetchOpportunities().then(setAll).catch(() => setAll([]))
  }, [])

  const profileInterests = profile?.interests.join(',')
  useEffect(() => {
    if (!profile) return
    fetchRecommendations({ career: profile.career, currentSemester: profile.currentSemester, interests: profile.interests })
      .then((list) => setRecommended(list.map((item) => item.opportunity)))
      .catch(() => setRecommended([]))
  }, [profile?.career, profile?.currentSemester, profileInterests])

  // Con perfil, el rumbo usa lo recomendado; si hay pocas fechas, se completa con las generales.
  const personal = upcomingOf(recommended, 5)
  const route = personal.length >= 3 ? personal : upcomingOf([...personal, ...all.filter((item) => !personal.some((p) => p.id === item.id))], 5)
  const picks = (profile ? recommended : all).slice(0, 3)
  const savedItems = all.filter((item) => savedIds.includes(item.id))

  return (
    <main className="page home-page">
      <h1>{profile?.name ? `Hola, ${profile.name}` : 'Tu rumbo en EBC'}</h1>
      <p className="intro">Lo que viene en tu semestre y lo que puedes aprovechar.</p>

      {!profile && (
        <section className="profile-strip">
          <p>Crea tu perfil para ver fechas y oportunidades de tu carrera. Se guarda solo en este navegador.</p>
          <Link className="button primary" to="/perfil">Crear mi perfil</Link>
        </section>
      )}

      <Rumbo items={route} />

      {profile && (
        <section className="summary-card">
          <div>
            <h2>{simulatedAcademicData.career}</h2>
            <p>{simulatedAcademicData.campus}, {simulatedAcademicData.semester}</p>
            <span className="summary-label">Perfil completo al {profileCompleteness(profile)}%</span>
          </div>
          <Link className="button secondary" to="/perfil">Editar perfil</Link>
        </section>
      )}

      <section className="home-section">
        <div className="section-heading">
          <h2>{profile ? 'Recomendaciones para ti' : 'Oportunidades abiertas'}</h2>
          <Link to="/catalogo">Ver todas</Link>
        </div>
        <div className="opportunity-grid">
          {picks.map((item) => (
            <article className="opportunity-card" key={item.id}>
              <TypeBadge type={item.type} />
              {item.deadline && <p className="card-date">{dateLabelFor(item.type)}: {formatDate(item.deadline)}</p>}
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              {savedIds.includes(item.id) && <span className="saved-label">Guardada</span>}
              <Link className="card-action" to={assistantPath(`Cuéntame sobre ${item.title}`)}>Preguntar al asistente</Link>
            </article>
          ))}
        </div>
      </section>

      {savedItems.length > 0 && (
        <section className="home-section">
          <h2>Guardadas para después</h2>
          <ul className="saved-list">
            {savedItems.map((item) => (
              <li className="saved-item" key={item.id}>
                <TypeBadge type={item.type} />
                <strong>{item.title}</strong>
                {item.deadline && <small>{dateLabelFor(item.type)}: {formatDate(item.deadline)}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
