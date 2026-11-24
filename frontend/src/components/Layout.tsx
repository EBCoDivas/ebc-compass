import { getToken, signOut, authConfigured } from '../services/authService'
import { tokenClaims } from '../services/session'
import { NavLink, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { usePageTitle } from '../utils/pageTitle'
import { AssistantDockProvider } from './assistant/AssistantDock'

const titles: Record<string, string> = { '/': 'Inicio', '/catalogo': 'Oportunidades', '/calendario': 'Calendario', '/asistente': 'Compass', '/perfil': 'Mi perfil', '/solicitudes': 'Seguimiento', '/admin': 'Administración', '/acceso': 'Iniciar sesión' }

function NavIcon({ type }: { type: 'home' | 'opportunities' | 'calendar' | 'requests' | 'chat' }) {
  const paths = {
    home: 'M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-9ZM9 21v-6h6v6',
    opportunities: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    calendar: 'M5 3v3M19 3v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
    requests: 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1ZM6 6h12a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM9 12h6M9 16h4',
    chat: 'M20 11.5a7.5 7.5 0 0 1-8 7.5 8.8 8.8 0 0 1-3.5-.7L4 20l1.7-3.6A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z',
  }
  return <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"><path d={paths[type]} /></svg>
}

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join('') || 'E'
}

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  usePageTitle(titles[pathname] ?? '')
  const token = getToken()
  const signedOut = authConfigured && !token
  const claims = tokenClaims(token)
  const fullName = String(claims?.name ?? claims?.email ?? 'Estudiante')
  const isAdmin = (Array.isArray(claims?.['cognito:groups']) && claims['cognito:groups'].map(String).includes('admin')) || claims?.['custom:role'] === 'admin'
  const dockEnabled = !signedOut && pathname !== '/asistente' && pathname !== '/acceso'
  return (
    <AssistantDockProvider enabled={dockEnabled}>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="site-header">
        <NavLink className="brand" to="/"><img src="/ebc-compass-mark.svg" alt="" width="40" height="40" /><span className="brand-word">EBC <em>Compass</em></span></NavLink>
        {!signedOut && <nav aria-label="Navegación principal">
          <NavLink className="nav-link" to="/"><NavIcon type="home" />Inicio</NavLink>
          <NavLink className="nav-link" to="/catalogo"><NavIcon type="opportunities" />Oportunidades</NavLink>
          <NavLink className="nav-link" to="/calendario"><NavIcon type="calendar" />Calendario</NavLink>
          <NavLink className="nav-link" to="/solicitudes"><NavIcon type="requests" />Seguimiento</NavLink>
          <NavLink className="nav-link" to="/asistente"><NavIcon type="chat" />Conversar</NavLink>
          {isAdmin && <NavLink className="nav-link" to="/admin">Administración</NavLink>}
        </nav>}
        {authConfigured && token && <div className="session-menu">
          <NavLink className="profile-link" to="/perfil" aria-label={`Mi perfil, ${fullName}`} title="Mi perfil">
            <span className="avatar" aria-hidden="true">{initialsOf(fullName)}</span>
            <span className="profile-name" aria-hidden="true">{fullName.split(/\s+/)[0]}</span>
          </NavLink>
          <button type="button" className="signout-link" onClick={() => { signOut(); window.location.assign('/acceso') }}>Cerrar sesión</button>
        </div>}
      </header>
      <div id="contenido" tabIndex={-1}>{children}</div>
      {!signedOut && <nav className="mobile-nav" aria-label="Navegación móvil">
        <NavLink className="mobile-nav-link" to="/"><NavIcon type="home" /><span>Inicio</span></NavLink>
        <NavLink className="mobile-nav-link" to="/catalogo"><NavIcon type="opportunities" /><span>Oportunidades</span></NavLink>
        <NavLink className="mobile-nav-link" to="/calendario"><NavIcon type="calendar" /><span>Calendario</span></NavLink>
        <NavLink className="mobile-nav-link" to="/solicitudes"><NavIcon type="requests" /><span>Seguimiento</span></NavLink>
        <NavLink className="mobile-nav-link" to="/asistente"><NavIcon type="chat" /><span>Conversar</span></NavLink>
      </nav>}
      <footer>EBC Compass, un proyecto para estudiantes de la Escuela Bancaria y Comercial.</footer>
    </AssistantDockProvider>
  )
}
