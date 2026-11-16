import { useEffect, useState } from 'react'
import { fetchOpportunities, type Opportunity } from '../services/opportunityService'

const STORAGE_KEY = 'ebc_compass_saved_opportunities'
const labels = { course: 'Curso', scholarship: 'Beca', 'professional-development': 'Desarrollo profesional', event: 'Evento', procedure: 'Procedimiento', 'career-opportunity': 'Oportunidad laboral' }

export function Saved() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [savedIds, setSavedIds] = useState<string[]>(() => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as string[])

  useEffect(() => {
    fetchOpportunities().then((all) => setItems(all.filter((item) => savedIds.includes(item.id)))).catch(() => setItems([]))
  }, [savedIds])

  function remove(id: string) {
    const next = savedIds.filter((savedId) => savedId !== id)
    setSavedIds(next)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return <main className="page"><div className="page-heading"><p className="eyebrow">TU SEGUIMIENTO</p><h1>Guardadas</h1><p>Consulta las oportunidades que quieres revisar después.</p></div>{items.length === 0 ? <section className="welcome-card"><h2>Aún no tienes oportunidades guardadas</h2><p>Explora el catálogo y selecciona “Guardar para después” en cualquier oportunidad.</p></section> : <div className="opportunity-grid">{items.map((item) => <article className="opportunity-card" key={item.id}><span className="badge">{labels[item.type]}</span><h2>{item.title}</h2><p>{item.description}</p>{item.location && <small>{item.location}</small>}{item.deadline && <small>Fecha límite: {item.deadline}</small>}<button className="button secondary saved-remove" onClick={() => remove(item.id)}>Quitar de guardadas</button></article>)}</div>}</main>
}
