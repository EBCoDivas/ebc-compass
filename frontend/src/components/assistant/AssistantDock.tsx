import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { assistantPath, getConversationId, listConversations } from '../../services/assistantService'
import { ChatSurface } from './ChatSurface'
import { useAssistantChat } from './useAssistantChat'
import { AssistantDockContext, type AssistantDockApi } from './dockContext'
import './assistant.css'

interface Prefill { question: string; nonce: number }

function DockChat({ open, prefill, onExpand, onClose }: { open: boolean; prefill: Prefill; onExpand: (draft: string) => void; onClose: () => void }) {
  const chat = useAssistantChat()
  const { setDraft, inputRef, pending, draft, entries, loading, openConversation } = chat
  const [title, setTitle] = useState('')
  const [starting, setStarting] = useState(false)
  const entriesRef = useRef(entries.length)
  entriesRef.current = entries.length

  // Título de la conversación abierta, para saber dónde se agregará la pregunta.
  useEffect(() => {
    if (!open || pending || loading) return
    let active = true
    listConversations().then(list => { if (active) setTitle(list.find(item => item.id === getConversationId())?.title ?? '') }).catch(() => undefined)
    return () => { active = false }
  }, [open, pending, loading, entries.length])

  const startNew = useCallback(async () => {
    setStarting(true)
    // Solo limpia el chat: la conversación se crea al enviar el primer mensaje, así no quedan conversaciones vacías en el historial.
    try { await openConversation(null); setTitle('') } finally { setStarting(false) }
  }, [openConversation])

  // Una pregunta desde otra pantalla es un tema nuevo: si la conversación actual ya tiene mensajes, empieza otra.
  const handledRef = useRef(0)
  useEffect(() => {
    if (!prefill.question || loading || handledRef.current === prefill.nonce) return
    handledRef.current = prefill.nonce
    void (async () => {
      if (entriesRef.current > 0) { try { await startNew() } catch { /* se queda en la conversación actual */ } }
      setDraft(prefill.question)
      inputRef.current?.focus()
    })()
  }, [prefill, loading, setDraft, startNew, inputRef])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open, prefill, inputRef])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <header className="dock-header">
        <img src="/ebc-compass-mark.svg" alt="" width="28" height="28" />
        <div className="dock-title">
          <h2 id="dock-title">Compass</h2>
          <span>{title || 'Conversación nueva'}</span>
        </div>
        <button type="button" className="dock-icon" onClick={() => void startNew()} disabled={pending || loading || starting} aria-label="Nueva conversación" title="Nueva conversación">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
        <button type="button" className="dock-icon" onClick={() => onExpand(draft)} disabled={pending} aria-label="Abrir en pantalla completa" title={pending ? 'Espera a que termine la respuesta' : 'Abrir en pantalla completa'}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>
        </button>
        <button type="button" className="dock-icon" onClick={onClose} aria-label="Cerrar Compass" title="Cerrar Compass">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div className="dock-chat" aria-busy={pending}>
        <ChatSurface chat={chat} />
      </div>
    </>
  )
}

/** Proveedor del panel flotante del asistente: ofrece `openWith` y dibuja el lanzador y el panel si `enabled`. */
export function AssistantDockProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [started, setStarted] = useState(false)
  const [prefill, setPrefill] = useState<Prefill>({ question: '', nonce: 0 })
  const launcherRef = useRef<HTMLButtonElement>(null)

  const api = useMemo<AssistantDockApi>(() => ({
    openWith: (question) => { setPrefill(current => ({ question, nonce: current.nonce + 1 })); setStarted(true); setOpen(true) },
  }), [])

  function close() {
    setOpen(false)
    launcherRef.current?.focus()
  }

  return (
    <AssistantDockContext.Provider value={enabled ? api : null}>
      {children}
      {enabled && (
        <>
          <button ref={launcherRef} type="button" className="dock-launcher" hidden={open} aria-expanded={open} aria-controls="dock-panel"
            onClick={() => { setStarted(true); setOpen(true) }}>
            <img src="/ebc-compass-mark.svg" alt="" width="30" height="30" />
            <span>Compass</span>
          </button>
          <section id="dock-panel" className="dock-panel" role="dialog" aria-labelledby="dock-title" hidden={!open}>
            {started && <DockChat open={open} prefill={prefill} onClose={close} onExpand={(draft) => { setOpen(false); navigate(draft.trim() ? assistantPath(draft.trim()) : '/asistente') }} />}
          </section>
        </>
      )}
    </AssistantDockContext.Provider>
  )
}
