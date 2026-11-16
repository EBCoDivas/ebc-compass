import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="site-header">
        <NavLink className="brand" to="/"><img src="/ebc-logo.svg" alt="EBC - La Escuela de Negocios de México" /><span>Compass</span></NavLink>
        <nav aria-label="Navegación principal">
          <NavLink className="nav-link" to="/">Inicio</NavLink>
          <NavLink className="nav-link" to="/catalogo">Oportunidades</NavLink>
          <NavLink className="nav-link" to="/calendario">Calendario</NavLink>
          <NavLink className="nav-link" to="/asistente">Conversar</NavLink>
        </nav>
      </header>
      {children}
      <nav className="mobile-nav" aria-label="Navegación móvil">
        <NavLink className="mobile-nav-link" to="/"><span aria-hidden="true">⌂</span><span>Inicio</span></NavLink>
        <NavLink className="mobile-nav-link" to="/catalogo"><span aria-hidden="true">▦</span><span>Oportunidades</span></NavLink>
        <NavLink className="mobile-nav-link" to="/calendario"><span aria-hidden="true">□</span><span>Calendario</span></NavLink>
        <NavLink className="mobile-nav-link" to="/asistente"><span aria-hidden="true">◌</span><span>Conversar</span></NavLink>
      </nav>
      <footer>Escuela Bancaria y Comercial · EBC Compass</footer>
    </>
  )
}
