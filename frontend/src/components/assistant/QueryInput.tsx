import { forwardRef, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { MAX_MESSAGE_LENGTH } from '../../services/assistantService'

interface Props {
  modelSelector?: ReactNode
  value: string
  onChange: (value: string) => void
  onSubmit: (message: string) => void
  pending?: boolean
  onStop?: () => void
  disabled: boolean
}

export const QueryInput = forwardRef<HTMLTextAreaElement, Props>(function QueryInput({ modelSelector, value, onChange, onSubmit, disabled, pending = false, onStop }, ref) {
  const [touched, setTouched] = useState(false)
  const trimmed = value.trim()
  const nearLimit = value.length >= MAX_MESSAGE_LENGTH - 50

  const innerRef = useRef<HTMLTextAreaElement | null>(null)

  // El campo crece con el texto (hasta un máximo) y vuelve a una línea al vaciarse.
  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    el.style.height = 'auto'
    // scrollHeight no incluye el borde; sin sumarlo aparece una barra de scroll falsa.
    const border = el.offsetHeight - el.clientHeight
    const height = Math.min(el.scrollHeight + border, 200)
    el.style.height = `${height}px`
    el.style.overflowY = height >= 200 ? 'auto' : 'hidden'
  }, [value])

  function setRefs(node: HTMLTextAreaElement | null) {
    innerRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!trimmed || disabled || pending) return
    onSubmit(trimmed)
    setTouched(false)
  }

  return (
    <form className="chat-form" onSubmit={handleSubmit}>
      {modelSelector}
      <label htmlFor="assistant-question" className="visually-hidden">
        Escribe tu pregunta
      </label>
      <textarea
        id="assistant-question"
        ref={setRefs}
        rows={1}
        value={value}
        onKeyDown={handleKeyDown}
        maxLength={MAX_MESSAGE_LENGTH}
        placeholder="Escribe tu pregunta…"
        onChange={(event) => onChange(event.target.value)}
        aria-describedby="assistant-question-help"
        aria-invalid={touched && !trimmed}
      />
      <button type={pending ? 'button' : 'submit'} onClick={pending ? onStop : undefined} className="button primary chat-icon-button" disabled={disabled} aria-label={pending ? 'Detener respuesta' : 'Enviar mensaje'} title={pending ? 'Detener respuesta' : 'Enviar mensaje'}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {pending ? <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none" /> : <path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" />}
        </svg>
      </button>
      <p id="assistant-question-help" className={`chat-help${nearLimit ? ' warn' : ''}`}>
        {touched && !trimmed ? 'Escribe una pregunta para enviarla.' : <>
          <span className="chat-help-note">Compass orienta; para decisiones oficiales consulta a Servicios Escolares.</span>
          <span className="chat-help-keys">Enter envía, Shift+Enter nueva línea, {value.length}/{MAX_MESSAGE_LENGTH}</span>
        </>}
      </p>
    </form>
  )
})
