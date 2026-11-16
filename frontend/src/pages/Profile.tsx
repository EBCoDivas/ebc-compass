import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadProfile, profileCompleteness, saveProfile } from '../services/profileService'
import { campusOptions, careerOptions, emptyProfile, simulatedAcademicData } from '../types/profile'
import type { StudentProfile } from '../types/profile'

export function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<StudentProfile>(() => loadProfile() ?? emptyProfile)
  const [interest, setInterest] = useState('')
  const [error, setError] = useState('')
  const completeness = profileCompleteness(profile)
  const interestOptions = ['Finanzas', 'Matemáticas', 'Banca digital', 'Emprendimiento', 'Marketing digital', 'Liderazgo', 'Tecnología', 'Sostenibilidad']
  const preferenceOptions = ['Becas', 'Diplomados', 'Cursos adicionales', 'Estudiar otra carrera', 'Actividades deportivas', 'Voluntariado', 'Eventos y networking']
  const typedInterestSuggestions = interest.toLowerCase().includes('matem') ? ['Finanzas', 'Estadística', 'Análisis de datos'] : interest.toLowerCase().includes('finan') ? ['Inversiones', 'Mercados financieros', 'Banca digital'] : []

  function update<K extends keyof StudentProfile>(key: K, value: StudentProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }))
  }

  function addInterest() {
    const value = interest.trim()
    if (value && !profile.interests.includes(value) && profile.interests.length < 10) {
      update('interests', [...profile.interests, value])
      setInterest('')
    }
  }

  function toggleInterest(value: string) {
    if (profile.interests.includes(value)) {
      update('interests', profile.interests.filter((item) => item !== value))
    } else if (profile.interests.length < 10) {
      update('interests', [...profile.interests, value])
    }
  }

  function addSuggestedInterest(value: string) {
    toggleInterest(value)
    setInterest('')
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!profile.name.trim() || !profile.campus || !profile.career || !profile.currentSemester || profile.interests.length === 0 || profile.preferences.length === 0) {
      setError('Completa tus datos académicos, al menos un interés y una preferencia para guardar tu perfil.')
      return
    }
    const saved = { ...profile, id: profile.id || crypto.randomUUID(), updatedAt: new Date().toISOString() }
    saveProfile(saved)
    navigate('/')
  }

  return (
    <main className="page profile-page">
      <div className="page-heading">
        <p className="eyebrow">PERSONALIZA TU EXPERIENCIA</p>
        <h1>Mi perfil</h1>
        <p>Cuéntanos sobre ti para recibir recomendaciones más relevantes.</p>
      </div>
      <div className="completeness" aria-live="polite">
        <div className="completeness-row"><strong>Completitud del perfil</strong><span>{completeness}%</span></div>
        <div className="progress-track"><div className="progress-value" style={{ width: `${completeness}%` }} /></div>
        {completeness < 100 && <small>Completa tu personalización para recibir mejores recomendaciones.</small>}
      </div>
      <form className="profile-form" onSubmit={handleSubmit}>
        <section className="form-card">
          <h2>Datos personales y académicos</h2>
          <div className="academic-summary" aria-label="Datos académicos validados">
            <div><span>Matrícula</span><strong>{simulatedAcademicData.enrollment}</strong></div>
            <div><span>Campus</span><strong>{simulatedAcademicData.campus}</strong></div>
            <div><span>Nombre completo</span><strong>{simulatedAcademicData.fullName}</strong></div>
            <div><span>Carrera</span><strong>{simulatedAcademicData.career}</strong></div>
            <div><span>Semestre actual</span><strong>{simulatedAcademicData.semester}</strong></div>
          </div>
          <p className="field-help">Estos datos fueron validados con tu información institucional.</p>
          <div className="form-grid">
            <label>Campus<select required value={profile.campus} onChange={(e) => update('campus', e.target.value as StudentProfile['campus'])}><option value="">Selecciona tu campus</option>{campusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
            <label>Carrera<select required value={profile.career} onChange={(e) => update('career', e.target.value as StudentProfile['career'])}><option value="">Selecciona tu carrera</option>{careerOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
            <label>Semestre<select required value={profile.currentSemester} onChange={(e) => update('currentSemester', e.target.value ? Number(e.target.value) : '')}><option value="">Selecciona tu semestre</option>{Array.from({ length: 10 }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}° semestre</option>)}</select></label>
          </div>
          <button type="button" className="assistant-link" onClick={() => setError('La solicitud de corrección estará disponible en el asistente.')}><span className="assistant-icon" aria-hidden="true">💬</span> ¿Hay un dato académico incorrecto? Solicita una corrección en el asistente.</button>
        </section>
        <section className="form-card">
          <label>¿Cómo prefieres que te llamemos? <input required value={profile.name} onChange={(e) => update('name', e.target.value)} placeholder="Ej. Vale, Val o V. Martinez" /><span className="field-help">Usaremos este nombre para dirigirnos a ti en tu seguimiento.</span></label>
        </section>
        <section className="form-card">
          <h2>Intereses</h2>
          <p className="field-help">Selecciona temas que te gustaría explorar o escribe uno propio.</p>
          <div className="choice-list">{interestOptions.map((option) => <button type="button" className={`choice ${profile.interests.includes(option) ? 'selected' : ''}`} key={option} onClick={() => toggleInterest(option)}>{option}</button>)}</div>
          <div className="interest-entry"><input value={interest} maxLength={50} onChange={(e) => setInterest(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest() } }} placeholder="Ej. banca digital" /><button type="button" className="button secondary" onClick={addInterest}>Agregar</button></div>
          {typedInterestSuggestions.length > 0 && <div className="suggestions"><span>También puede interesarte:</span>{typedInterestSuggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => addSuggestedInterest(suggestion)}>{suggestion}</button>)}</div>}
          <div className="tags" aria-label="Intereses agregados">{profile.interests.map((item) => <span className="tag" key={item}>{item}<button type="button" aria-label={`Quitar ${item}`} onClick={() => update('interests', profile.interests.filter((interestItem) => interestItem !== item))}>×</button></span>)}</div>
        </section>
        <section className="form-card">
          <h2>¿Qué te gustaría encontrar en EBC Compass?</h2>
          <p className="field-help">Puedes elegir varias opciones para personalizar tus recomendaciones.</p>
          <div className="choice-list">{preferenceOptions.map((option) => <button type="button" className={`choice ${profile.preferences.includes(option) ? 'selected' : ''}`} key={option} onClick={() => update('preferences', profile.preferences.includes(option) ? profile.preferences.filter((item) => item !== option) : [...profile.preferences, option])}>{option}</button>)}</div>
        </section>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary" type="submit">Guardar perfil</button>
      </form>
    </main>
  )
}
