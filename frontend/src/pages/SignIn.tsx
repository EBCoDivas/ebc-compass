import { useState, type FormEvent } from 'react'
import { authConfigured, signIn } from '../services/authService'

export function SignIn() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending) return
    setError('')
    setPending(true)
    try {
      await signIn(username, password)
      window.location.assign('/')
    } catch {
      setError('No fue posible iniciar sesión. Verifica tu correo y contraseña.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="page signin-page">
      <section className="signin-card" aria-labelledby="signin-title">
        <img src="/ebc-compass-mark.svg" alt="" width="56" height="56" />
        <h1 id="signin-title">Inicia sesión</h1>
        <p>Ten claro qué sigue: entra con tu cuenta para ver tus fechas, becas y cursos recomendados.</p>
        <form className="signin-form" onSubmit={submit} aria-busy={pending}>
          {!authConfigured && (
            <p className="institutional-note" role="status">
              <strong>Acceso no disponible</strong>
              <span>Contacta al equipo de Compass para habilitar el acceso.</span>
            </p>
          )}
          <label>Correo electrónico
            <input type="email" required value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" disabled={pending} />
          </label>
          <label>Contraseña
            <input type="password" required value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" disabled={pending} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button primary" type="submit" disabled={!authConfigured || pending}>
            {pending ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
      </section>
    </main>
  )
}
