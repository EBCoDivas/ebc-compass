import { useState } from 'react'

export function Assistant() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  function ask() { const text = question.toLowerCase(); setAnswer(text.includes('beca') ? 'Puedes consultar las becas disponibles en Oportunidades y revisar sus fechas de vencimiento.' : text.includes('perfil') ? 'Ve a Inicio y selecciona Editar perfil para actualizar tus intereses.' : 'Puedo ayudarte a encontrar oportunidades, revisar fechas y entender tu perfil.') }
  return <main className="page"><div className="page-heading"><p className="eyebrow">ASISTENTE EBC</p><h1>¿En qué te ayudo?</h1><p>Haz una pregunta sobre tu perfil, fechas u oportunidades.</p></div><section className="form-card assistant-panel"><label>Tu pregunta<textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ej. ¿Qué becas están disponibles?" rows={4} /></label><button className="button primary" onClick={ask} disabled={!question.trim()}>Preguntar</button>{answer && <p className="assistant-answer" role="status">{answer}</p>}</section></main>
}
