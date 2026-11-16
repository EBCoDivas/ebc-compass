import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn } from '../services/authService'

export function SignIn() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); try { await signIn(username, password); navigate('/') } catch { setError('No fue posible iniciar sesión. Verifica tus datos.') } }
  return <main className="page"><div className="page-heading"><p className="eyebrow">EBC COMPASS</p><h1>Iniciar sesión</h1><p>Accede para consultar tus recomendaciones personalizadas.</p></div><form className="form-card" onSubmit={submit}><label>Correo electrónico<input type="email" required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label><label>Contraseña<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" type="submit">Iniciar sesión</button><Link to="/">Volver a Inicio</Link></form></main>
}
