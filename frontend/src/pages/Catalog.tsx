import { useEffect, useState } from 'react'
import { fetchOpportunities, type Opportunity } from '../services/opportunityService'

const labels = { all: 'Todos', course: 'Cursos', scholarship: 'Becas', event: 'Eventos', procedure: 'Procedimientos' }

export function Catalog() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => { fetchOpportunities({ type, search }).then(setItems).catch(() => setItems([])) }, [type, search])
  return <main className="page"><div className="page-heading"><p className="eyebrow">EXPLORA OPORTUNIDADES</p><h1>Catálogo</h1><p>Cursos, becas, eventos y procedimientos en un solo lugar.</p></div><div className="catalog-controls"><input aria-label="Buscar oportunidades" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por palabra clave" /><select aria-label="Filtrar por tipo" value={type} onChange={(event) => setType(event.target.value)}>{Object.entries(labels).map(([value, label]) => <option value={value === 'all' ? '' : value} key={value}>{label}</option>)}</select></div><div className="opportunity-grid">{items.map((item) => <article className="opportunity-card" key={item.id}><span className="badge">{labels[item.type]}</span><h2>{item.title}</h2><p>{item.description}</p>{item.location && <small>{item.location}</small>}{item.deadline && <small>Fecha límite: {item.deadline}</small>}</article>)}{items.length === 0 && <p>No se encontraron oportunidades con esos filtros.</p>}</div></main>
}
