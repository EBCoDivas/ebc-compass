import { Navigate } from 'react-router-dom'
import { getToken } from '../services/authService'
import { useEffect, useState } from 'react'
import { tokenClaims } from '../services/session'

type Trace = { time: string; conversation: string; agent: string; tool: string; usefulInfo: string; latency: string; guardrail: string; rating: string }
type AuditRecord = { createdAt: string; conversationId: string; agent: string; tools: string[]; usefulInfo: string[]; intent?: string; latencyMs: number; guardrail: string; rating?: 'positive' | 'negative' }
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export function Admin() {
  const claims = tokenClaims(getToken())
  const groups = Array.isArray(claims?.['cognito:groups']) ? claims['cognito:groups'].map(String) : []
  if (!groups.includes('admin') && claims?.['custom:role'] !== 'admin') return <Navigate to="/" replace />
  const [traces, setTraces] = useState<Trace[]>([])
  useEffect(() => { fetch(`${API_URL}/api/admin/audit`, { headers: { authorization: `Bearer ${getToken()}` } }).then(r => r.ok ? r.json() as Promise<{ records: AuditRecord[] }> : Promise.reject()).then(data => setTraces(data.records.map((item) => ({ time: new Date(item.createdAt).toLocaleString('es-MX'), conversation: item.conversationId, agent: `${item.agent}${item.intent ? ` · ${item.intent}` : ''}`, tool: item.tools.join(', ') || 'Sin herramientas', usefulInfo: item.usefulInfo.join(' · ') || 'Sin fuentes registradas', latency: `${(item.latencyMs / 1000).toFixed(1)} s`, guardrail: item.guardrail, rating: item.rating === 'positive' ? '👍' : item.rating === 'negative' ? '👎' : '—' })))).catch(() => undefined) }, [])
  const blockedCount = traces.filter(trace => trace.guardrail !== 'Permitido').length
  const rated = traces.filter(trace => trace.rating !== '—')
  const negativeRate = rated.length ? Math.round((rated.filter(trace => trace.rating === '👎').length / rated.length) * 100) : 0
  return <main className="page admin-page">
    <div className="page-heading"><div><p className="eyebrow">Administración</p><h1>Traza de Compass</h1><p>Observa las ejecuciones recientes y los bloqueos del guardrail.</p></div><span className="admin-badge">Admin</span></div>
    <section className="admin-summary" aria-label="Resumen de actividad">
      <article><strong>{traces.length}</strong><span>ejecuciones recientes</span></article><article><strong>{blockedCount}</strong><span>bloqueos del guardrail</span></article><article><strong>{negativeRate}%</strong><span>valoraciones negativas</span></article>
    </section>
    <section className="panel-card"><div className="panel-card-heading"><div><h2>Actividad reciente</h2><p>Datos ficticios de la demo; no se muestran preguntas completas ni información sensible.</p></div><button className="button ghost" type="button" onClick={() => window.location.reload()}>Actualizar</button></div>
      <div className="trace-table-wrap">{traces.length ? <table className="trace-table"><thead><tr><th>Hora</th><th>Conversación</th><th>Agente / herramientas</th><th>Información útil</th><th>Latencia</th><th>Guardrail</th><th>Valoración</th></tr></thead><tbody>{traces.map((trace) => <tr key={trace.time + trace.conversation}><td>{trace.time}</td><td><strong>{trace.conversation}</strong></td><td>{trace.agent}<small>{trace.tool}</small></td><td>{trace.usefulInfo}</td><td>{trace.latency}</td><td><span className={trace.guardrail === 'Permitido' ? 'status-ok' : 'status-blocked'}>{trace.guardrail}</span></td><td>{trace.rating}</td></tr>)}</tbody></table> : <p className="admin-empty">Todavía no hay ejecuciones registradas. Envía una pregunta desde Compass y pulsa Actualizar.</p>}</div>
    </section>
    <p className="admin-note">El panel es una primera vista de demostración. La conexión a un repositorio de trazas persistente se puede incorporar después.</p>
  </main>
}
