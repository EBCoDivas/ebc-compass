import { Navigate } from 'react-router-dom'
import { getToken } from '../services/authService'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { tokenClaims } from '../services/session'
import './admin.css'

type Rating = 'positive' | 'negative'
type AuditSource = { kind: 'opportunity' | 'document' | 'record'; id: string; title: string; origin?: 'vector' | 'keyword'; score?: number }
type AuditRecord = {
  id: string; createdAt: string; conversationId: string; agent: string; tools: string[]; usefulInfo: string[]; intent?: string; latencyMs: number
  guardrail: string; rating?: Rating; user?: { name: string; personaId?: string }; question?: string; answer?: string; sources?: AuditSource[]
}
type Filter = 'all' | 'chat' | 'actions' | 'blocked' | 'negative'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const REFRESH_MS = 10_000
const intents: Record<string, string> = {
  'scholarship-info': 'Becas', 'procedure-info': 'Trámites', 'recommendation-request': 'Recomendaciones', 'course-info': 'Cursos', 'event-info': 'Eventos',
  'deadline-info': 'Fechas', 'profile-help': 'Perfil', greeting: 'Saludo', help: 'Ayuda', unknown: 'Sin clasificar',
  'request-scholarship': 'Solicitud de beca', 'pay-enrollment': 'Pago de inscripción', 'generate-enrollment-slip': 'Ficha de inscripción',
}
const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' }, { id: 'chat', label: 'Chat' }, { id: 'actions', label: 'Acciones confirmadas' },
  { id: 'blocked', label: 'Bloqueadas' }, { id: 'negative', label: 'Valoración negativa' },
]
const accents = ['var(--blue)', 'var(--cyan-ink)', 'var(--lime-ink)', 'var(--gold-ink)', 'var(--coral-ink)', 'var(--navy)']
const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
const clock = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** El chat responde en Markdown; en la traza se lee como texto plano. */
const plain = (text?: string) => (text ?? '').replace(/\*\*(.+?)\*\*/g, '$1')
/** La etiqueta nombra el sistema de donde sale el dato; la herramienta MCP por la que pasó se ve aparte, en «Herramientas». */
function sourceLabel(source: AuditSource): string {
  if (source.kind === 'document') return 'Guía'
  if (source.kind === 'opportunity') return 'Banner · Catálogo'
  return source.id === 'student-route' ? 'Compass · Ruta' : 'Banner · Expediente'
}
const origins = { vector: 'Vector store', keyword: 'Respaldo por palabras' } as const

/** Las ejecuciones guardadas antes de registrar el tipo solo tienen títulos: se muestran como fuentes sin clasificar. */
const sourcesOf = (record: AuditRecord): AuditSource[] => record.sources ?? record.usefulInfo.map(title => ({ kind: 'record' as const, id: title, title }))

function SourceChip({ source }: { source: AuditSource }) {
  const legacy = source.id === source.title && source.kind === 'record'
  return (
    <li className={`admin-source ${legacy ? 'legacy' : source.kind}`}>
      {!legacy && <span className="admin-source-kind">{sourceLabel(source)}</span>}
      <span className="admin-source-title">{source.kind === 'document' ? source.id : source.title}</span>
      {source.kind === 'opportunity' && <code className="admin-source-id" title="Elemento de la tabla BannerCatalog">{source.id}</code>}
      {source.kind === 'document' && source.origin && <span className={`admin-source-origin ${source.origin}`}>{origins[source.origin]}</span>}
      {typeof source.score === 'number' && <span className="admin-source-score" title="Similitud con la pregunta">{Math.round(source.score * 100)} %</span>}
    </li>
  )
}

const isBlocked = (record: AuditRecord) => record.guardrail !== 'Permitido'
const isAction = (record: AuditRecord) => record.agent === 'Banner'
const initials = (name: string) => name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || '?'
const accentFor = (key: string) => accents[[...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % accents.length]

function ago(iso: string, now: number) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  if (Math.abs(seconds) < 45) return 'hace unos segundos'
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  return Math.abs(hours) < 24 ? relative.format(hours, 'hour') : relative.format(Math.round(hours / 24), 'day')
}

function Tile({ value, label, tone, hint }: { value: ReactNode; label: string; tone?: 'alert' | 'good'; hint?: string }) {
  return <article className={`admin-tile${tone ? ' ' + tone : ''}`}><strong>{value}</strong><span>{label}</span>{hint && <small>{hint}</small>}</article>
}

/** Mismos iconos que el chat para valorar una respuesta. */
function ThumbIcon({ rating }: { rating: Rating }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={rating === 'positive' ? 'M7 10v11H3V10h4Zm0 0 5-8a3 3 0 0 1 3 3v4h4a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7' : 'M17 14V3h4v11h-4Zm0 0-5 8a3 3 0 0 1-3-3v-4H5a2 2 0 0 1-2-2l2-8a2 2 0 0 1 2-2h10'} />
    </svg>
  )
}

function RatingMark({ rating }: { rating?: Rating }) {
  if (!rating) return null
  return <span className={`admin-rating ${rating}`} role="img" aria-label={rating === 'positive' ? 'Valoración positiva' : 'Valoración negativa'}><ThumbIcon rating={rating} /></span>
}

function Entry({ record, now, open, onToggle }: { record: AuditRecord; now: number; open: boolean; onToggle: (open: boolean) => void }) {
  const name = record.user?.name ?? 'Usuario sin nombre'
  const blocked = isBlocked(record)
  const kind = intents[record.intent ?? ''] ?? record.intent ?? 'Sin clasificar'
  return (
    <li>
      <details className={`admin-entry${blocked ? ' blocked' : ''}`} open={open} onToggle={event => onToggle(event.currentTarget.open)}>
        <summary>
          <span className="admin-avatar" style={{ background: accentFor(record.user?.personaId ?? name) }} aria-hidden="true">{initials(name)}</span>
          <span className="admin-entry-main">
            <span className="admin-entry-who"><strong>{name}</strong>{record.user?.personaId && <small>{record.user.personaId}</small>}
              <time dateTime={record.createdAt} title={new Date(record.createdAt).toLocaleString('es-MX')}>{ago(record.createdAt, now)}</time></span>
            <span className="admin-entry-question">{plain(record.question) || 'Sin mensaje registrado'}</span>
          </span>
          <span className="admin-entry-chips">
            <span className={`admin-chip agent ${isAction(record) ? 'banner' : 'compass'}`}>{isAction(record) ? 'Banner' : 'Compass'}</span>
            <span className="admin-chip topic">{kind}</span>
            {blocked && <span className="admin-chip blocked">{record.guardrail}</span>}
            <RatingMark rating={record.rating} />
            <span className="admin-latency">{(record.latencyMs / 1000).toFixed(1)} s</span>
          </span>
        </summary>
        <div className="admin-entry-body">
          <div className="admin-thread">
            <div className="admin-bubble student"><small>{name.split(' ')[0]}</small><p>{plain(record.question) || '—'}</p></div>
            <div className="admin-bubble agent"><small>{isAction(record) ? 'Banner' : 'Compass'}</small><p>{plain(record.answer) || '—'}</p></div>
          </div>
          <dl className="admin-facts">
            <div><dt>Herramientas</dt><dd>{record.tools.length
              ? <span className="admin-tools">{record.tools.map((tool, index) => <code key={tool + index}>{tool}</code>)}</span>
              : <span className="admin-none">Ninguna: respondió con reglas y su contexto</span>}</dd></div>
            <div><dt>Fuentes</dt><dd>{sourcesOf(record).length
              ? <ul className="admin-sources">{sourcesOf(record).map((source, index) => <SourceChip key={source.id + index} source={source} />)}</ul>
              : <span className="admin-none">Sin fuentes registradas</span>}</dd></div>
            <div><dt>Guardrail</dt><dd><span className={`admin-chip ${blocked ? 'blocked' : 'ok'}`}>{record.guardrail}</span></dd></div>
            <div><dt>Conversación</dt><dd><code className="admin-id">{record.conversationId}</code></dd></div>
          </dl>
        </div>
      </details>
    </li>
  )
}

export function Admin() {
  const claims = tokenClaims(getToken())
  const groups = Array.isArray(claims?.['cognito:groups']) ? claims['cognito:groups'].map(String) : []
  const isAdmin = groups.includes('admin') || claims?.['custom:role'] === 'admin'
  const [records, setRecords] = useState<AuditRecord[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [updatedAt, setUpdatedAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [filter, setFilter] = useState<Filter>('all')
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/audit`, { headers: { authorization: `Bearer ${getToken()}` }, signal })
      if (!response.ok) throw new Error()
      setRecords((await response.json() as { records: AuditRecord[] }).records)
      setState('ready')
      setUpdatedAt(Date.now())
    } catch (error) {
      if ((error as Error).name !== 'AbortError') setState(current => current === 'ready' ? current : 'error')
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    const abort = new AbortController()
    void load(abort.signal)
    const refresh = window.setInterval(() => { void load(abort.signal); setNow(Date.now()) }, REFRESH_MS)
    return () => { abort.abort(); window.clearInterval(refresh) }
  }, [isAdmin, load])

  const counts = useMemo(() => ({
    all: records.length, chat: records.filter(record => !isAction(record)).length, actions: records.filter(isAction).length,
    blocked: records.filter(isBlocked).length, negative: records.filter(record => record.rating === 'negative').length,
  }), [records])
  const visible = useMemo(() => records.filter(record => filter === 'all' || (filter === 'chat' && !isAction(record)) || (filter === 'actions' && isAction(record))
    || (filter === 'blocked' && isBlocked(record)) || (filter === 'negative' && record.rating === 'negative')), [records, filter])
  if (!isAdmin) return <Navigate to="/" replace />

  const positive = records.filter(record => record.rating === 'positive').length
  const negative = counts.negative
  const average = records.length ? records.reduce((sum, record) => sum + record.latencyMs, 0) / records.length / 1000 : 0
  const toggle = (id: string, open: boolean) => setOpenIds(current => { const next = new Set(current); if (open) next.add(id); else next.delete(id); return next })

  return <main className="page admin-page">
    <div className="page-heading">
      <div><p className="eyebrow">Administración</p><h1>Traza de Compass</h1><p>Quién preguntó, qué herramientas usó el agente y qué respondió.</p></div>
      <span className="admin-badge">Admin</span>
    </div>

    <section className="admin-tiles" aria-label="Resumen de actividad">
      <Tile value={String(records.length)} label="ejecuciones recientes" hint={`${counts.actions} acciones confirmadas`} />
      <Tile value={String(counts.blocked)} label="bloqueos del guardrail" tone={counts.blocked ? 'alert' : undefined} />
      <Tile value={positive + negative ? <span className="admin-ratings"><span className="admin-ratings-item"><ThumbIcon rating="positive" />{positive}</span><span className="admin-ratings-item"><ThumbIcon rating="negative" />{negative}</span></span> : '—'} label="valoraciones" tone={negative ? 'alert' : positive ? 'good' : undefined} />
      <Tile value={records.length ? `${average.toFixed(1)} s` : '—'} label="latencia media" />
    </section>

    <section className="admin-panel" aria-labelledby="activity-title">
      <div className="admin-panel-head">
        <div><h2 id="activity-title">Actividad reciente</h2>
          <p>Datos ficticios de la demo. Los mensajes se recortan y la traza se guarda en DynamoDB.</p></div>
        <div className="admin-refresh">
          <small aria-live="polite">{updatedAt ? `Actualizado ${clock.format(updatedAt)}` : 'Cargando…'}</small>
          <button className="button ghost" type="button" onClick={() => void load()}>Actualizar</button>
        </div>
      </div>

      <div className="admin-filters" role="group" aria-label="Filtrar actividad">
        {filters.map(item => <button key={item.id} type="button" className={`admin-filter${filter === item.id ? ' active' : ''}`} aria-pressed={filter === item.id}
          onClick={() => setFilter(item.id)}>{item.label}<span>{counts[item.id]}</span></button>)}
      </div>

      {state === 'error' && <p className="admin-state error" role="alert">No pudimos cargar la traza. Revisa que el servidor esté en marcha y pulsa Actualizar.</p>}
      {state === 'loading' && <p className="admin-state">Cargando la traza…</p>}
      {state === 'ready' && !records.length && <p className="admin-state">Todavía no hay ejecuciones. Haz una pregunta desde Compass o confirma un pago o una beca, y aparecerá aquí.</p>}
      {state === 'ready' && records.length > 0 && !visible.length && <p className="admin-state">Ninguna ejecución coincide con este filtro.</p>}
      {visible.length > 0 && <ol className="admin-list">{visible.map(record => <Entry key={record.id} record={record} now={now} open={openIds.has(record.id)} onToggle={open => toggle(record.id, open)} />)}</ol>}
    </section>
  </main>
}
