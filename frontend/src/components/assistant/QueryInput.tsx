import { forwardRef, useState, type FormEvent } from 'react'
import { MAX_MESSAGE_LENGTH } from '../../services/assistantService'

interface Props {
  value: string
  onChange: (value: string) => void
  onSubmit: (message: string) => void
  disabled: boolean
}

export const QueryInput = forwardRef<HTMLInputElement, Props>(function QueryInput({ value, onChange, onSubmit, disabled }, ref) {
  const [touched, setTouched] = useState(false)
  const trimmed = value.trim()
  const nearLimit = value.length >= MAX_MESSAGE_LENGTH - 50

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
      <input
        id="assistant-question"
        ref={ref}
        type="text"
        value={value}
        maxLength={MAX_MESSAGE_LENGTH}
        placeholder="Escribe tu pregunta…"
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        aria-describedby="assistant-question-help"
        aria-invalid={touched && !trimmed}
      />
      <button type="submit" className="button primary" disabled={disabled}>
        Enviar
      </button>
      <p id="assistant-question-help" className={`chat-help${nearLimit ? ' warn' : ''}`}>
        {touched && !trimmed ? 'Escribe una pregunta para enviarla.' : `${value.length}/${MAX_MESSAGE_LENGTH} caracteres`}
      </p>
    </form>
  )
})
