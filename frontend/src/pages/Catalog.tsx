import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { fetchOpportunities, fetchRecommendations, fetchStudentPlanning, type Opportunity } from '../services/opportunityService'
import { toggleSaved, useSavedOpportunities } from '../services/savedOpportunities'
import { sessionSubject } from '../services/session'
import { loadProfile } from '../services/profileService'
import { AskAssistantLink } from '../components/assistant/AskAssistantLink'
import { TypeBadge } from '../components/TypeBadge'
import { DateLine } from '../components/DateLine'
import { daysLabel, daysUntil, formatShortDate, urgencyFor } from '../utils/dates'
import { dateLabelFor, typeMeta } from '../utils/opportunityTypes'

/** Próximas primero (de la más cercana a la más lejana), luego vencidas y al final las que no tienen fecha. */
function byNearestDate(a: Opportunity, b: Opportunity) {
  const rank = (item: Opportunity) => !item.deadline ? 2 : daysUntil(item.deadline) < 0 ? 1 : 0
  return rank(a) - rank(b) || (a.deadline ?? '').localeCompare(b.deadline ?? '')
}

const typeOptions = [['', 'Todos'], ...Object.entries(typeMeta).map(([value, meta]) => [value, meta.plural])]
const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', currencyDisplay: 'code' })

function OpportunityDetails({ item }: { item: Opportunity }) {
  const requirements = [...(item.requirements ?? [])]
  if (item.scholarshipCriteria) requirements.push(`Promedio de bachillerato de al menos ${item.scholarshipCriteria.minimumHighSchoolGpa}/10`)
  return <>
    {requirements.length > 0 && <>
      <h3>Requisitos</h3>
      <ul>{requirements.map(requirement => <li key={requirement}>{requirement}</li>)}</ul>
    </>}
    {item.enrollmentFee && <p>Tarifa de inscripción: <strong>{pesos.format(item.enrollmentFee.amount)}</strong></p>}
    {item.schedule && <p>Horario: <strong>{item.schedule.days.join(', ')} de {item.schedule.start} a {item.schedule.end}</strong></p>}
  </>
}

export function Catalog() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [recommendedOnly, setRecommendedOnly] = useState(() => new URLSearchParams(window.location.search).get('recommended') === '1')
  const [type, setType] = useState(() => new URLSearchParams(window.location.search).get('types') ?? '')
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('search') ?? '')
  const [sort, setSort] = useState<'relevance' | 'date'>('relevance')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Opportunity | null>(null)
  const [savedMessage, setSavedMessage] = useState<'' | 'added' | 'removed'>('')
  const saved = useSavedOpportunities()
  const [savedOnly, setSavedOnly] = useState(false)
  // Lo obligatorio de la ruta ya está en el calendario: no se ofrece guardarlo.
  const [requiredIds, setRequiredIds] = useState<string[]>([])
  useEffect(() => {
    if (!sessionSubject()) return
    let active = true
    fetchStudentPlanning().then(planning => { if (active) setRequiredIds(planning.route.filter(item => item.required).map(item => item.opportunityId)) }).catch(() => undefined)
    return () => { active = false }
  }, [])
  useEffect(() => {
    let active = true
    setError(''); setLoaded(false)
    const profile = loadProfile()
    const source = recommendedOnly
      ? (profile ? fetchRecommendations(profile).then(list => list.map(item => item.opportunity)) : Promise.resolve([]))
      : fetchOpportunities({ search, career: profile?.career || undefined, campus: profile?.campus || undefined,
          semester: typeof profile?.currentSemester === 'number' ? profile.currentSemester : undefined })
    source.then(list => {
      if (!active) return
      setItems(list.filter(item => (!type || type.split(',').includes(item.type)) && (!search || `${item.title} ${item.description}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))))
      setLoaded(true)
    }).catch(() => { if (active) { setItems([]); setError('No se pudo cargar el catálogo. Intenta de nuevo.'); setLoaded(true) } })
    return () => { active = false }
  }, [type, search, recommendedOnly])
  // "Recomendadas primero": lo que el motor de recomendaciones elige para tu perfil, y después por fecha.
  const [recommendedIds, setRecommendedIds] = useState<string[]>([])
  useEffect(() => {
    const profile = loadProfile()
    if (!profile) return
    fetchRecommendations({ career: profile.career, currentSemester: profile.currentSemester, interests: profile.interests, campus: profile.campus })
      .then(list => setRecommendedIds(list.map(item => item.opportunity.id))).catch(() => setRecommendedIds([]))
  }, [])
  const recommendedRank = (item: Opportunity) => { const index = recommendedIds.indexOf(item.id); return index < 0 ? Number.MAX_SAFE_INTEGER : index }
  const visible = items.filter(item => !savedOnly || saved.includes(item.id)).sort(sort === 'date' ? byNearestDate : (a, b) => recommendedRank(a) - recommendedRank(b) || byNearestDate(a, b))
  function handleToggle(id: string) {
    setSavedMessage(toggleSaved(id) ? 'added' : 'removed')
  }
  const savedFeedback = savedMessage === 'added'
    ? <>Agregada a tu calendario y a tu rumbo de Inicio. <Link to="/calendario">Ver en el calendario</Link></>
    : 'La quitaste de tu calendario.'
  const cardLabel = (id: string) => requiredIds.includes(id) ? <span className="route-tag required">Obligatorio</span> : saved.includes(id) ? <span className="saved-label">En tu calendario</span> : null
  return <main className="page"><div className="page-heading"><h1>{recommendedOnly ? 'Recomendaciones para ti' : 'Oportunidades'}</h1>{recommendedOnly && <p><Link to="/">Volver a Inicio</Link> · <button type="button" className="recommendations-expand" onClick={() => { setRecommendedOnly(false); setType('') }}>Explorar todo el catálogo</button></p>}<p>Cursos, becas, eventos y trámites en un solo lugar.</p></div><div className="catalog-controls"><input aria-label="Buscar oportunidades" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por palabra clave" /><select aria-label="Ordenar" value={sort} onChange={(event) => setSort(event.target.value as 'relevance' | 'date')}><option value="relevance">Orden: recomendadas primero</option><option value="date">Orden: fecha más próxima</option></select></div><div className="chip-row" role="group" aria-label="Filtrar por tipo">{typeOptions.map(([value, label]) => <button type="button" key={value} className={`chip${type === value ? ' selected' : ''}`} aria-pressed={type === value} onClick={() => setType(value)}>{label}</button>)}<button type="button" className={`chip chip-saved${savedOnly ? ' selected' : ''}`} aria-pressed={savedOnly} onClick={() => setSavedOnly(value => !value)}>Guardadas ({saved.length})</button></div><p className="result-count" role="status">{loaded ? `${visible.length} ${visible.length === 1 ? 'resultado' : 'resultados'}` : 'Cargando…'}</p>{error && <p className="form-error" role="alert">{error}</p>}{savedMessage && !selected && <p className="save-confirmation" role="status">{savedFeedback}</p>}<div className="opportunity-grid">{visible.map((item) => <button className="opportunity-card opportunity-card-button" key={item.id} onClick={() => { setSelected(item); setSavedMessage('') }}><span className="card-top"><TypeBadge type={item.type} />{cardLabel(item.id)}</span>{item.deadline && <DateLine type={item.type} deadline={item.deadline} />}<h2>{item.title}</h2><p>{item.description}</p>{item.location && <small>{item.location}</small>}</button>)}{loaded && visible.length === 0 && !error && <p className="empty-results">{savedOnly ? 'Todavía no agregas oportunidades a tu calendario. Abre una y elige «Agregar a mi calendario».' : 'No hay oportunidades con esos filtros. Prueba otra palabra o elige «Todos».'}</p>}</div>{selected && <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="opportunity-title"><button className="modal-close" aria-label="Cerrar detalle" onClick={() => setSelected(null)}>×</button><TypeBadge type={selected.type} /><h2 id="opportunity-title">{selected.title}</h2><p>{selected.description}</p><OpportunityDetails item={selected} />{selected.location && <p><strong>Ubicación:</strong> {selected.location}</p>}{selected.deadline && <p className="modal-date"><strong>{dateLabelFor(selected.type)}:</strong> {formatShortDate(selected.deadline)} <span className={`days-left ${urgencyFor(daysUntil(selected.deadline))}`}>{daysLabel(daysUntil(selected.deadline))}</span></p>}<div className="modal-actions">{requiredIds.includes(selected.id) ? <p className="modal-note">Es obligatoria: ya está en tu calendario.</p> : <button className="button primary" onClick={() => handleToggle(selected.id)}>{saved.includes(selected.id) ? 'Quitar de mi calendario' : 'Agregar a mi calendario'}</button>}<AskAssistantLink className="button secondary" question={`Cuéntame sobre ${selected.title}`} onOpenDock={() => setSelected(null)}>Preguntar a Compass</AskAssistantLink></div>{savedMessage && <p className="save-confirmation modal-confirmation" role="status">{savedFeedback}</p>}</section></div>}</main>
}
