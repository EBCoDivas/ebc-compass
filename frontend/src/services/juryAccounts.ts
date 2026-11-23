import { demoUsername } from '../../../shared/demoAccounts.mjs'
import personas from '../../../shared/personas.json'
import { periodLabel } from './personaService'

export const juryPassword = import.meta.env.VITE_SHOW_JURY_ACCOUNTS === 'true'
  ? import.meta.env.VITE_JURY_DEMO_PASSWORD as string | undefined
  : undefined

export const juryAccounts = personas
  .flatMap(persona => persona.hasProfile && persona.juryOrder !== undefined ? [{ ...persona, order: persona.juryOrder }] : [])
  .sort((a, b) => a.order - b.order)
  .map(persona => ({
    id: persona.id,
    name: persona.name,
    email: demoUsername(persona.id),
    description: `${persona.program} · ${periodLabel(persona.period, persona.periodType)} · ${persona.campusName}`,
  }))

export function hasJuryAccess(personaId: string | undefined): boolean {
  return Boolean(juryPassword) && juryAccounts.some(account => account.id === personaId)
}
