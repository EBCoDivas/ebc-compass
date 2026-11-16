import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchOpportunities, type Opportunity } from '../services/opportunityService'
import { assistantPath } from '../services/assistantService'
import { TypeBadge } from '../components/TypeBadge'
import { formatDate } from '../utils/dates'
import { dateLabelFor, typeMeta } from '../utils/opportunityTypes'

const typeOptions = [['', 'Todos'], ...Object.entries(typeMeta).map(([value, meta]) => [value, meta.plural])]

export function Catalog() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [type, setType] = useState('')
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('search') ?? '')
  const [sort, setSort] = useState<'relevance' | 'date'>('relevance')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Opportunity | null>(null)
  const [savedMessage, setSavedMessage] = useState('')
  const [saved, setSaved] = useState<string[]>(() => JSON.parse(window.localStorage.getItem('ebc_compass_saved_opportunities') ?? '[]') as string[])
  useEffect(() => { setError(''); fetchOpportunities({ type, search }).then((list) => { setItems(list); setLoaded(true) }).catch(() => { setItems([]); setError('No se pudo cargar el catálogo. Verifica tu conexión e inténtalo de nuevo.') }) }, [type, search])
  const visible = sort === 'date' ? [...items].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999')) : items
  function toggleSaved(id: string) {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id]
    setSaved(next)
    window.localStorage.setItem('ebc_compass_saved_opportunities', JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('ebc-saved-opportunities', { detail: next }))
    setSavedMessage(next.includes(id) ? 'Oportunidad guardada correctamente.' : 'Oportunidad quitada de guardadas.')
  }
  return <main className="page"><div className="page-heading"><p className="eyebrow">EXPLORA OPORTUNIDADES</p><h1>Oportunidades</h1><p>Cursos, becas, eventos y trámites en un solo lugar.</p></div><div className="catalog-controls"><input aria-label="Buscar oportunidades" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por palabra clave" /><select aria-label="Ordenar" value={sort} onChange={(event) => setSort(event.target.value as 'relevance' | 'date')}><option value="relevance">Orden: relevancia</option><option value="date">Orden: fecha más próxima</option></select></div><div className="chip-row" role="group" aria-label="Filtrar por tipo">{typeOptions.map(([value, label]) => <button type="button" key={value} className={`chip${type === value ? ' selected' : ''}`} aria-pressed={type === value} onClick={() => setType(value)}>{label}</button>)}</div><p className="result-count" role="status">{loaded ? `${items.length} ${items.length === 1 ? 'resultado' : 'resultados'}` : 'Cargando…'}</p>{error && <p className="form-error" role="alert">{error}</p>}{savedMessage && <p className="save-confirmation" role="status">{savedMessage}</p>}<div className="opportunity-grid">{visible.map((item) => <button className="opportunity-card opportunity-card-button" key={item.id} onClick={() => { setSelected(item); setSavedMessage('') }}><TypeBadge type={item.type} /><h2>{item.title}</h2><p>{item.description}</p>{item.location && <small>{item.location}</small>}{item.deadline && <small>{dateLabelFor(item.type)}: {formatDate(item.deadline)}</small>}<span className="card-action">Ver detalles {saved.includes(item.id) ? '· Guardada' : '→'}</span></button>)}{loaded && items.length === 0 && !error && <p>No se encontraron oportunidades con esos filtros.</p>}</div>{selected && <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="opportunity-title"><button className="modal-close" aria-label="Cerrar detalle" onClick={() => setSelected(null)}>×</button><TypeBadge type={selected.type} /><h2 id="opportunity-title">{selected.title}</h2><p>{selected.description}</p>{selected.location && <p><strong>Ubicación:</strong> {selected.location}</p>}{selected.deadline && <p><strong>{dateLabelFor(selected.type)}:</strong> {formatDate(selected.deadline)}</p>}<button className="button primary" onClick={() => toggleSaved(selected.id)}>{saved.includes(selected.id) ? 'Quitar de guardadas' : 'Guardar para después'}</button> <Link className="button secondary" to={assistantPath(`Cuéntame sobre ${selected.title}`)}>Preguntar al asistente</Link></section></div>}</main>
}
