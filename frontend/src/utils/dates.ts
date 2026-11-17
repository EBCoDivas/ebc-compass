/** Formato único de fecha para toda la app: dd/MM/aaaa. */
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

const shortMonth = new Intl.DateTimeFormat('es-MX', { month: 'short' })

/** Fecha corta para tarjetas y listas: "4 dic" (con año solo si no es el actual). */
export function formatShortDate(date: string, now: Date = new Date()): string {
  const [year, month, day] = date.split('-').map(Number)
  const label = `${day} ${shortMonth.format(new Date(year, month - 1, day)).replace('.', '')}`
  return year === now.getFullYear() ? label : `${label} ${year}`
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
