import type { OpportunityType } from '../services/opportunityService'
import { typeMeta } from '../utils/opportunityTypes'

/** Tipo de oportunidad: color + ícono + texto (nunca solo color). */
export function TypeBadge({ type }: { type: OpportunityType }) {
  const meta = typeMeta[type]
  return (
    <span className={`badge type-${type}`}>
      <svg aria-hidden="true" className="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"><path d={meta.icon} /></svg>
      {meta.label}
    </span>
  )
}
