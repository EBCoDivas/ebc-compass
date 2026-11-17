interface Props {
  suggestions: string[]
  onPick: (text: string) => void
  disabled?: boolean
}

// Temas generales: cada uno envía una pregunta lista.
const topics: [string, string][] = [
  ['Becas y apoyos', '¿Qué becas puedo solicitar?'],
  ['Cursos y certificaciones', '¿Qué cursos me recomiendas para mi carrera?'],
  ['Trámites escolares', '¿Qué trámites tengo pendientes este periodo?'],
  ['Eventos y networking', '¿Qué eventos hay en las próximas semanas?'],
  ['Fechas importantes', '¿Cuáles son mis próximas fechas importantes?'],
]

/** Para empezar: preguntas sugeridas y temas. Al elegir cualquiera se envía directamente. */
export function SuggestedQuestions({ suggestions, onPick, disabled = false }: Props) {
  return (
    <div className="chat-suggestions">
      {suggestions.length > 0 && <>
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
      </>}
      <p className="chat-suggestions-title">O explora un tema:</p>
      <ul className="chat-topics">
        {topics.map(([topic, question]) => (
          <li key={topic}>
            <button type="button" disabled={disabled} onClick={() => onPick(question)}>{topic}</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
