import { useEffect, useState, type CSSProperties } from 'react'
import type { StudentAchievement, StudentJourney } from '../../../shared/contracts/studentPlanning'
import { personaStorageKey } from '../services/personaService'
import { formatShortDate } from '../utils/dates'
import { AskAssistantLink } from './assistant/AskAssistantLink'

const SEEN_KEY = 'ebc_compass_seen_achievements'

type Copy = { title: string; earned: string; past: string; locked: string; question: string; action: string }
const copy: Record<StudentAchievement['id'], Copy> = {
  'scholarship-requested': {
    title: 'Beca solicitada',
    earned: 'Tu solicitud de la beca de primer ingreso está en revisión.',
    past: 'Solicitaste la beca de primer ingreso al comenzar tu carrera.',
    locked: 'Envía tu solicitud de la beca de primer ingreso.',
    question: '¿Cómo solicito la beca de primer ingreso?',
    action: 'Solicitar con Compass',
  },
  'payment-slip-generated': {
    title: 'Ficha de pago generada',
    earned: 'Ya tienes tu ficha para pagar la inscripción.',
    past: 'Generaste tu ficha de inscripción de nuevo ingreso.',
    locked: 'Genera la ficha para pagar tu inscripción.',
    question: '¿Cómo genero mi ficha de pago de inscripción?',
    action: 'Generar con Compass',
  },
  'social-service-progress': {
    title: 'Servicio social avanzado',
    earned: 'Ya llevas más de la mitad de tus horas de servicio social.',
    past: 'Llegaste a la mitad de tus horas de servicio social.',
    locked: 'Llega a la mitad de tus horas de servicio social.',
    question: '¿Qué opciones de servicio social tengo?',
    action: 'Ver opciones con Compass',
  },
}

/** Logros que aún no se habían visto desbloqueados en este navegador: solo esos se celebran. */
function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(personaStorageKey(SEEN_KEY)) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function CompassStar() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 14.2 9.8 21.5 12 14.2 14.2 12 21.5 9.8 14.2 2.5 12 9.8 9.8Z" /></svg>
}

/** Un ícono por logro, para reconocerlo de un vistazo. Trazo como los íconos de la navegación. */
const icons: Record<StudentAchievement['id'], string[]> = {
  // Birrete: la beca de primer ingreso.
  'scholarship-requested': ['M2.5 9 12 4.5 21.5 9 12 13.5Z', 'M6.5 11.2v4.3c0 1.3 2.5 2.9 5.5 2.9s5.5-1.6 5.5-2.9v-4.3', 'M21.5 9v5.2'],
  // Recibo con borde cortado: la ficha de pago.
  'payment-slip-generated': ['M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21Z', 'M9 8h6', 'M9 11.5h6', 'M9 15h3.5'],
  // Mano que sostiene un corazón: el servicio a la comunidad.
  'social-service-progress': [
    'M12 12.4c-1.6-1.3-3.7-2.8-3.7-4.7 0-1.3 1-2.3 2.2-2.3.7 0 1.2.3 1.5.8.3-.5.8-.8 1.5-.8 1.2 0 2.2 1 2.2 2.3 0 1.9-2.1 3.4-3.7 4.7Z',
    'M3.5 15.3h3.3l2.6 1.8h4.5a1.3 1.3 0 0 0 0-2.6h-2.8',
    'M3.5 20.4h3.7l2 .9h5.5l4.8-4.2a1.3 1.3 0 0 0-1.8-1.9l-2.9 2.4',
  ],
}

function AchievementIcon({ id }: { id: StudentAchievement['id'] }) {
  return (
    <svg className={`achievement-icon icon-${id}`} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7">
      {icons[id].map(path => <path key={path} d={path} />)}
    </svg>
  )
}

/**
 * Logros del alumno como insignias: cada logro tiene su ícono dentro del mismo marco (anillo con el degradado
 * de marca al desbloquearse) y el sello de la brújula de Compass. Cada logro es un hito real calculado con reglas;
 * los pendientes dicen cómo desbloquearlos con Compass.
 */
export function StudentAchievements({ planning }: { planning: StudentJourney }) {
  const { achievements, socialService } = planning
  const earnedIds = achievements.filter(item => item.earned).map(item => item.id)
  // El historial de etapas anteriores no se celebra como nuevo: ya se había ganado.
  const celebrated = achievements.filter(item => item.earned && !item.earnedAt).map(item => item.id)
  const [fresh] = useState(() => {
    const seen = readSeen()
    return new Set(celebrated.filter(id => !seen.has(id)))
  })
  const earnedKey = earnedIds.join(',')
  useEffect(() => {
    if (!earnedKey) return
    try {
      const seen = readSeen()
      for (const id of earnedKey.split(',')) seen.add(id)
      window.localStorage.setItem(personaStorageKey(SEEN_KEY), JSON.stringify([...seen]))
    } catch {
      // Sin almacenamiento solo se pierde la celebración de "Nuevo".
    }
  }, [earnedKey])

  if (achievements.length === 0) return null
  const earnedCount = earnedIds.length
  const progress = socialService && socialService.requiredHours > 0
    ? Math.min(100, Math.round((socialService.completedHours / socialService.requiredHours) * 100))
    : undefined

  return (
    <section className="home-section achievements" aria-labelledby="student-achievements-title">
      <div className="section-heading">
        <h2 id="student-achievements-title">Tus logros</h2>
        <p className="achievement-count"><strong>{earnedCount}</strong> de {achievements.length} desbloqueados</p>
      </div>
      <div className="achievement-meter" role="img" aria-label={`${earnedCount} de ${achievements.length} logros desbloqueados`}>
        {achievements.map(item => <span key={item.id} className={item.earned ? 'is-earned' : undefined} />)}
      </div>
      <ul className="achievement-list">
        {achievements.map(item => {
          const text = copy[item.id]
          const hours = item.id === 'social-service-progress' && !item.earnedAt ? progress : undefined
          const isNew = item.earned && fresh.has(item.id)
          return (
            <li key={item.id} className={`achievement ${item.earned ? 'is-earned' : 'is-locked'}${item.earnedAt ? ' is-past' : ''}${isNew ? ' is-new' : ''}`}>
              <span
                className={`achievement-medal${hours !== undefined ? ' has-progress' : ''}`}
                style={hours !== undefined ? { '--progress': hours } as CSSProperties : undefined}
                aria-hidden="true"
              >
                <span className="achievement-core"><AchievementIcon id={item.id} /></span>
                <span className="achievement-seal"><CompassStar /></span>
              </span>
              <div className="achievement-body">
                <strong>{text.title}</strong>
                <small>{item.earnedAt
                  ? <>Desbloqueado el <time dateTime={item.earnedAt}>{formatShortDate(item.earnedAt)}</time></>
                  : item.earned ? 'Desbloqueado' : 'Por alcanzar'}</small>
                {isNew && <span className="achievement-new">Nuevo</span>}
                <p>{item.earnedAt ? text.past : item.earned ? text.earned : text.locked}</p>
                {hours !== undefined && socialService && (
                  <p className="achievement-hours">{socialService.completedHours} de {socialService.requiredHours} horas · {hours} %</p>
                )}
                {!item.earned && <AskAssistantLink className="achievement-action" question={text.question}>{text.action}</AskAssistantLink>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
