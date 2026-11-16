import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="site-header">
        <NavLink className="brand" to="/">EBC <span>Compass</span></NavLink>
        <nav aria-label="Navegación principal">
          <NavLink className="nav-link" to="/">Inicio</NavLink>
          <NavLink className="nav-link" to="/perfil">Mi perfil</NavLink>
        </nav>
      </header>
      {children}
      <footer>Escuela Bancaria y Comercial · EBC Compass</footer>
    </>
  )
}
