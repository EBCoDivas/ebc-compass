import type { Opportunity } from '../services/opportunityService'
import type { StudentRouteItem } from '../../../shared/contracts/studentPlanning'

/**
 * Las tres capas del calendario:
 * - route: lo que te toca (la ruta del alumno: obligatorios y opcionales elegidos para su etapa).
 * - saved: lo que el alumno agregó desde Oportunidades.
 * - more: el resto de fechas del catálogo de su etapa (plegadas para no abrumar).
 */
export type CalendarLayer = 'route' | 'saved' | 'more'
export interface CalendarEntry { item: Opportunity; date: string; layer: CalendarLayer; required?: boolean }

export function calendarEntries(catalog: Opportunity[], route: Pick<StudentRouteItem, 'opportunityId' | 'dueDate' | 'required'>[], saved: string[]): CalendarEntry[] {
  const byId = new Map(catalog.map(item => [item.id, item]))
  const entries: CalendarEntry[] = []
  const used = new Set<string>()
  for (const step of route) {
    const item = byId.get(step.opportunityId)
    if (!item || used.has(item.id)) continue
    used.add(item.id)
    entries.push({ item, date: step.dueDate, layer: 'route', required: step.required })
  }
  for (const id of saved) {
    const item = byId.get(id)
    if (!item?.deadline || used.has(id)) continue
    used.add(id)
    entries.push({ item, date: item.deadline, layer: 'saved' })
  }
  for (const item of catalog) {
    if (!item.deadline || used.has(item.id)) continue
    entries.push({ item, date: item.deadline, layer: 'more' })
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.item.title.localeCompare(b.item.title))
}
