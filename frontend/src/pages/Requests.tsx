import { useEffect, useState } from 'react'
import { fetchStudentRequests, type StudentRequest } from '../services/studentRequestsService'
import { AskAssistantLink } from '../components/assistant/AskAssistantLink'
import { formatShortDate } from '../utils/dates'
import './requests.css'

function KindIcon({ kind }: { kind: StudentRequest['kind'] }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'scholarship'
        ? <><path d="M3 9.5 12 5l9 4.5-9 4.5z" /><path d="M7 12v4.2c0 1 2.2 2.3 5 2.3s5-1.3 5-2.3V12" /></>
        : <><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M3 10h18M7 15h3" /></>}
    </svg>
  )
}

function RequestCard({ request }: { request: StudentRequest }) {
  const resolved = request.status === 'resolved'
  return (
    <li className={`request-card ${resolved ? 'is-resolved' : 'is-review'}`}>
      <header>
        <span className="request-icon"><KindIcon kind={request.kind} /></span>
        <div className="request-title">
          <h3>{request.title}</h3>
          <p>Atiende: {request.owner}</p>
        </div>
        <span className={`request-status ${resolved ? 'resolved' : 'review'}`}>{resolved ? 'Resuelta' : 'En revisión'}</span>
      </header>
      <p className="request-folio"><span>Folio</span><code>{request.folio}</code></p>
      <ol className="request-steps" aria-label={`Avance de ${request.title}`}>
        {request.steps.map(step => (
          <li key={step.label} className={step.done ? 'done' : 'pending'}>
            <span className="request-marker" aria-hidden="true" />
            <strong>{step.label}</strong>
            <small>{step.at ? formatShortDate(step.at) : 'Pendiente'}</small>
          </li>
        ))}
      </ol>
      {request.detail && <p className="request-detail">{request.detail}</p>}
      <p className="request-footer" role="status">
        {resolved
          ? <><strong>{request.outcome}</strong> el {formatShortDate(request.resolvedAt ?? request.submittedAt)}</>
          : <>Respuesta estimada: <strong>{request.estimatedResponse ? formatShortDate(request.estimatedResponse) : 'por confirmar'}</strong></>}
      </p>
    </li>
  )
}

export function Requests() {
  const [requests, setRequests] = useState<StudentRequest[] | undefined>()
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    fetchStudentRequests().then(value => { if (active) setRequests(value) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [])
  const inReview = requests?.filter(request => request.status === 'in-review') ?? []
  const resolved = requests?.filter(request => request.status === 'resolved') ?? []
  return (
    <main className="page requests-page">
      <div className="page-heading">
        <div>
          <h1>Mis solicitudes</h1>
          <p>Lo que has pedido en EBC y cómo va, hasta que queda resuelto.</p>
          <p className="requests-hint">Aquí solo das seguimiento. ¿Necesitas hacer otro trámite? <AskAssistantLink question="¿Qué trámites puedo hacer con Compass?">Pídeselo a Compass</AskAssistantLink>.</p>
        </div>
      </div>
      {error && <p className="form-error" role="alert">No pudimos cargar tus solicitudes. Revisa tu conexión e inténtalo de nuevo.</p>}
      {!error && requests === undefined && <p className="requests-note">Cargando tus solicitudes…</p>}
      {requests?.length === 0 && (
        <p className="requests-note">Todavía no tienes solicitudes. Cuando pidas un trámite con Compass, aparecerá aquí con su folio y su avance.</p>
      )}
      {inReview.length > 0 && <section aria-labelledby="in-review-title"><h2 id="in-review-title">En revisión</h2><ul className="request-list">{inReview.map(request => <RequestCard key={request.id} request={request} />)}</ul></section>}
      {resolved.length > 0 && <section aria-labelledby="resolved-title"><h2 id="resolved-title">Resueltas</h2><ul className="request-list">{resolved.map(request => <RequestCard key={request.id} request={request} />)}</ul></section>}
    </main>
  )
}
