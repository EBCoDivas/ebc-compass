import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChatSurface } from '../components/assistant/ChatSurface'
import { useAssistantChat } from '../components/assistant/useAssistantChat'
import { MAX_MESSAGE_LENGTH, getConversationId } from '../services/assistantService'
import { createConversation, deleteConversation, deleteMemory, listConversations, loadMemories, renameConversation, updateMemory, type ConversationSummary, type MemoryData } from '../services/assistantService'
import { loadProfile, profileCompleteness } from '../services/profileService'
import '../components/assistant/assistant.css'

export function Assistant() {
  const profile = useMemo(() => loadProfile(), [])
  const chat = useAssistantChat()
  const { entries, loading, pending, submit, inputRef, setDraft, openConversation } = chat
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [memory, setMemory] = useState<MemoryData | null>(null)
  const [panelError, setPanelError] = useState('')
  const [sideTab, setSideTab] = useState<'history' | 'context'>('history')
  const [busy, setBusy] = useState(false)
  const refreshPanels = async () => {
    try {
      const [history, memories] = await Promise.all([listConversations(), loadMemories()])
      setConversations(history)
      setMemory(memories)
      setPanelError('')
    } catch { setPanelError('No se pudo cargar el historial o tus recuerdos.') }
  }
  useEffect(() => { void refreshPanels() }, [])
  useEffect(() => { if (!pending) void listConversations().then(data => setConversations(data)).catch(() => undefined) }, [entries.length, pending])
  // En pantallas angostas el contexto flota sobre el chat; en escritorio es una columna.
  const narrowQuery = '(max-width: 900px)'
  const [contextOpen, setContextOpen] = useState(() => !window.matchMedia(narrowQuery).matches)
  // En escritorio el contexto es una columna fija; al volver a esa anchura se vuelve a mostrar.
  useEffect(() => {
    const query = window.matchMedia(narrowQuery)
    const onChange = () => { if (!query.matches) setContextOpen(true) }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  const closeContextIfFloating = () => { if (window.matchMedia(narrowQuery).matches) setContextOpen(false) }
  useEffect(() => {
    if (!contextOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && window.matchMedia(narrowQuery).matches) setContextOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contextOpen])
  const [searchParams, setSearchParams] = useSearchParams()

  // Pregunta enviada desde otra pantalla (p. ej. "Preguntar al asistente"): se precarga para revisarla y enviarla.
  const incoming = searchParams.get('q')
  useEffect(() => {
    if (!incoming) return
    setDraft(incoming.slice(0, MAX_MESSAGE_LENGTH))
    setSearchParams({}, { replace: true })
    inputRef.current?.focus()
  }, [incoming, setSearchParams, setDraft, inputRef])

  const incomplete = !profile || profileCompleteness(profile) < 100

  // Los temas envían directamente su pregunta al asistente.
  const topics: [string, string][] = [
    ['Becas y apoyos', '¿Qué becas puedo solicitar?'],
    ['Cursos y certificaciones', '¿Qué cursos me recomiendas para mi carrera?'],
    ['Trámites escolares', '¿Qué trámites tengo pendientes este periodo?'],
    ['Eventos y networking', '¿Qué eventos hay en las próximas semanas?'],
    ['Fechas importantes', '¿Cuáles son mis próximas fechas importantes?'],
  ]

  return (
    <main className="assistant-page">
      <aside className="assistant-side" aria-label="Contexto de Compass">
        <details className="side-collapse" open={contextOpen} onToggle={(event) => setContextOpen(event.currentTarget.open)}>
          <summary title={contextOpen ? 'Ocultar contexto' : 'Mostrar contexto'} onClick={(event) => { if (!window.matchMedia(narrowQuery).matches) event.preventDefault() }}>
            <span>Conversaciones y contexto</span>
            <svg className="side-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </summary>
          <div className="side-body">
          <div className="side-tabs" aria-label="Panel del asistente">
            <button type="button" aria-pressed={sideTab === 'history'} onClick={() => setSideTab('history')}>Conversaciones</button>
            <button type="button" aria-pressed={sideTab === 'context'} onClick={() => setSideTab('context')}>Mi contexto</button>
          </div>
          {sideTab === 'history' && <div className="history-panel">
            <button type="button" className="button secondary new-conversation" disabled={pending || loading || busy} onClick={async () => {
              setBusy(true)
              try { const id = await createConversation(); await openConversation(id); await refreshPanels(); closeContextIfFloating() } catch { setPanelError('No fue posible crear una conversación.') }
              finally { setBusy(false) }
            }}><span aria-hidden="true">＋</span> Nueva conversación</button>
            <h2 className="history-label">Recientes</h2>
            <ul className="conversation-list">{[...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(item => <ConversationRow
              key={item.id} item={item} active={item.id === getConversationId()} disabled={pending || loading || busy}
              onOpen={async () => { setBusy(true); try { await openConversation(item.id); closeContextIfFloating() } finally { setBusy(false) } }}
              onRename={async title => { await renameConversation(item.id, title); await refreshPanels() }}
              onDelete={async () => {
                const wasActive = item.id === getConversationId()
                await deleteConversation(item.id)
                if (wasActive) await openConversation(null)
                await refreshPanels()
              }}
            />)}</ul>
            {!conversations.length && <p className="side-empty">Tus conversaciones aparecerán aquí. Empieza con una pregunta.</p>}
          </div>}
          {sideTab === 'context' && <>
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
            <div className="side-section-heading"><h2>Lo que recuerdo de ti</h2><button type="button" className="side-text-button" onClick={async () => {
              if (!window.confirm('¿Olvidar todos los recuerdos?')) return
              try { await deleteMemory(); await refreshPanels() } catch { setPanelError('No fue posible borrar los recuerdos.') }
            }}>Olvidar todo</button></div>
            <ul className="memory-list">{memory?.facts.map(fact => <li key={fact.key}>
              <label htmlFor={`memory-${fact.key}`}>{({ career: 'Carrera', campus: 'Campus', semester: 'Semestre', interests: 'Intereses', goal: 'Meta', schedule: 'Horario', language: 'Idioma', modality: 'Modalidad' } as Record<string, string>)[fact.key] ?? fact.key}</label>
              <select id={`memory-${fact.key}`} value={fact.value} disabled={fact.origin === 'profile' || !memory?.allowedValues[fact.key]} onChange={async event => {
                try { await updateMemory(fact.key, event.target.value); await refreshPanels() } catch { setPanelError('No fue posible actualizar este recuerdo. Actualiza los datos de perfil desde Perfil.') }
              }}><option value={fact.value}>{fact.value}</option>{memory?.allowedValues[fact.key]?.filter(value => value !== fact.value).map(value => <option key={value} value={value}>{value}</option>)}</select>
              {fact.origin !== 'profile' && <button type="button" className="conversation-action" aria-label={`Olvidar ${fact.key}`} onClick={async () => { try { await deleteMemory(fact.key); await refreshPanels() } catch { setPanelError('No fue posible borrar este recuerdo.') } }}>×</button>}
            </li>)}</ul>
            {!memory?.facts.length && <p className="side-empty">Aún no hay recuerdos guardados.</p>}
          </div>
          <div className="side-section">
            <h2>Puedo ayudarte con</h2>
            <ul className="side-topics">{topics.map(([topic, question]) => <li key={topic}><button type="button" disabled={loading || pending} onClick={() => { closeContextIfFloating(); submit(question) }}>{topic}</button></li>)}</ul>
          </div>
          <p className="side-disclaimer">Respuestas orientativas: para decisiones oficiales consulta a Servicios Escolares.</p>
          </>}
          {panelError && <p className="form-error" role="alert">{panelError}</p>}
          </div>
        </details>
      </aside>
      {contextOpen && <div className="side-scrim" role="presentation" onClick={() => setContextOpen(false)} />}

      <section className="chat-card" aria-labelledby="chat-title" aria-busy={pending}>
        <h1 id="chat-title" className="chat-title">Compass</h1>
        <ChatSurface chat={chat} />
      </section>
    </main>
  )
}

function ConversationRow({ item, active, disabled, onOpen, onRename, onDelete }: {
  item: ConversationSummary; active: boolean; disabled: boolean
  onOpen: () => Promise<void>; onRename: (title: string) => Promise<void>; onDelete: () => Promise<void>
}) {
  const [action, setAction] = useState<'menu' | 'rename' | 'delete' | null>(null)
  const [title, setTitle] = useState(item.title)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const blocked = disabled || saving
  async function save(operation: () => Promise<void>) {
    setSaving(true)
    setError('')
    try { await operation(); setAction(null) }
    catch { setError('No se pudo guardar el cambio. Intenta otra vez.') }
    finally { setSaving(false) }
  }
  return <li className={`conversation-row${active ? ' active' : ''}`}>
    <div className="conversation-row-main">
      <button type="button" className="conversation-choice" aria-current={active ? 'true' : undefined} disabled={blocked} onClick={() => void onOpen()} title={item.title}>
        <strong>{item.title || 'Nueva conversación'}</strong>
        <span>{active ? 'Conversación actual' : new Date(item.updatedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
      </button>
      <button type="button" className="conversation-action" disabled={blocked} aria-label={`Opciones de ${item.title}`} aria-expanded={action !== null} onClick={() => { setAction(action ? null : 'menu'); setError('') }}>•••</button>
    </div>
    {action === 'menu' && <div className="conversation-options">
      <button type="button" disabled={blocked} onClick={() => { setTitle(item.title); setAction('rename') }}>Renombrar</button>
      <button type="button" disabled={blocked} onClick={() => setAction('delete')}>Eliminar</button>
    </div>}
    {action === 'rename' && <form className="conversation-editor" onSubmit={event => { event.preventDefault(); if (title.trim()) void save(() => onRename(title.trim())) }}>
      <label>Nombre de la conversación<input maxLength={80} value={title} disabled={blocked} onChange={event => setTitle(event.target.value)} /></label>
      <div><button type="submit" disabled={blocked || !title.trim()}>Guardar</button><button type="button" disabled={saving} onClick={() => setAction(null)}>Cancelar</button></div>
    </form>}
    {action === 'delete' && <div className="conversation-editor">
      <p>¿Eliminar esta conversación? Su historial se borrará. Tus recuerdos se conservan.</p>
      <div><button type="button" disabled={blocked} onClick={() => void save(onDelete)}>Eliminar</button><button type="button" disabled={saving} onClick={() => setAction(null)}>Cancelar</button></div>
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </li>
}
