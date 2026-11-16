import { useEffect, useState } from 'react'
import { fetchAlerts, type Alert } from '../services/opportunityService'

const STORAGE_KEY = 'ebc_compass_dismissed_alerts'

export function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [dismissed, setDismissed] = useState<string[]>(() => JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as string[])
  useEffect(() => { fetchAlerts().then(setAlerts).catch(() => setAlerts([])) }, [])
  const visible = alerts.filter((alert) => !dismissed.includes(alert.id))
  function dismiss(id: string) { const next = [...dismissed, id]; setDismissed(next); window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }
  if (visible.length === 0) return null
  return <section className="dashboard-section alerts-section"><h2>Alertas</h2><ul className="alert-list">{visible.map((alert) => <li className={alert.urgency} key={alert.id}><div><strong>{alert.title}</strong><small>Vence en {alert.daysRemaining} {alert.daysRemaining === 1 ? 'día' : 'días'}</small></div><button className="dismiss-button" onClick={() => dismiss(alert.id)} aria-label={`Descartar alerta de ${alert.title}`}>×</button></li>)}</ul></section>
}
