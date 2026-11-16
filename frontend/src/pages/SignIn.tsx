import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authConfigured, signIn } from '../services/authService'

export function SignIn() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); try { await signIn(username, password); navigate('/') } catch { setError('No fue posible iniciar sesión. Verifica tus datos.') } }
  return <main className="page"><div className="page-heading"><h1>Iniciar sesión</h1><p>Accede para consultar tus recomendaciones personalizadas.</p></div><form className="form-card" onSubmit={submit}>{!authConfigured && <p className="institutional-note" role="status"><strong>Autenticación no configurada</strong><span>Este entorno local funciona con datos simulados. Cognito se habilita con las variables VITE_COGNITO_USER_POOL_ID y VITE_COGNITO_CLIENT_ID.</span></p>}<label>Correo electrónico<input type="email" required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label><label>Contraseña<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" type="submit" disabled={!authConfigured}>Iniciar sesión</button><Link to="/">Volver a Inicio</Link></form></main>
}
