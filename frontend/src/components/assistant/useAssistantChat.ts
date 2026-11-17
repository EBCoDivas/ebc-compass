import { useCallback, useEffect, useRef, useState } from 'react'
import { AssistantError, clearConversation, fetchSuggestions, loadConversation, sendMessageStreaming, setActiveConversation } from '../../services/assistantService'
import { loadProfile } from '../../services/profileService'
import type { ChatEntry } from '../../types/assistant'

/** Estado y acciones de una conversación con el asistente. Lo comparten la página y el panel flotante. */
export function useAssistantChat() {
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [lastQuestion, setLastQuestion] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sendingRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; abortRef.current?.abort() }
  }, [])

  const openConversation = useCallback(async (id: string | null) => {
    if (sendingRef.current) return
    setLoading(true)
    setNotice('')
    setActiveConversation(id)
    try {
      const messages = await loadConversation()
      setEntries(messages.map((message, index) => ({ id: message.id, role: message.role, content: message.content, feedback: message.feedback, interrupted: message.interrupted,
        failure: message.failure, catalogFallback: message.catalogFallback, sources: message.sources, suggestions: message.suggestions,
        retryQuestion: messages.slice(0, index).reverse().find(previous => previous.role === 'student')?.content })))
    } catch (error) {
      setNotice(error instanceof AssistantError ? error.message : 'No fue posible abrir la conversación.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    let active = true
    loadConversation().then((messages) => {
      if (!active) return
      setEntries(messages.map((message, index) => ({ id: message.id, role: message.role, content: message.content, feedback: message.feedback, interrupted: message.interrupted,
        failure: message.failure, catalogFallback: message.catalogFallback, sources: message.sources, suggestions: message.suggestions,
        retryQuestion: messages.slice(0, index).reverse().find(previous => previous.role === 'student')?.content })))
      setLoading(false)
    })
    fetchSuggestions('es').then((list) => active && setSuggestions(list))
    return () => { active = false }
  }, [])

  const ask = useCallback(
    async (message: string, options: { showQuestion: boolean; requestId?: string }) => {
      if (loading || sendingRef.current) return
      sendingRef.current = true
      const abort = new AbortController()
      abortRef.current = abort
      const id = crypto.randomUUID()
      const requestId = options.requestId ?? crypto.randomUUID()
      let accumulated = ''
      let frame: number | undefined
      const publish = () => {
        frame = undefined
        if (mountedRef.current) setEntries(current => current.map(entry => entry.id === id ? { ...entry, content: accumulated } : entry))
      }
      setNotice('')
      setAnnouncement('')
      setLastQuestion(message)
      setPending(true)
      setEntries(current => [
        ...current.filter(entry => !entry.isError),
        ...(options.showQuestion ? [{ id: crypto.randomUUID(), role: 'student' as const, content: message }] : []),
        { id, role: 'assistant', content: '', isStreaming: true, retryQuestion: message, requestId },
      ])
      try {
        const reply = await sendMessageStreaming(message, loadProfile(), {
          signal: abort.signal, requestId,
          onEvent: event => {
            if (event.event === 'token' && typeof event.data.text === 'string') {
              accumulated += event.data.text
              if (frame === undefined) frame = requestAnimationFrame(publish)
            }
            if (event.event === 'replace' && typeof event.data.text === 'string') {
              accumulated = event.data.text
              if (frame !== undefined) cancelAnimationFrame(frame)
              publish()
            }
          },
        })
        if (frame !== undefined) cancelAnimationFrame(frame)
        if (mountedRef.current) {
          setEntries(current => current.map(entry => entry.id === id ? {
            id: reply.message.id, role: 'assistant', content: reply.message.content, sources: reply.message.sources,
            suggestions: reply.message.suggestions, meta: reply.meta, interrupted: reply.message.interrupted,
            failure: reply.message.failure, catalogFallback: reply.message.catalogFallback, retryQuestion: message, requestId,
          } : entry))
          setAnnouncement(reply.message.failure ? reply.message.content : reply.message.interrupted ? 'Respuesta detenida.' : 'Respuesta lista.')
        }
      } catch (error) {
        if (frame !== undefined) cancelAnimationFrame(frame)
        if (mountedRef.current) {
          const text = error instanceof AssistantError ? error.message : 'No pudimos completar la respuesta. Puedes reintentar.'
          setEntries(current => current.map(entry => entry.id === id ? { ...entry, content: accumulated, isStreaming: false,
            interrupted: abort.signal.aborted, streamError: abort.signal.aborted ? undefined : text } : entry))
          setAnnouncement(abort.signal.aborted ? 'Respuesta detenida.' : 'La respuesta se interrumpió.')
        }
      } finally {
        sendingRef.current = false
        abortRef.current = null
        if (mountedRef.current) { setPending(false); inputRef.current?.focus() }
      }
    },
    [loading],
  )

  function submit(message: string) {
    if (loading || sendingRef.current) return
    setDraft('')
    void ask(message, { showQuestion: true })
  }

  async function clear() {
    if (!window.confirm('¿Borrar esta conversación? Se eliminará su historial del servidor. Tu perfil y los recuerdos guardados se conservarán.')) return
    try {
      await clearConversation()
      setEntries([])
      setLastQuestion('')
      setNotice('')
      fetchSuggestions('es').then(setSuggestions)
    } catch (error) {
      setNotice(error instanceof AssistantError ? error.message : 'No fue posible borrar la conversación.')
    }
  }

  return {
    entries, suggestions, draft, setDraft, loading, pending, notice, announcement, inputRef,
    submit, clear, openConversation,
    stop: () => abortRef.current?.abort(),
    retry: (entry: ChatEntry) => void ask(entry.retryQuestion ?? lastQuestion, { showQuestion: false, requestId: entry.failure ? undefined : entry.requestId }),
  }
}

export type AssistantChat = ReturnType<typeof useAssistantChat>
