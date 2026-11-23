import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { sessionSubject } from '../services/session'
import { loadProfile, needsProfileSetup, synchronizeProfile } from '../services/profileService'
import { activePersona } from '../services/personaService'
import { hasJuryAccess } from '../services/juryAccounts'

/** Evita que Inicio, Perfil o Asistente lean una caché anterior a la carga durable. */
export function ProfileSession({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    synchronizeProfile().then(() => { if (active) setStatus('ready') })
      .catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [attempt])
  if (status === 'ready') {
    if (sessionSubject() && !hasJuryAccess(activePersona()?.id) && needsProfileSetup(loadProfile()) && pathname !== '/perfil') {
      return <Navigate to="/perfil" replace />
    }
    return children
  }
  return (
    <main className="page">
      {status === 'loading' ? <p role="status">Cargando tu perfil…</p> : <>
        <p role="alert">No pudimos cargar tu perfil. Tus cambios guardados siguen disponibles al recuperar la conexión.</p>
        <button className="button primary" type="button" onClick={() => { setStatus('loading'); setAttempt(current => current + 1) }}>Reintentar</button>
      </>}
    </main>
  )
}
