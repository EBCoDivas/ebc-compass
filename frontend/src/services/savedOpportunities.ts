import { useEffect, useState } from 'react'
import { personaStorageKey } from './personaService'

/**
 * Oportunidades que el alumno agregó a su calendario ("guardadas"). Viven en este navegador, por cuenta.
 * Oportunidades, Calendario e Inicio leen la misma lista y se enteran de los cambios con un evento.
 */
const KEY = 'ebc_compass_saved_opportunities'
const EVENT = 'ebc-saved-opportunities'

export function readSaved(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(personaStorageKey(KEY)) ?? '[]') as unknown
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function write(ids: string[]): void {
  try {
    window.localStorage.setItem(personaStorageKey(KEY), JSON.stringify(ids))
  } catch {
    // Sin almacenamiento la lista vive solo mientras la página está abierta.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: ids }))
}

/** Agrega o quita una oportunidad. Devuelve true si quedó guardada. */
export function toggleSaved(id: string): boolean {
  const current = readSaved()
  const saved = !current.includes(id)
  write(saved ? [...current, id] : current.filter(item => item !== id))
  return saved
}

export function useSavedOpportunities(): string[] {
  const [ids, setIds] = useState(readSaved)
  useEffect(() => {
    const update = () => setIds(readSaved())
    window.addEventListener(EVENT, update)
    window.addEventListener('storage', update)
    return () => { window.removeEventListener(EVENT, update); window.removeEventListener('storage', update) }
  }, [])
  return ids
}
