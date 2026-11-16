import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ConversationHistory } from '../components/assistant/ConversationHistory'
import { QueryInput } from '../components/assistant/QueryInput'
import { SuggestedQuestions } from '../components/assistant/SuggestedQuestions'
import { AssistantError, MAX_MESSAGE_LENGTH, clearConversation, fetchSuggestions, loadConversation, sendMessage } from '../services/assistantService'
import { loadProfile, profileCompleteness } from '../services/profileService'
import type { ChatEntry } from '../types/assistant'
import '../components/assistant/assistant.css'

export function Assistant() {
  const profile = useMemo(() => loadProfile(), [])
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [lastQuestion, setLastQuestion] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    let active = true
    loadConversation().then((messages) => {
      if (!active) return
      setEntries(messages.map((message) => ({ id: message.id, role: message.role, content: message.content })))
      setLoading(false)
    })
    fetchSuggestions('es').then((list) => active && setSuggestions(list))
    return () => {
      active = false
    }
  }, [])

  // Pregunta enviada desde otra pantalla (p. ej. "Preguntar al asistente"): se precarga para revisarla y enviarla.
  const incoming = searchParams.get('q')
  useEffect(() => {
    if (!incoming) return
    setDraft(incoming.slice(0, MAX_MESSAGE_LENGTH))
    setSearchParams({}, { replace: true })
    inputRef.current?.focus()
  }, [incoming, setSearchParams])

  const ask = useCallback(
    async (message: string, options: { showQuestion: boolean }) => {
      setNotice('')
      setLastQuestion(message)
      setPending(true)
      setEntries((current) => {
        const withoutError = current.filter((entry) => !entry.isError)
        return options.showQuestion ? [...withoutError, { id: crypto.randomUUID(), role: 'student', content: message }] : withoutError
      })
      try {
        const reply = await sendMessage(message, profile)
        setEntries((current) => [
          ...current,
          {
            id: reply.message.id,
            role: 'assistant',
            content: reply.message.content,
            sources: reply.message.sources,
            suggestions: reply.message.suggestions,
            meta: reply.meta,
          },
        ])
      } catch (error) {
        const text = error instanceof AssistantError ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.'
        setEntries((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: text, isError: true }])
      } finally {
        setPending(false)
        inputRef.current?.focus()
      }
    },
    [profile],
  )

  function submit(message: string) {
    setDraft('')
    void ask(message, { showQuestion: true })
  }

  function pick(text: string) {
    setDraft(text)
    inputRef.current?.focus()
  }

  async function clear() {
    if (!window.confirm('¿Borrar esta conversación? Se eliminará también del servidor.')) return
    try {
      await clearConversation()
      setEntries([])
      setNotice('')
      fetchSuggestions('es').then(setSuggestions)
    } catch (error) {
      setNotice(error instanceof AssistantError ? error.message : 'No fue posible borrar la conversación.')
    }
  }

  const incomplete = !profile || profileCompleteness(profile) < 100

  return (
    <main className="page assistant-page">
      <div className="page-heading">
        <p className="eyebrow">TU ASISTENTE</p>
        <h1>Asistente EBC Compass</h1>
        <p>Pregúntame sobre becas, cursos, trámites, eventos y fechas importantes, en español o en inglés.</p>
      </div>

      {incomplete && (
        <p className="institutional-note assistant-profile-hint">
          <strong>Respuestas más personalizadas</strong>
          <span>
            {profile ? 'Completa tu perfil' : 'Crea tu perfil'} para que tenga en cuenta tu carrera y semestre. <Link to="/perfil">Ir a mi perfil</Link>
          </span>
        </p>
      )}

      <section className="chat-card" aria-label="Chat con el asistente">
        <div className="chat-toolbar">
          <span>Respuestas orientativas: para decisiones oficiales consulta a Servicios Escolares.</span>
          {entries.length > 0 && (
            <button type="button" className="button secondary" onClick={clear} disabled={pending}>
              Borrar conversación
            </button>
          )}
        </div>

        {loading ? (
          <p className="chat-empty" role="status">
            Cargando conversación…
          </p>
        ) : entries.length === 0 ? (
          <div className="chat-empty">
            <p>
              <strong>¡Hola{profile?.name ? `, ${profile.name}` : ''}!</strong> Soy el asistente de EBC Compass. ¿En qué te ayudo?
            </p>
            <SuggestedQuestions suggestions={suggestions} onPick={pick} />
          </div>
        ) : (
          <ConversationHistory entries={entries} pending={pending} onRetry={() => void ask(lastQuestion, { showQuestion: false })} onPickSuggestion={pick} />
        )}

        {pending && entries.length === 0 && <p role="status" className="chat-empty">Escribiendo…</p>}
        {notice && (
          <p className="form-error chat-notice" role="alert">
            {notice}
          </p>
        )}

        <QueryInput ref={inputRef} value={draft} onChange={setDraft} onSubmit={submit} disabled={pending || loading} />
      </section>
    </main>
  )
}
