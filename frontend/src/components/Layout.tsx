import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

function NavIcon({ type }: { type: 'home' | 'opportunities' | 'calendar' | 'chat' }) {
  const paths = {
    home: 'M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-9ZM9 21v-6h6v6',
    opportunities: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    calendar: 'M5 3v3M19 3v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
    chat: 'M20 11.5a7.5 7.5 0 0 1-8 7.5 8.8 8.8 0 0 1-3.5-.7L4 20l1.7-3.6A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z',
  }
  return <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"><path d={paths[type]} /></svg>
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="site-header">
        <NavLink className="brand" to="/"><img src="/ebc-logo.svg" alt="EBC - La Escuela de Negocios de México" /><span>Compass</span></NavLink>
        <nav aria-label="Navegación principal">
          <NavLink className="nav-link" to="/"><NavIcon type="home" />Inicio</NavLink>
          <NavLink className="nav-link" to="/catalogo"><NavIcon type="opportunities" />Oportunidades</NavLink>
          <NavLink className="nav-link" to="/calendario"><NavIcon type="calendar" />Calendario</NavLink>
          <NavLink className="nav-link" to="/asistente"><NavIcon type="chat" />Conversar</NavLink>
        </nav>
      </header>
      {children}
      <nav className="mobile-nav" aria-label="Navegación móvil">
        <NavLink className="mobile-nav-link" to="/"><NavIcon type="home" /><span>Inicio</span></NavLink>
        <NavLink className="mobile-nav-link" to="/catalogo"><NavIcon type="opportunities" /><span>Oportunidades</span></NavLink>
        <NavLink className="mobile-nav-link" to="/calendario"><NavIcon type="calendar" /><span>Calendario</span></NavLink>
        <NavLink className="mobile-nav-link" to="/asistente"><NavIcon type="chat" /><span>Conversar</span></NavLink>
      </nav>
      <footer>Escuela Bancaria y Comercial · EBC Compass</footer>
    </>
  )
}
