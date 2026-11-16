import { useEffect, useRef } from 'react'
import type { ChatEntry } from '../../types/assistant'

interface Props {
  entries: ChatEntry[]
  pending: boolean
  onRetry: () => void
  onPickSuggestion: (text: string) => void
}

function captionFor(entry: ChatEntry): string | undefined {
  if (!entry.meta) return undefined
  const seconds = (entry.meta.latencyMs / 1000).toFixed(1)
  return entry.meta.mode === 'llm' ? `Redactada con IA · ${seconds} s` : `Respuesta por reglas · ${seconds} s`
}

export function ConversationHistory({ entries, pending, onRetry, onPickSuggestion }: Props) {
  const logRef = useRef<HTMLDivElement>(null)
  const lastRef = useRef<HTMLElement>(null)
  const lastAssistantId = [...entries].reverse().find((entry) => entry.role === 'assistant' && !entry.isError)?.id

  const last = entries[entries.length - 1]
  // Una respuesta nueva se muestra desde su inicio (para leerla de arriba abajo); lo demás, hasta el final.
  const showFromStart = last?.role === 'assistant' && !last.isError && !pending

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const log = logRef.current
    if (!log) return
    // Se desplaza solo el chat (no toda la página).
    const top = showFromStart && lastRef.current ? lastRef.current.offsetTop - 8 : log.scrollHeight
    log.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
  }, [entries, pending, showFromStart])

  return (
    <div ref={logRef} className="chat-log" role="log" aria-live="polite" aria-label="Conversación con el asistente">
      {entries.map((entry, index) => (
        <article key={entry.id} ref={index === entries.length - 1 ? lastRef : undefined} className={`chat-message ${entry.role}${entry.isError ? ' error' : ''}`} aria-label={entry.role === 'student' ? 'Tú' : 'Asistente'}>
          <span className="chat-author">{entry.role === 'student' ? 'Tú' : 'Asistente'}</span>
          <p className="chat-text">{entry.content}</p>

          {entry.isError && (
            <button type="button" className="button secondary chat-retry" onClick={onRetry} disabled={pending}>
              Reintentar
            </button>
          )}

          {entry.meta?.degraded && (
            <p className="chat-note" role="note">
              El modelo no estuvo disponible, así que respondí con reglas básicas. La información puede ser menos detallada.
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

          {captionFor(entry) && <small className="chat-caption">{captionFor(entry)}</small>}

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

      {pending && (
        <div className="chat-message assistant pending" role="status">
          <span className="chat-author">Asistente</span>
          <p className="chat-text">
            Escribiendo<span className="chat-dots" aria-hidden="true" />
          </p>
        </div>
      )}
    </div>
  )
}
