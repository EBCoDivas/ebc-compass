import { Link } from 'react-router-dom'
import { deleteMemory, updateMemory, type MemoryData, type MemoryFact } from '../../services/assistantService'
import { campusOptions, careerOptions } from '../../types/profile'

const keyLabels: Record<string, string> = {
  career: 'Carrera', campus: 'Campus', semester: 'Semestre', interests: 'Intereses',
  goal: 'Meta', schedule: 'Horario', language: 'Idioma', modality: 'Modalidad',
}

// Los valores se guardan como claves internas; aquí se muestran en el idioma de la interfaz.
const valueLabels: Record<string, Record<string, string>> = {
  campus: Object.fromEntries(campusOptions.map(option => [option.value, option.label])),
  career: Object.fromEntries(careerOptions.map(option => [option.value, option.label])),
  goal: { 'banking-internship': 'Prácticas en banca', 'marketing-internship': 'Prácticas en marketing', 'professional-certification': 'Certificación profesional', entrepreneurship: 'Emprender' },
  schedule: { mornings: 'Mañanas', afternoons: 'Tardes', evenings: 'Noches', weekends: 'Fines de semana' },
  language: { es: 'Español', en: 'Inglés' },
  modality: { online: 'En línea', 'in-person': 'Presencial', hybrid: 'Híbrida' },
  interests: { finanzas: 'Finanzas', banca: 'Banca', fintech: 'Fintech', marketing: 'Marketing', emprendimiento: 'Emprendimiento', contabilidad: 'Contabilidad', derecho: 'Derecho', becas: 'Becas' },
}

const keyLabel = (key: string) => keyLabels[key] ?? key
const valueLabel = (key: string, value: string) => {
  if (key === 'semester' && /^\d+$/.test(value)) return `${value}.º semestre`
  return valueLabels[key]?.[value] ?? value
}
const interestList = (value: string) => [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))]
const fromProfile = (fact: MemoryFact) => fact.origin === 'profile' || ['career', 'campus', 'semester'].includes(fact.key)

/** "Mi contexto": lo que viene del perfil (solo lectura) y lo que Compass aprendió en la conversación (editable). */
export function MemoryPanel({ memory, onChanged, onError }: { memory: MemoryData | null; onChanged: () => Promise<void>; onError: (message: string) => void }) {
  const facts = (memory?.facts ?? []).filter(fact => fact.value)
  const profileFacts = facts.filter(fromProfile)
  const learnedFacts = facts.filter(fact => !fromProfile(fact))

  async function run(action: () => Promise<void>, message: string) {
    try { await action(); await onChanged() } catch { onError(message) }
  }
  const removeInterest = (fact: MemoryFact, interest: string) => {
    const rest = interestList(fact.value).filter(item => item !== interest)
    return run(() => rest.length ? updateMemory('interests', rest.join(',')) : deleteMemory('interests'), 'No fue posible quitar este interés.')
  }

  return (
    <>
      <div className="side-section">
        <div className="side-section-heading"><h2>Desde tu perfil</h2><Link className="side-text-button" to="/perfil">Editar en Mi perfil</Link></div>
        {profileFacts.length ? (
          <dl className="memory-list">
            {profileFacts.map(fact => <div key={fact.key}>
              <dt>{keyLabel(fact.key)}</dt>
              <dd>{fact.key === 'interests'
                ? <span className="memory-chips">{interestList(fact.value).map(item => <span className="memory-chip" key={item}>{valueLabel('interests', item)}</span>)}</span>
                : valueLabel(fact.key, fact.value)}</dd>
            </div>)}
          </dl>
        ) : <p className="side-empty">Completa tu perfil para que Compass lo tome en cuenta.</p>}
      </div>

      <div className="side-section">
        <div className="side-section-heading">
          <h2>Lo que aprendí en la conversación</h2>
          {learnedFacts.length > 0 && <button type="button" className="side-text-button" onClick={() => {
            if (window.confirm('¿Olvidar todo lo que Compass aprendió en tus conversaciones? Tu perfil no cambia.')) void run(async () => { for (const fact of learnedFacts) await deleteMemory(fact.key) }, 'No fue posible borrar los recuerdos.')
          }}>Olvidar todo</button>}
        </div>
        {learnedFacts.length ? (
          <ul className="memory-list learned">
            {learnedFacts.map(fact => <li key={fact.key}>
              {fact.key === 'interests' ? <>
                <span className="memory-label">{keyLabel(fact.key)}</span>
                <span className="memory-chips">{interestList(fact.value).map(item => (
                  <span className="memory-chip" key={item}>{valueLabel('interests', item)}
                    <button type="button" aria-label={`Quitar ${valueLabel('interests', item)} de tus intereses`} onClick={() => void removeInterest(fact, item)}>×</button>
                  </span>
                ))}</span>
              </> : <>
                <label className="memory-label" htmlFor={`memory-${fact.key}`}>{keyLabel(fact.key)}</label>
                <span className="memory-edit">
                  <select id={`memory-${fact.key}`} value={fact.value} disabled={!memory?.allowedValues[fact.key]}
                    onChange={event => void run(() => updateMemory(fact.key, event.target.value), 'No fue posible actualizar este dato.')}>
                    {[fact.value, ...(memory?.allowedValues[fact.key] ?? []).filter(value => value !== fact.value)].map(value => <option key={value} value={value}>{valueLabel(fact.key, value)}</option>)}
                  </select>
                  <button type="button" className="row-icon delete" aria-label={`Olvidar ${keyLabel(fact.key).toLowerCase()}`} title="Olvidar"
                    onClick={() => void run(() => deleteMemory(fact.key), 'No fue posible borrar este dato.')}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </span>
              </>}
            </li>)}
          </ul>
        ) : <p className="side-empty">Cuando menciones tu meta, horario o intereses, Compass los recordará aquí.</p>}
      </div>
    </>
  )
}
