import { demoUsername } from '../../../shared/demoAccounts.mjs'
import personas from '../../../shared/personas.json'
import { periodLabel } from './personaService'

export const juryPassword = import.meta.env.VITE_SHOW_JURY_ACCOUNTS === 'true'
  ? import.meta.env.VITE_JURY_DEMO_PASSWORD as string | undefined
  : undefined

export const juryAccounts = personas
  .flatMap(persona => (persona.hasProfile || persona.role === 'admin') && persona.juryOrder !== undefined ? [{ ...persona, order: persona.juryOrder }] : [])
  // La cuenta de administración va al final: las escenas de alumnos siguen el orden de la historia.
  .sort((a, b) => Number(a.role === 'admin') - Number(b.role === 'admin') || a.order - b.order)
  .map(persona => ({
    id: persona.id,
    name: persona.name,
    email: demoUsername(persona.id),
    admin: persona.role === 'admin',
    description: persona.role === 'admin' ? 'Traza y observabilidad de Compass'
      : `${persona.program} · ${periodLabel(persona.period, persona.periodType)} · ${persona.campusName}`,
  }))

export function hasJuryAccess(personaId: string | undefined): boolean {
  return Boolean(juryPassword) && juryAccounts.some(account => account.id === personaId)
}
