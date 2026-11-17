import { useState } from 'react'
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

const icon = {
  edit: 'M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4',
  forget: 'M6 6l12 12M18 6 6 18',
}
function Icon({ path }: { path: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
}

/** "Mi contexto": tu perfil en resumen (se edita en Mi perfil) y lo que Compass recuerda de la conversación (se corrige u olvida). */
export function MemoryPanel({ memory, profileName, completeness, onChanged, onError }: {
  memory: MemoryData | null; profileName?: string; completeness: number
  onChanged: () => Promise<void>; onError: (message: string) => void
}) {
  const facts = (memory?.facts ?? []).filter(fact => fact.value)
  const profileFacts = facts.filter(fromProfile)
  const learnedFacts = facts.filter(fact => !fromProfile(fact))
  const profileValue = (key: string) => profileFacts.find(fact => fact.key === key)?.value
  // Carrera, campus y semestre en una sola línea legible.
  const academicLine = (['career', 'campus', 'semester'] as const).map(key => profileValue(key)).map((value, index) => value ? valueLabel(['career', 'campus', 'semester'][index], value) : '').filter(Boolean).join(', ')
  const profileInterests = interestList(profileValue('interests') ?? '')
  // Solo un dato a la vez se corrige; las opciones válidas vienen del backend.
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function run(action: () => Promise<void>, message: string) {
    setSaving(true)
    try { await action(); await onChanged(); return true } catch { onError(message); return false } finally { setSaving(false) }
  }
  const choose = async (fact: MemoryFact, value: string) => {
    if (value === fact.value) { setEditing(null); return }
    if (await run(() => updateMemory(fact.key, value), 'No fue posible corregir este dato.')) setEditing(null)
  }
  const removeInterest = (fact: MemoryFact, interest: string) => {
    const rest = interestList(fact.value).filter(item => item !== interest)
    return run(() => rest.length ? updateMemory('interests', rest.join(',')) : deleteMemory('interests'), 'No fue posible quitar este interés.')
  }
  const addInterest = (fact: MemoryFact, interest: string) =>
    run(() => updateMemory('interests', [...interestList(fact.value), interest].join(',')), 'No fue posible agregar este interés.')

  return (
    <>
      <section className="side-section profile-card" aria-labelledby="profile-card-title">
        <div className="side-section-heading">
          <h2 id="profile-card-title">Tu perfil</h2>
          <Link className="side-text-button" to="/perfil">Editar perfil</Link>
        </div>
        <p className="profile-card-name">{profileName || (profileFacts.length ? 'Estudiante EBC' : 'Sin perfil')}</p>
        {academicLine && <p className="profile-card-line">{academicLine}</p>}
        {profileInterests.length > 0 && <span className="memory-chips">{profileInterests.map(item => <span className="memory-chip" key={item}>{valueLabel('interests', item)}</span>)}</span>}
        {completeness < 100 && <p className="side-hint">{profileFacts.length ? `Tu perfil está al ${completeness}%. Complétalo` : 'Crea tu perfil'} para que Compass personalice sus respuestas.</p>}
      </section>

      <div className="side-section">
        <h2>Lo que Compass recuerda</h2>
        {learnedFacts.length ? <>
          <p className="side-note">Lo dedujo de tus mensajes. Si algo no es correcto, corrígelo o pídele que lo olvide.</p>
          <ul className="learned-list">
            {learnedFacts.map(fact => {
              const label = keyLabel(fact.key)
              const options = memory?.allowedValues[fact.key] ?? []
              const isEditing = editing === fact.key
              const interests = fact.key === 'interests' ? interestList(fact.value) : []
              const canEdit = fact.key === 'interests' ? options.some(option => !interests.includes(option)) : options.length > 1
              return <li key={fact.key} className={`learned-item${isEditing ? ' editing' : ''}`}>
                <div className="learned-head">
                  <span className="learned-key">{label}</span>
                  <span className="learned-actions">
                    {canEdit && <button type="button" className="row-icon rename" disabled={saving} aria-expanded={isEditing}
                      aria-label={fact.key === 'interests' ? 'Agregar intereses' : `Corregir ${label.toLowerCase()}`} title={fact.key === 'interests' ? 'Agregar' : 'Corregir'}
                      onClick={() => setEditing(isEditing ? null : fact.key)}><Icon path={icon.edit} /></button>}
                    <button type="button" className="row-icon delete" disabled={saving} aria-label={`Olvidar ${label.toLowerCase()}`} title="Olvidar"
                      onClick={() => void run(() => deleteMemory(fact.key), 'No fue posible olvidar este dato.')}><Icon path={icon.forget} /></button>
                  </span>
                </div>
                {fact.key === 'interests'
                  ? <span className="memory-chips">{interests.map(item => (
                      <span className="memory-chip" key={item}>{valueLabel('interests', item)}
                        <button type="button" disabled={saving} aria-label={`Quitar ${valueLabel('interests', item)} de tus intereses`} onClick={() => void removeInterest(fact, item)}>×</button>
                      </span>))}</span>
                  : <p className="learned-value">{valueLabel(fact.key, fact.value)}</p>}
                {isEditing && <div className="learned-options" role="group" aria-label={fact.key === 'interests' ? 'Agregar intereses' : `Elige ${label.toLowerCase()}`}>
                  {fact.key === 'interests'
                    ? options.filter(option => !interests.includes(option)).map(option => (
                        <button type="button" key={option} className="option-chip" disabled={saving} onClick={() => void addInterest(fact, option)}>
                          <span aria-hidden="true">+</span> {valueLabel('interests', option)}
                        </button>))
                    : options.map(option => (
                        <button type="button" key={option} className="option-chip" aria-pressed={option === fact.value} disabled={saving} onClick={() => void choose(fact, option)}>
                          {valueLabel(fact.key, option)}
                        </button>))}
                  <button type="button" className="option-done" onClick={() => setEditing(null)}>Listo</button>
                </div>}
              </li>
            })}
          </ul>
          <button type="button" className="forget-all" disabled={saving} onClick={() => {
            if (window.confirm('¿Olvidar todo lo que Compass aprendió en tus conversaciones? Tu perfil no cambia.')) void run(async () => { for (const fact of learnedFacts) await deleteMemory(fact.key) }, 'No fue posible olvidar lo aprendido.')
          }}>Olvidar todo lo aprendido</button>
        </> : <p className="side-empty">Si mencionas tu meta, horario o intereses, Compass los recordará aquí para personalizar sus respuestas.</p>}
      </div>
    </>
  )
}
