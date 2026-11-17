interface Props {
  suggestions: string[]
  onPick: (text: string) => void
  disabled?: boolean
}

/** Preguntas de ejemplo para empezar: al elegir una se envía directamente. */
export function SuggestedQuestions({ suggestions, onPick, disabled = false }: Props) {
  if (suggestions.length === 0) return null
  return (
    <div className="chat-suggestions">
      <p className="chat-suggestions-title">Puedes empezar con:</p>
      <ul>
        {suggestions.map((text) => (
          <li key={text}>
            <button type="button" disabled={disabled} onClick={() => onPick(text)}>
              {text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
