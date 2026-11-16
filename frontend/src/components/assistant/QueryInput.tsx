import { forwardRef, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MAX_MESSAGE_LENGTH } from '../../services/assistantService'

interface Props {
  value: string
  onChange: (value: string) => void
  onSubmit: (message: string) => void
  disabled: boolean
}

export const QueryInput = forwardRef<HTMLTextAreaElement, Props>(function QueryInput({ value, onChange, onSubmit, disabled }, ref) {
  const [touched, setTouched] = useState(false)
  const trimmed = value.trim()
  const nearLimit = value.length >= MAX_MESSAGE_LENGTH - 50

  const innerRef = useRef<HTMLTextAreaElement | null>(null)

  // El campo crece con el texto (hasta un máximo) y vuelve a una línea al vaciarse.
  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
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
    if (!trimmed || disabled) return
    onSubmit(trimmed)
    setTouched(false)
  }

  return (
    <form className="chat-form" onSubmit={handleSubmit}>
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
      <button type="submit" className="button primary" disabled={disabled}>
        Enviar
      </button>
      <p id="assistant-question-help" className={`chat-help${nearLimit ? ' warn' : ''}`}>
        {touched && !trimmed ? 'Escribe una pregunta para enviarla.' : `Enter envía · Shift+Enter nueva línea · ${value.length}/${MAX_MESSAGE_LENGTH}`}
      </p>
    </form>
  )
})
