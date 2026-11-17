import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChatSurface } from '../components/assistant/ChatSurface'
import { useAssistantChat } from '../components/assistant/useAssistantChat'
import { MAX_MESSAGE_LENGTH, getConversationId } from '../services/assistantService'
import { deleteConversation, listConversations, loadMemories, renameConversation, type ConversationSummary, type MemoryData } from '../services/assistantService'
import { MemoryPanel } from '../components/assistant/MemoryPanel'
import { loadProfile, profileCompleteness } from '../services/profileService'
import '../components/assistant/assistant.css'

export function Assistant() {
  const profile = useMemo(() => loadProfile(), [])
  const chat = useAssistantChat()
  const { entries, loading, pending, inputRef, setDraft, openConversation } = chat
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [memory, setMemory] = useState<MemoryData | null>(null)
  const [panelError, setPanelError] = useState('')
  const [sideTab, setSideTab] = useState<'history' | 'context'>('history')
  const [busy, setBusy] = useState(false)
  // Solo una conversación a la vez puede estar en edición o en confirmación de borrado.
  const [rowAction, setRowAction] = useState<{ id: string; mode: 'menu' | 'rename' | 'delete' } | null>(null)
  const refreshPanels = async () => {
    try {
      const [history, memories] = await Promise.all([listConversations(), loadMemories()])
      setConversations(history)
      setMemory(memories)
      setPanelError('')
    } catch { setPanelError('No se pudo cargar el historial o tus recuerdos.') }
  }
  useEffect(() => { void refreshPanels() }, [])
  useEffect(() => { if (!pending) void refreshPanels() }, [entries.length, pending])
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
  function switchTabWithArrows(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const next = sideTab === 'history' ? 'context' : 'history'
    setSideTab(next)
    document.getElementById(`tab-${next}`)?.focus()
  }
  async function startNewConversation() {
    setBusy(true)
    // No se guarda nada todavía: la conversación se crea al enviar el primer mensaje, así no quedan conversaciones vacías.
    try { await openConversation(null); closeContextIfFloating(); inputRef.current?.focus() } catch { setPanelError('No fue posible empezar una conversación.') }
    finally { setBusy(false) }
  }
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

  const sortedConversations = [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  // Si dos conversaciones comparten día, se agrega la hora para distinguirlas.
  const dayCounts = sortedConversations.reduce((counts, item) => counts.set(dayLabel(item.updatedAt), (counts.get(dayLabel(item.updatedAt)) ?? 0) + 1), new Map<string, number>())
  const repeatedDays = new Set([...dayCounts].filter(([, count]) => count > 1).map(([day]) => day))


  return (
    <main className="assistant-page">
      <aside className="assistant-side" aria-label="Contexto de Compass">
        <details className="side-collapse" open={contextOpen} onToggle={(event) => setContextOpen(event.currentTarget.open)}>
          <summary title={contextOpen ? 'Ocultar conversaciones y contexto' : 'Mostrar conversaciones y contexto'} onClick={(event) => { if (!window.matchMedia(narrowQuery).matches) event.preventDefault() }}>
            <span>Conversaciones y contexto</span>
            <svg className="side-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </summary>
          <div className="side-body">
          <div className="side-tabs" role="tablist" aria-label="Panel de Compass">
            <button type="button" role="tab" id="tab-history" aria-selected={sideTab === 'history'} aria-controls="panel-history" tabIndex={sideTab === 'history' ? 0 : -1} onKeyDown={switchTabWithArrows} onClick={() => setSideTab('history')}>Conversaciones</button>
            <button type="button" role="tab" id="tab-context" aria-selected={sideTab === 'context'} aria-controls="panel-context" tabIndex={sideTab === 'context' ? 0 : -1} onKeyDown={switchTabWithArrows} onClick={() => setSideTab('context')}>Mi contexto</button>
          </div>
          {sideTab === 'history' && <div className="history-panel" role="tabpanel" id="panel-history" aria-labelledby="tab-history">
            <button type="button" className="button secondary new-conversation" disabled={pending || loading || busy} onClick={() => void startNewConversation()}><span aria-hidden="true">＋</span> Nueva conversación</button>
            <h2 className="history-label">Recientes</h2>
            <ul className="conversation-list">{sortedConversations.map(item => <ConversationRow
              key={item.id} item={item} active={item.id === getConversationId()} disabled={pending || loading || busy}
              showTime={repeatedDays.has(dayLabel(item.updatedAt))}
              mode={rowAction?.id === item.id ? rowAction.mode : 'view'}
              onModeChange={next => setRowAction(next === 'view' ? null : { id: item.id, mode: next })}
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
          {sideTab === 'context' && <div role="tabpanel" id="panel-context" aria-labelledby="tab-context">
            <MemoryPanel memory={memory} profileName={profile?.name} completeness={profile ? profileCompleteness(profile) : 0} onChanged={refreshPanels} onError={setPanelError} />
          </div>}
          {panelError && <p className="form-error" role="alert">{panelError}</p>}
          </div>
        </details>
        <button type="button" className="side-new" aria-label="Nueva conversación" title="Nueva conversación" disabled={pending || loading || busy} onClick={() => void startNewConversation()}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </aside>
      {contextOpen && <div className="side-scrim" role="presentation" onClick={() => setContextOpen(false)} />}

      <section className="chat-card" aria-labelledby="chat-title" aria-busy={pending}>
        <h1 id="chat-title" className="chat-title">Compass</h1>
        <ChatSurface chat={chat} />
      </section>
    </main>
  )
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '')
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

function RowIcon({ path }: { path: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
}
const icons = {
  rename: 'M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4',
  delete: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  save: 'm5 12 5 5L20 7',
  cancel: 'M6 6l12 12M18 6 6 18',
}

/** Fila del historial: abrir, renombrar en el mismo lugar o eliminar con confirmación. */
type RowMode = 'view' | 'menu' | 'rename' | 'delete'
function ConversationRow({ item, active, disabled, showTime, mode, onModeChange, onOpen, onRename, onDelete }: {
  item: ConversationSummary; active: boolean; disabled: boolean; showTime: boolean
  mode: RowMode; onModeChange: (mode: RowMode) => void
  onOpen: () => Promise<void>; onRename: (title: string) => Promise<void>; onDelete: () => Promise<void>
}) {
  const setMode = onModeChange
  const [title, setTitle] = useState(item.title)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const openRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  // Al renombrar, el foco va al campo con el texto seleccionado; al confirmar eliminación, a "Cancelar" (la opción segura).
  useEffect(() => {
    if (mode === 'rename') inputRef.current?.select()
    if (mode === 'delete') cancelRef.current?.focus()
  }, [mode])
  const blocked = disabled || saving
  const name = item.title || 'Nueva conversación'

  function close() { setMode('view'); setError(''); requestAnimationFrame(() => openRef.current?.focus()) }
  async function save(operation: () => Promise<void>) {
    setSaving(true)
    setError('')
    try { await operation(); close() }
    catch { setError('No se pudo guardar el cambio. Intenta otra vez.') }
    finally { setSaving(false) }
  }

  if (mode === 'rename') {
    return <li className={`conversation-row editing${active ? ' active' : ''}`}>
      <form className="conversation-rename" onSubmit={event => { event.preventDefault(); if (title.trim() && title.trim() !== item.title) void save(() => onRename(title.trim())); else close() }}>
        <input aria-label="Nombre de la conversación" maxLength={80} ref={inputRef} value={title} disabled={saving}
          onChange={event => setTitle(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close() } }} />
        <button type="submit" className="row-icon save" disabled={saving || !title.trim()} aria-label="Guardar nombre" title="Guardar (Enter)"><RowIcon path={icons.save} /></button>
        <button type="button" className="row-icon" disabled={saving} onClick={close} aria-label="Cancelar" title="Cancelar (Esc)"><RowIcon path={icons.cancel} /></button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
    </li>
  }

  if (mode === 'delete') {
    return <li className="conversation-row confirming">
      <p className="conversation-confirm-text"><strong>¿Eliminar esta conversación?</strong> Se borrará «{name}» con su historial. Tus recuerdos se conservan.</p>
      <div className="conversation-confirm-actions">
        <button type="button" className="row-danger" disabled={blocked} onClick={() => void save(onDelete)}>{saving ? 'Eliminando…' : 'Eliminar'}</button>
        <button type="button" className="row-ghost" disabled={saving} onClick={close} ref={cancelRef}>Cancelar</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </li>
  }

  return <li className={`conversation-row${active ? ' active' : ''}${mode === 'menu' ? ' menu-open' : ''}`}>
    <div className="conversation-row-main">
      <button ref={openRef} type="button" className="conversation-choice" aria-current={active ? 'true' : undefined} disabled={blocked} onClick={() => void onOpen()} title={name}>
        <strong>{name}</strong>
        <span>{active ? 'Conversación actual' : showTime ? `${dayLabel(item.updatedAt)}, ${timeLabel(item.updatedAt)}` : dayLabel(item.updatedAt)}</span>
      </button>
      {/* En pantallas táctiles las acciones se agrupan tras "•••"; en escritorio aparecen al pasar el mouse. */}
      <button type="button" className="row-icon row-more" disabled={blocked} aria-expanded={mode === 'menu'} aria-label={`Acciones de ${name}`} title="Acciones"
        onClick={() => setMode(mode === 'menu' ? 'view' : 'menu')}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
      </button>
      <span className="conversation-tools">
        <button type="button" className="row-icon rename" disabled={blocked} onClick={() => { setTitle(item.title); setMode('rename') }} aria-label={`Renombrar ${name}`} title="Renombrar"><RowIcon path={icons.rename} /></button>
        <button type="button" className="row-icon delete" disabled={blocked} onClick={() => setMode('delete')} aria-label={`Eliminar ${name}`} title="Eliminar"><RowIcon path={icons.delete} /></button>
      </span>
    </div>
  </li>
}
