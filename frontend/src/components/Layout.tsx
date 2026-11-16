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
          <NavLink className="nav-link" to="/guardadas">Guardadas</NavLink>
        </nav>
      </header>
      {children}
      <footer>Escuela Bancaria y Comercial · EBC Compass</footer>
    </>
  )
}
