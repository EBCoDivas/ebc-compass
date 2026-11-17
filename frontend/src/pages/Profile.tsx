import { academicDataFromClaims } from '../services/personaService'
import { authConfigured, getToken, signOut } from '../services/authService'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadProfile, needsProfileSetup, profileCompleteness, saveProfileRemote } from '../services/profileService'
import { getStudentId } from '../services/assistantService'
import { AskAssistantLink } from '../components/assistant/AskAssistantLink'
import { campusOptions, careerOptions, emptyProfile } from '../types/profile'
import type { StudentProfile } from '../types/profile'

export function Profile() {
  const navigate = useNavigate()
  const academic = academicDataFromClaims(getToken())
  const [profile, setProfile] = useState<StudentProfile>(() => {
    const stored = loadProfile()
    return { ...emptyProfile, ...stored, campus: stored?.campus || '', career: stored?.career || '', currentSemester: stored?.currentSemester || '' }
  })
  const [interest, setInterest] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const onboarding = needsProfileSetup(profile)
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    if (!profile.name.trim() || !profile.campus || !profile.career || !profile.currentSemester) {
      setError('Completa tu nombre y verifica tus datos académicos para guardar tu perfil.')
      return
    }
    const saved = { ...profile, id: getStudentId(), updatedAt: new Date().toISOString() }
    setError('')
    setSaving(true)
    try {
      await saveProfileRemote(saved, { completeOnboarding: true })
      navigate('/')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se guardó tu perfil. Inténtalo de nuevo.')
    } finally { setSaving(false) }
  }

  return (
    <main className="page profile-page">
      <div className="page-heading">
        <h1>{onboarding ? 'Completa tu perfil' : 'Mi perfil'}</h1>
        <p>{onboarding ? 'Antes de comenzar, revisa tus datos y personaliza tu experiencia. Los intereses y preferencias son opcionales.' : 'Cuéntanos sobre ti para recibir recomendaciones más relevantes.'}</p>
      </div>
      {completeness < 100 && (
        <div className="completeness" aria-live="polite">
          <div className="completeness-row"><strong>{onboarding ? 'Datos básicos' : 'Completitud del perfil'}</strong><span>{completeness}%</span></div>
          <div className="progress-track"><div className="progress-value" style={{ width: `${completeness}%` }} /></div>
          <small>Completa tu personalización para recibir mejores recomendaciones.</small>
        </div>
      )}
      <form className="profile-form" onSubmit={handleSubmit} aria-busy={saving}>
        <fieldset className="profile-fields" disabled={saving}>
        <section className="form-card">
          <h2>Datos personales y académicos</h2>
          {academic ? <div className="academic-summary" aria-label="Datos académicos demo">
            <div><span>Matrícula</span><strong>{academic?.enrollment}</strong></div>
            <div><span>Campus</span><strong>{academic?.campus || profile?.campus || 'Sin campus'}</strong></div>
            <div><span>Nombre completo</span><strong>{academic?.fullName}</strong></div>
            <div><span>Carrera</span><strong>{academic?.career || profile?.career || 'Sin carrera'}</strong></div>
            <div><span>Periodo actual</span><strong>{academic?.semester || profile?.currentSemester}</strong></div>
          </div> : <div className="form-grid"><label>Campus<select required value={profile.campus} onChange={e => update('campus', e.target.value as StudentProfile['campus'])}><option value="">Selecciona campus</option>{campusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Carrera<select required value={profile.career} onChange={e => update('career', e.target.value as StudentProfile['career'])}><option value="">Selecciona carrera</option>{careerOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Periodo<input type="number" min="1" max="20" required value={profile.currentSemester === 'na' ? '' : profile.currentSemester} onChange={e => update('currentSemester', e.target.value ? Number(e.target.value) : '')} /></label></div>}
          {academic && <p className="field-help">¿Algo no coincide? <AskAssistantLink question="¿Cómo solicito la corrección de un dato académico incorrecto?">Pregunta a Compass cómo corregirlo</AskAssistantLink>.</p>}
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
          <div className="tags" aria-label="Intereses agregados">{profile.interests.filter((item) => !interestOptions.some((option) => option.toLowerCase() === item.toLowerCase())).map((item) => <span className="tag" key={item}>{item}<button type="button" aria-label={`Quitar ${item}`} onClick={() => update('interests', profile.interests.filter((interestItem) => interestItem !== item))}>×</button></span>)}</div>
        </section>
        <section className="form-card">
          <h2>¿Qué te gustaría encontrar en EBC Compass?</h2>
          <p className="field-help">Puedes elegir varias opciones para personalizar tus recomendaciones.</p>
          <div className="choice-list">{preferenceOptions.map((option) => <button type="button" className={`choice ${profile.preferences.includes(option) ? 'selected' : ''}`} key={option} onClick={() => update('preferences', profile.preferences.includes(option) ? profile.preferences.filter((item) => item !== option) : [...profile.preferences, option])}>{option}</button>)}</div>
        </section>
        <section className="form-card">
          <h2>Información para recomendaciones</h2>
          <label>Materias completadas <input value={profile.completedCourses.join(', ')} onChange={(e) => update('completedCourses', e.target.value.split(',').map((item) => item.trim()).filter(Boolean))} placeholder="Ej. Contabilidad, Matemáticas" /><span className="field-help">Sepáralas con comas.</span></label>
          <label>Metas profesionales <textarea rows={3} value={profile.goals} onChange={(e) => update('goals', e.target.value)} placeholder="Ej. Trabajar en banca digital" /></label>
        </section>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : onboarding ? 'Guardar y comenzar' : 'Guardar perfil'}</button>
        </fieldset>
      </form>
      {authConfigured && getToken() && (
        <div className="profile-signout">
          <button type="button" className="signout-link" onClick={() => { signOut(); window.location.assign('/acceso') }}>Cerrar sesión</button>
        </div>
      )}
    </main>
  )
}
