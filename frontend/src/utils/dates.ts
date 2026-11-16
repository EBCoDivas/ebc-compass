/** Formato único de fecha para toda la app: dd/MM/aaaa. */
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export function daysUntil(date: string, now: number = Date.now()): number {
  return Math.ceil((new Date(`${date}T23:59:59`).getTime() - now) / 86400000)
}

export type Urgency = 'urgent' | 'soon' | 'future'

export function urgencyFor(days: number): Urgency {
  return days <= 3 ? 'urgent' : days <= 7 ? 'soon' : 'future'
}

export function daysLabel(days: number): string {
  if (days < 0) return 'Vencida'
  if (days === 0) return 'Hoy'
  return days === 1 ? 'Falta 1 día' : `Faltan ${days} días`
}
