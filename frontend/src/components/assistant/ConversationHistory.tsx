import { useEffect, useRef, useState } from 'react'
import { AssistantError, saveFeedback } from '../../services/assistantService'
import { Markdown } from './Markdown'
import type { ChatEntry } from '../../types/assistant'

interface Props {
  entries: ChatEntry[]
  pending: boolean
  onRetry: (entry: ChatEntry) => void
  onPickSuggestion: (text: string) => void
}

function captionFor(entry: ChatEntry): string | undefined {
  if (!entry.meta) return undefined
  const seconds = (entry.meta.latencyMs / 1000).toFixed(1)
  return `${seconds} s`
}

export function ConversationHistory({ entries, pending, onRetry, onPickSuggestion }: Props) {
  const [copiedId, setCopiedId] = useState('')
  const [copyNotice, setCopyNotice] = useState('')
  const [feedback, setFeedback] = useState<Record<string, 'positive' | 'negative' | null>>({})
  const [savingFeedback, setSavingFeedback] = useState<Record<string, boolean>>({})
  const [feedbackError, setFeedbackError] = useState<Record<string, string>>({})
  const feedbackLock = useRef(new Set<string>())
  // Respuestas que el servidor reporta como ya valoradas (por ejemplo, desde otra pestaña).
  const [alreadyRated, setAlreadyRated] = useState<Record<string, boolean>>({})
  const ratingFor = (entry: ChatEntry) => Object.hasOwn(feedback, entry.id) ? feedback[entry.id] : entry.feedback
  // Una respuesta se valora una sola vez: después ya no se puede cambiar ni volver a enviar.
  async function rate(entry: ChatEntry, rating: 'positive' | 'negative') {
    if (feedbackLock.current.has(entry.id) || ratingFor(entry) || alreadyRated[entry.id]) return
    feedbackLock.current.add(entry.id)
    setSavingFeedback(current => ({ ...current, [entry.id]: true }))
    setFeedbackError(current => ({ ...current, [entry.id]: '' }))
    const next = rating
    try {
      await saveFeedback(entry.id, next)
      setFeedback(current => ({ ...current, [entry.id]: next }))
    } catch (error) {
      if (error instanceof AssistantError && error.code === 'FEEDBACK_ALREADY_SET') setAlreadyRated(current => ({ ...current, [entry.id]: true }))
      else setFeedbackError(current => ({ ...current, [entry.id]: 'No se pudo guardar tu valoración. Intenta otra vez.' }))
    }
    finally { feedbackLock.current.delete(entry.id); setSavingFeedback(current => ({ ...current, [entry.id]: false })) }
  }
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(copyTimer.current), [])
  const logRef = useRef<HTMLDivElement>(null)
  const lastRef = useRef<HTMLElement>(null)
  const lastAssistantId = [...entries].reverse().find((entry) => entry.role === 'assistant' && !entry.isError)?.id

  const followRef = useRef(true)
  const lastStudentId = [...entries].reverse().find(entry => entry.role === 'student')?.id
  const previousStudent = useRef(lastStudentId)

  async function copy(entry: ChatEntry) {
    try {
      await navigator.clipboard.writeText(entry.content)
      setCopiedId(entry.id)
      setCopyNotice('Respuesta copiada.')
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => { setCopiedId(''); setCopyNotice('') }, 2000)
    } catch {
      setCopiedId('')
      setCopyNotice('No se pudo copiar. Selecciona el texto y cópialo manualmente.')
    }
  }

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const log = logRef.current
    if (!log) return
    if (previousStudent.current !== lastStudentId) {
      followRef.current = true
      previousStudent.current = lastStudentId
    }
    if (followRef.current) log.scrollTo({ top: log.scrollHeight, behavior: pending || reduce ? 'auto' : 'smooth' })
  }, [entries, pending, lastStudentId])

  return (
    <div ref={logRef} className="chat-log" onScroll={() => { const log = logRef.current; if (log) followRef.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80 }} role="log" aria-live="off" aria-label="Conversación con el asistente">
      <p className="visually-hidden" role="status">{copyNotice}</p>
      {entries.map((entry, index) => (
        <article key={entry.id} ref={index === entries.length - 1 ? lastRef : undefined} className={`chat-message ${entry.role}${entry.isError || entry.failure ? ' error' : ''}`} aria-label={entry.role === 'student' ? 'Tú' : 'Compass'}>
          <span className="chat-author">{entry.role === 'student' ? 'Tú' : 'Compass'}</span>
          {entry.role === 'assistant' && !entry.isError ? <Markdown>{entry.content}</Markdown> : <p className="chat-text">{entry.content}</p>}

          {entry.isStreaming && !entry.content && <p className="chat-text">Pensando…</p>}
          {entry.interrupted && <p className="chat-caption">Respuesta detenida.</p>}
          {entry.streamError && <p className="form-error">{entry.streamError}</p>}
          {entry.meta?.historyStatus === 'pending' && <p className="chat-note" role="note">El historial está pendiente de guardarse. Se reintentará al continuar la conversación.</p>}
          {(entry.isError || entry.streamError || entry.failure) && index === entries.length - 1 && (
            <button type="button" className="button secondary chat-retry" onClick={() => onRetry(entry)} disabled={pending}>
              Reintentar
            </button>
          )}

          {entry.failure && entry.catalogFallback && (
            <details className="chat-catalog-fallback">
              <summary>Ver oportunidades del catálogo</summary>
              <p className="chat-note">Resultados del catálogo demo seleccionados por filtros. No son una respuesta generada por IA.</p>
              <Markdown>{entry.catalogFallback.content}</Markdown>
            </details>
          )}

          {entry.meta?.degraded && !entry.failure && !entry.interrupted && (
            <p className="chat-note" role="note">
              No pudimos consultar los documentos de apoyo. Esta respuesta usa la información disponible del catálogo.
            </p>
          )}

          {entry.sources && entry.sources.length > 0 && (
            <div className="chat-sources">
              <span>Fuentes:</span>
              <ul>
                {[...new Map(entry.sources.map((source) => [source.title, source])).values()].map((source) => (
                  <li key={`${source.kind}-${source.id}`} className={source.kind}>
                    {source.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {entry.role === 'assistant' && !entry.isError && !entry.failure && !entry.streamError && !entry.isStreaming && Boolean(entry.content) && (
            <div className="chat-actions">
              <button type="button" className="chat-icon-button" onClick={() => void copy(entry)} aria-label={copiedId === entry.id ? 'Respuesta copiada' : 'Copiar respuesta'} title={copiedId === entry.id ? 'Respuesta copiada' : 'Copiar respuesta'}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {copiedId === entry.id ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" /></>}
                </svg>
              </button>
              <div className={`chat-feedback${ratingFor(entry) && !savingFeedback[entry.id] ? ` rated ${ratingFor(entry)}` : ''}`} role="group" aria-label="¿Te fue útil esta respuesta?">
                <button type="button" className="chat-icon-button feedback-up" aria-label="Respuesta útil" title="Respuesta útil" disabled={savingFeedback[entry.id] || pending || Boolean(ratingFor(entry)) || alreadyRated[entry.id]} aria-pressed={ratingFor(entry) === 'positive'} onClick={() => void rate(entry, 'positive')}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 10v11H3V10h4Zm0 0 5-8a3 3 0 0 1 3 3v4h4a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7" />
                  </svg>
                </button>
                <button type="button" className="chat-icon-button feedback-down" aria-label="Respuesta poco útil" title="Respuesta poco útil" disabled={savingFeedback[entry.id] || pending || Boolean(ratingFor(entry)) || alreadyRated[entry.id]} aria-pressed={ratingFor(entry) === 'negative'} onClick={() => void rate(entry, 'negative')}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 14V3h4v11h-4Zm0 0-5 8a3 3 0 0 1-3-3v-4H5a2 2 0 0 1-2-2l2-8a2 2 0 0 1 2-2h10" />
                  </svg>
                </button>
                {ratingFor(entry) && !savingFeedback[entry.id] && <small className="chat-feedback-note" role="status">Gracias, tu valoración quedó guardada.</small>}
              </div>
              {savingFeedback[entry.id] && <small role="status">Guardando…</small>}
              {alreadyRated[entry.id] && <small className="chat-feedback-note">Ya habías valorado esta respuesta.</small>}
              {feedbackError[entry.id] && <small role="alert" className="form-error">{feedbackError[entry.id]}</small>}
              {captionFor(entry) && <small className="chat-caption" aria-label={`Tiempo de respuesta: ${captionFor(entry)}`}>{captionFor(entry)}</small>}
            </div>
          )}

          {entry.id === lastAssistantId && entry.suggestions && entry.suggestions.length > 0 && !pending && (
            <div className="chat-followups" aria-label="Preguntas sugeridas">
              {entry.suggestions.map((text) => (
                <button type="button" key={text} onClick={() => onPickSuggestion(text)}>
                  {text}
                </button>
              ))}
            </div>
          )}
        </article>
      ))}

      {pending && !entries.some(entry => entry.isStreaming) && (
        <div className="chat-message assistant pending" role="status">
          <span className="chat-author">Compass</span>
          <p className="chat-text">
            Escribiendo<span className="chat-dots" aria-hidden="true" />
          </p>
        </div>
      )}
    </div>
  )
}
