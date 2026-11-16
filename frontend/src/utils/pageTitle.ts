import { useEffect } from 'react'

/** Título de pestaña por pantalla (ayuda a lectores de pantalla y al historial). */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · EBC Compass` : 'EBC Compass'
  }, [title])
}
