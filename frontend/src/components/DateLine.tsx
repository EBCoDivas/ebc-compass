import type { OpportunityType } from '../services/opportunityService'
import { daysLabel, daysUntil, formatShortDate, urgencyFor } from '../utils/dates'
import { dateLabelFor } from '../utils/opportunityTypes'

/** Fecha de una tarjeta: etiqueta y fecha corta; los días restantes solo llevan color cuando urge. */
export function DateLine({ type, deadline }: { type: OpportunityType; deadline: string }) {
  const days = daysUntil(deadline)
  return (
    <span className={`card-date ${urgencyFor(days)}`}>
      <span>{dateLabelFor(type)}: {formatShortDate(deadline)}</span>
      <strong>{daysLabel(days)}</strong>
    </span>
  )
}
