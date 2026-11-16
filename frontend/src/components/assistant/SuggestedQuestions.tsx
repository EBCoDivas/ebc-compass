interface Props {
  suggestions: string[]
  onPick: (text: string) => void
}

/** Preguntas de ejemplo para empezar (estado vacío): al elegir una se copia al campo de texto. */
export function SuggestedQuestions({ suggestions, onPick }: Props) {
  if (suggestions.length === 0) return null
  return (
    <div className="chat-suggestions">
      <p>Puedes empezar con una de estas preguntas:</p>
      <ul>
        {suggestions.map((text) => (
          <li key={text}>
            <button type="button" onClick={() => onPick(text)}>
              {text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
