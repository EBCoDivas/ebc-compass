import { useEffect, useState } from 'react'
import { fetchOpportunities, type Opportunity } from '../services/opportunityService'

const labels = { all: 'Todos', course: 'Cursos', scholarship: 'Becas', event: 'Eventos', procedure: 'Procedimientos' }

export function Catalog() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Opportunity | null>(null)
  const [saved, setSaved] = useState<string[]>(() => JSON.parse(window.localStorage.getItem('ebc_compass_saved_opportunities') ?? '[]') as string[])
  useEffect(() => { fetchOpportunities({ type, search }).then(setItems).catch(() => setItems([])) }, [type, search])
  function toggleSaved(id: string) {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id]
    setSaved(next)
    window.localStorage.setItem('ebc_compass_saved_opportunities', JSON.stringify(next))
  }
  return <main className="page"><div className="page-heading"><p className="eyebrow">EXPLORA OPORTUNIDADES</p><h1>Catálogo</h1><p>Cursos, becas, eventos y procedimientos en un solo lugar.</p></div><div className="catalog-controls"><input aria-label="Buscar oportunidades" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por palabra clave" /><select aria-label="Filtrar por tipo" value={type} onChange={(event) => setType(event.target.value)}>{Object.entries(labels).map(([value, label]) => <option value={value === 'all' ? '' : value} key={value}>{label}</option>)}</select></div><div className="opportunity-grid">{items.map((item) => <button className="opportunity-card opportunity-card-button" key={item.id} onClick={() => setSelected(item)}><span className="badge">{labels[item.type]}</span><h2>{item.title}</h2><p>{item.description}</p>{item.location && <small>{item.location}</small>}{item.deadline && <small>Fecha límite: {item.deadline}</small>}<span className="card-action">Ver detalles {saved.includes(item.id) ? '· Guardada' : '→'}</span></button>)}{items.length === 0 && <p>No se encontraron oportunidades con esos filtros.</p>}</div>{selected && <div className="modal-backdrop" role="presentation" onClick={() => setSelected(null)}><section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="opportunity-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Cerrar detalle" onClick={() => setSelected(null)}>×</button><span className="badge">{labels[selected.type]}</span><h2 id="opportunity-title">{selected.title}</h2><p>{selected.description}</p>{selected.location && <p><strong>Ubicación:</strong> {selected.location}</p>}{selected.deadline && <p><strong>Fecha límite:</strong> {selected.deadline}</p>}<button className="button primary" onClick={() => toggleSaved(selected.id)}>{saved.includes(selected.id) ? 'Quitar de guardadas' : 'Guardar para después'}</button></section></div>}</main>
}
