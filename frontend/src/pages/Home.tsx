import { academicDataFromClaims } from '../services/personaService'
import { getToken } from '../services/authService'
import { personaStorageKey } from '../services/personaService'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { loadProfile, profileCompleteness } from '../services/profileService'
import { fetchOpportunities, fetchRecommendations, type Opportunity } from '../services/opportunityService'
import { TypeBadge } from '../components/TypeBadge'
import { Rumbo } from '../components/Rumbo'
import { daysUntil, formatShortDate } from '../utils/dates'
import { DateLine } from '../components/DateLine'
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
  const academic = academicDataFromClaims(getToken())
  const [all, setAll] = useState<Opportunity[]>([])
  const [recommended, setRecommended] = useState<Opportunity[]>([])
  const [savedIds, setSavedIds] = useState<string[]>(() => JSON.parse(window.localStorage.getItem(personaStorageKey(SAVED_KEY)) ?? '[]') as string[])

  useEffect(() => {
    const updateSaved = (event: Event) => setSavedIds((event as CustomEvent<string[]>).detail)
    window.addEventListener('ebc-saved-opportunities', updateSaved)
    return () => window.removeEventListener('ebc-saved-opportunities', updateSaved)
  }, [])

  useEffect(() => {
    fetchOpportunities({ campus: profile?.campus || undefined, career: profile?.career || undefined }).then(setAll).catch(() => setAll([]))
  }, [profile?.campus, profile?.career])

  const profileInterests = profile?.interests.join(',')
  useEffect(() => {
    if (!profile) return
    fetchRecommendations({ career: profile.career, currentSemester: profile.currentSemester, interests: profile.interests, campus: profile.campus })
      .then((list) => setRecommended(list.map((item) => item.opportunity)))
      .catch(() => setRecommended([]))
  }, [profile?.career, profile?.campus, profile?.currentSemester, profileInterests])

  // Con perfil, el rumbo usa lo recomendado; si hay pocas fechas, se completa con las generales.
  const personal = upcomingOf(recommended, 5)
  const route = personal.length >= 3 ? personal : upcomingOf([...personal, ...all.filter((item) => !personal.some((p) => p.id === item.id))], 5)
  const picks = (profile ? recommended : all).slice(0, 3)
  function removeSaved(id: string) {
    const next = savedIds.filter((savedId) => savedId !== id)
    setSavedIds(next)
    window.localStorage.setItem(personaStorageKey(SAVED_KEY), JSON.stringify(next))
  }
  const savedItems = all.filter((item) => savedIds.includes(item.id))

  const career = academic?.career || profile?.career
  const campus = academic?.campus || profile?.campus
  const semester = academic?.semester || profile?.currentSemester
  const completeness = profile ? profileCompleteness(profile) : 0

  return (
    <main className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-inner">
          <div className="home-greeting">
            <div>
              <h1 id="home-title">{profile?.name ? `Hola, ${profile.name}` : 'Tu rumbo en EBC'}</h1>
              <p>{career ? `${career}, ${campus || 'sin campus'}, ${semester}` : 'Ten claro qué sigue.'}</p>
            </div>
            {profile && <Link className="hero-link" to="/perfil">Editar perfil</Link>}
          </div>
          <Rumbo items={route} />
        </div>
      </section>

      <div className="page home-body">
        {!profile && (
          <section className="profile-strip">
            <p>Crea tu perfil para ver fechas y oportunidades de tu carrera. Tus ajustes se guardan en tu cuenta.</p>
            <Link className="button primary" to="/perfil">Crear mi perfil</Link>
          </section>
        )}
        {profile && completeness < 100 && (
          <section className="profile-strip">
            <p>Tu perfil está completo al {completeness}%. Agrega tus intereses para afinar las recomendaciones.</p>
            <Link className="button secondary" to="/perfil">Completar perfil</Link>
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
                <span className="card-top">
                  <TypeBadge type={item.type} />
                  {savedIds.includes(item.id) && <span className="saved-label">Guardada</span>}
                </span>
                {item.deadline && <DateLine type={item.type} deadline={item.deadline} />}
                <h3><Link className="card-link" to={`/catalogo?search=${encodeURIComponent(item.title)}`}>{item.title}</Link></h3>
                <p>{item.description}</p>
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
                  {item.deadline && <small>{dateLabelFor(item.type)}: {formatShortDate(item.deadline)}</small>}
                  <button type="button" className="saved-remove" onClick={() => removeSaved(item.id)}>Quitar<span className="visually-hidden"> {item.title} de guardadas</span></button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}
