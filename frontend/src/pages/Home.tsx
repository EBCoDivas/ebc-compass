import { academicDataFromClaims, periodLabel } from '../services/personaService'
import { getToken, sessionSubject } from '../services/session'
import { personaStorageKey } from '../services/personaService'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { loadProfile, profileCompleteness } from '../services/profileService'
import { fetchAlerts, fetchOpportunities, fetchRecommendations, fetchStudentPlanning, type Alert, type Opportunity, type Recommendation } from '../services/opportunityService'
import { TypeBadge } from '../components/TypeBadge'
import { Rumbo } from '../components/Rumbo'
import { daysUntil, formatShortDate } from '../utils/dates'
import { DateLine } from '../components/DateLine'
import { fetchAcademicProgress, type AcademicProgress } from '../services/academicProgressService'
import type { StudentJourney } from '../../../shared/contracts/studentPlanning'
import { StudentPendingList } from '../components/StudentPendingList'
import { useSavedOpportunities } from '../services/savedOpportunities'

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
  const [academicProgress, setAcademicProgress] = useState<AcademicProgress | null>(null)
  const [progressLoading, setProgressLoading] = useState(true)
  const [progressError, setProgressError] = useState('')
  const [recommendationsLoading, setRecommendationsLoading] = useState(Boolean(profile))
  const [recommendationsError, setRecommendationsError] = useState('')
  const [all, setAll] = useState<Opportunity[]>([])
  const [alerts, setAlerts] = useState<Alert[] | null>(null)
  const [planning, setPlanning] = useState<StudentJourney | null>(null)
  const [planningStatus, setPlanningStatus] = useState<'loading' | 'ready' | 'error'>(() => sessionSubject() ? 'loading' : 'ready')
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  useEffect(() => {
    if (progressLoading || recommendationsLoading) return
    const key = personaStorageKey('home-return-scroll')
    const saved = sessionStorage.getItem(key)
    if (saved !== null) { window.scrollTo(0, Number(saved)); sessionStorage.removeItem(key) }
  }, [progressLoading, recommendationsLoading])
  const recommended = recommendations.map((item) => item.opportunity)
  const savedIds = useSavedOpportunities()

  useEffect(() => {
    const scope = { campus: profile?.campus || undefined, career: profile?.career || undefined,
      semester: typeof profile?.currentSemester === 'number' ? profile.currentSemester : undefined }
    let active = true
    const signedIn = Boolean(sessionSubject())
    const catalog = signedIn ? fetchStudentPlanning().then(value => {
      if (active) { setPlanning(value); setPlanningStatus('ready') }
      return value.catalog
    }) : fetchOpportunities(scope)
    catalog.then(value => { if (active) setAll(value) }).catch(() => {
      if (active && signedIn) setPlanningStatus('error')
    })
    fetchAlerts(scope).then(value => { if (active) setAlerts(value) }).catch(() => { if (active) setAlerts(null) })
    return () => { active = false }
  }, [profile?.campus, profile?.career, profile?.currentSemester])

  useEffect(() => {
    let active = true
    fetchAcademicProgress()
      .then(value => { if (active) setAcademicProgress(value) })
      .catch(() => { if (active) setProgressError('No pudimos cargar tu avance académico. Recarga la página para intentar de nuevo.') })
      .finally(() => { if (active) setProgressLoading(false) })
    return () => { active = false }
  }, [])

  const profileInterests = profile?.interests.join(',')
  useEffect(() => {
    if (!profile) return
    let active = true
    setRecommendationsLoading(true)
    setRecommendationsError('')
    fetchRecommendations({ career: profile.career, currentSemester: profile.currentSemester, interests: profile.interests, campus: profile.campus })
      .then(value => { if (active) setRecommendations(value) })
      .catch(() => { if (active) { setRecommendations([]); setRecommendationsError('No pudimos cargar tus recomendaciones. Recarga la página para intentar de nuevo.') } })
      .finally(() => { if (active) setRecommendationsLoading(false) })
    return () => { active = false }
  }, [profile?.career, profile?.campus, profile?.currentSemester, profileInterests])

  const alertIds = new Set(alerts?.map(alert => alert.opportunityId))
  // El rumbo junta las alertas de tu etapa con lo que agregaste a tu calendario.
  const route = upcomingOf(alerts ? all.filter(item => alertIds.has(item.id) || savedIds.includes(item.id)) : all, 5)
  const picks = (profile ? recommended : all).slice(0, 3)
  const recommendationGroups = [
    { label: 'Cursos y desarrollo profesional', types: ['course', 'professional-development'] },
    { label: 'Becas', types: ['scholarship'] },
    { label: 'Eventos', types: ['event'] },
    { label: 'Trámites', types: ['procedure'] },
    { label: 'Oportunidades laborales', types: ['career-opportunity'] },
  ].map((group) => ({ ...group, items: recommendations.filter((item) => group.types.includes(item.opportunity.type)) }))

  const career = academic?.career || profile?.career
  const campus = academic?.campus || profile?.campus
  const semester = academic?.semester || (profile?.currentSemester && profile.currentSemester !== 'na' ? periodLabel(profile.currentSemester) : '')
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
        {planningStatus === 'loading' && <p role="status">Cargando pendientes…</p>}
        {planningStatus === 'error' && <p className="form-error" role="alert">No pudimos cargar tus pendientes. Recarga la página para intentar de nuevo.</p>}
        {planning && <StudentPendingList planning={planning} />}
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

        {progressLoading && <p role="status">Cargando avance académico…</p>}
        {progressError && <p className="form-error" role="alert">{progressError}</p>}
        {!progressLoading && !progressError && !academicProgress && <p>No hay datos de avance académico disponibles para tu cuenta.</p>}
        {academicProgress && (
          <section className="academic-progress-card" aria-labelledby="academic-progress-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Avance académico</p>
                <h2 id="academic-progress-title">Tu avance en {academicProgress.program.name}</h2>
              </div>
              <span>{academicProgress.currentPeriod.number}.º {academicProgress.currentPeriod.type}</span>
            </div>
            <p>{academicProgress.campus.name} · Actualizado al {formatShortDate(academicProgress.asOf)}</p>
            {academicProgress.credits && academicProgress.credits.total > 0 && <div className="academic-credit-progress"><label htmlFor="academic-credits">Créditos obtenidos: {academicProgress.credits.earned} de {academicProgress.credits.total}</label><progress id="academic-credits" value={academicProgress.credits.earned} max={academicProgress.credits.total} /></div>}
            <div className="academic-progress-facts">
              {academicProgress.courses && <p><strong>{academicProgress.courses.completed} de {academicProgress.courses.total}</strong><span>materias cursadas</span></p>}

              {academicProgress.gpa && <p><strong>{academicProgress.gpa.value} / {academicProgress.gpa.scale}</strong><span>promedio</span></p>}
            </div>
          </section>
        )}

        <section className="home-section">
          <div className="section-heading">
            <h2>{profile ? 'Recomendaciones para ti' : 'Oportunidades abiertas'}</h2>
            <Link to="/catalogo">Ver todas</Link>
          </div>
          {profile && recommendationsLoading && <p role="status">Cargando recomendaciones…</p>}
          {profile && recommendationsError && <p className="form-error" role="alert">{recommendationsError}</p>}
          {profile && !recommendationsLoading && !recommendationsError && recommendations.length === 0 && <p>No hay recomendaciones disponibles para tu perfil en este momento.</p>}
          {profile ? <div className="home-category-grid">{recommendationGroups.filter((group) => group.items.length > 0).map((group) => (
            <section className="home-recommendation-group" key={group.label} aria-label={group.label}>
              <h3>{group.label}</h3><p className="category-count">{group.items.length} {group.items.length === 1 ? 'recomendación' : 'recomendaciones'}</p>
              <div className="opportunity-grid">
                {group.items.slice(0, 1).map(({ opportunity: item, explanation }) => (
                  <article className="opportunity-card" key={item.id}>
                    <span className="card-top"><TypeBadge type={item.type} />{savedIds.includes(item.id) && <span className="saved-label">En tu calendario</span>}</span>
                    {item.deadline && <DateLine type={item.type} deadline={item.deadline} />}
                    <h4><Link className="card-link" to={`/catalogo?search=${encodeURIComponent(item.title)}`}>{item.title}</Link></h4>
                    <p>{item.description}</p>
                    <div className="recommendation-reason"><span>Por qué te lo recomendamos</span><ul aria-label="Razones de la recomendación">{explanation.split(/(?<=\.)\s+/).filter(Boolean).map(reason => <li key={reason}>{reason.replace('Coincide con tu carrera.', 'Tu carrera').replace('Se ofrece en tu campus.', 'Tu campus').replace('Está disponible para tu periodo académico.', 'Tu periodo académico').replace('Se relaciona con tus intereses:', 'Intereses:')}</li>)}</ul></div>
                    <span className="opportunity-action" aria-hidden="true">Ver oportunidad →</span>
                  </article>
                ))}
              </div>
              <Link className="category-more" to={`/catalogo?recommended=1&types=${group.types.join(',')}`} onClick={() => sessionStorage.setItem(personaStorageKey('home-return-scroll'), String(window.scrollY))}>Ver {group.items.length === 1 ? 'la recomendación' : `las ${group.items.length} recomendaciones`} de {group.label.toLowerCase()} →</Link>
            </section>
          ))}</div> : <div className="opportunity-grid">
            {picks.map((item) => (
              <article className="opportunity-card" key={item.id}>
                <span className="card-top">
                  <TypeBadge type={item.type} />
                  {savedIds.includes(item.id) && <span className="saved-label">En tu calendario</span>}
                </span>
                {item.deadline && <DateLine type={item.type} deadline={item.deadline} />}
                <h3><Link className="card-link" to={`/catalogo?search=${encodeURIComponent(item.title)}`}>{item.title}</Link></h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>}
        </section>

      </div>
    </main>
  )
}
