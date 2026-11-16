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
  const inputRef = useRef<HTMLTextAreaElement>(null)
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
    async (message: string, options: { showQuestion: boolean; dropLastReply?: boolean }) => {
      setNotice('')
      setLastQuestion(message)
      setPending(true)
      setEntries((current) => {
        let withoutError = current.filter((entry) => !entry.isError)
        if (options.dropLastReply && withoutError[withoutError.length - 1]?.role === 'assistant') withoutError = withoutError.slice(0, -1)
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

  const lastStudentQuestion = [...entries].reverse().find((entry) => entry.role === 'student')?.content ?? ''
  const incomplete = !profile || profileCompleteness(profile) < 100

  const topics = ['Becas y apoyos', 'Cursos y certificaciones', 'Trámites escolares', 'Eventos y networking', 'Fechas importantes']

  return (
    <main className="assistant-page">
      <aside className="assistant-side" aria-label="Contexto del asistente">
        <details className="side-collapse" open>
          <summary>Tu contexto</summary>
          <div className="side-section">
            <h2>Hablas como</h2>
            {profile ? (
              <p className="side-persona">
                <strong>{profile.name || 'Estudiante EBC'}</strong>
                <span>{profileCompleteness(profile)}% de tu perfil completo</span>
              </p>
            ) : (
              <p className="side-persona"><strong>Sin perfil</strong><span>Respuestas generales</span></p>
            )}
            {incomplete && (
              <p className="side-hint">
                {profile ? 'Completa tu perfil' : 'Crea tu perfil'} para respuestas más personalizadas. <Link to="/perfil">Ir a mi perfil</Link>
              </p>
            )}
          </div>
          <div className="side-section">
            <h2>Puedo ayudarte con</h2>
            <ul className="side-topics">{topics.map((topic) => <li key={topic}>{topic}</li>)}</ul>
          </div>
          <p className="side-disclaimer">Respuestas orientativas: para decisiones oficiales consulta a Servicios Escolares.</p>
          {entries.length > 0 && (
            <button type="button" className="button secondary" onClick={clear} disabled={pending}>
              Borrar conversación
            </button>
          )}
        </details>
      </aside>

      <section className="chat-card" aria-labelledby="chat-title">
        <h1 id="chat-title" className="chat-title">Asistente <em>Compass</em></h1>

        {loading ? (
          <p className="chat-empty" role="status">
            Cargando conversación…
          </p>
        ) : entries.length === 0 ? (
          <div className="chat-empty">
            <img src="/ebc-compass-mark.svg" alt="" width="56" height="56" />
            <h2>¡Hola{profile?.name ? `, ${profile.name}` : ''}! ¿En qué te ayudo?</h2>
            <p>Pregúntame sobre becas, cursos, trámites, eventos y fechas, en español o en inglés.</p>
            <SuggestedQuestions suggestions={suggestions} onPick={pick} />
          </div>
        ) : (
          <ConversationHistory entries={entries} pending={pending} onRetry={() => void ask(lastQuestion, { showQuestion: false })} onRegenerate={() => void ask(lastQuestion || lastStudentQuestion, { showQuestion: false, dropLastReply: true })} onPickSuggestion={pick} />
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
