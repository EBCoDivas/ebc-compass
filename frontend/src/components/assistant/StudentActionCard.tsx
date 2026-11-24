import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ActionProposal, ActionReceipt } from '../../../../shared/contracts/studentActions'
import { AssistantError, confirmAction, letterProblem, loadActionReceipt, STUDENT_ACTION_CONFIRMED } from '../../services/assistantService'
import { formatShortDate } from '../../utils/dates'

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 })
const paymentDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' })
const size = (bytes: number) => bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`

function Icon({ name }: { name: 'scholarship' | 'payment' | 'check' | 'file' }) {
  const paths = {
    scholarship: <><path d="M3 9.5 12 5l9 4.5-9 4.5z" /><path d="M7 12v4.2c0 1 2.2 2.3 5 2.3s5-1.3 5-2.3V12" /></>,
    payment: <><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M3 10h18M7 15h3" /></>,
    check: <path d="m5 12.5 4.2 4.2L19 7" />,
    file: <><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" /><path d="M14 3.5V8h4" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function PaymentCard({ brand, last4, holder, expires }: { brand: string; last4: string; holder?: string; expires?: string }) {
  return (
    <div className="pay-card" role="group" aria-label={`Tarjeta ${brand} terminación ${last4}`}>
      <span className="pay-card-brand">{brand}</span>
      <span className="pay-card-number" aria-hidden="true">•••• •••• •••• {last4}</span>
      <span className="pay-card-meta">
        {holder && <span>{holder}</span>}
        {expires && <span>Vence {expires}</span>}
      </span>
    </div>
  )
}

export function StudentActionCard({ proposal, waitingForHistory }: { proposal: ActionProposal; waitingForHistory?: boolean }) {
  const [receipt, setReceipt] = useState<ActionReceipt | null>(null)
  const [letter, setLetter] = useState<File | null>(null)
  const [letterError, setLetterError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const submission = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const scholarship = proposal.kind === 'request-scholarship'
  const historical = proposal.kind === 'generate-enrollment-slip'
  const title = scholarship ? 'Solicitud de beca de primer ingreso' : historical ? 'Ficha de inscripción' : 'Pago de inscripción'
  const details = receipt ?? proposal
  const needsLetter = Boolean(proposal.requiresMotivationLetter)
  const blocked = submitting || waitingForHistory || (needsLetter && !letter)

  useEffect(() => {
    const abort = new AbortController()
    const refresh = () => {
      if (waitingForHistory) return
      loadActionReceipt(proposal, abort.signal).then(result => {
        if (!abort.signal.aborted && result) setReceipt(result)
      }).catch(() => { /* La confirmación informa cualquier error de servicio. */ })
    }
    refresh()
    window.addEventListener(STUDENT_ACTION_CONFIRMED, refresh)
    return () => { abort.abort(); window.removeEventListener(STUDENT_ACTION_CONFIRMED, refresh) }
  }, [proposal, waitingForHistory])

  function choose(file: File | undefined) {
    if (!file) return
    const problem = letterProblem(file)
    setLetterError(problem ?? '')
    setLetter(problem ? null : file)
    setNotice('')
  }

  async function confirm() {
    if (submission.current || receipt || historical || blocked) return
    submission.current = true
    setNotice('')
    setSubmitting(true)
    try {
      const result = await confirmAction(proposal, needsLetter ? letter ?? undefined : undefined)
      setReceipt(result)
      window.dispatchEvent(new Event(STUDENT_ACTION_CONFIRMED))
    } catch (error) {
      setNotice(error instanceof AssistantError ? error.message : 'No pudimos completar la confirmación. Intenta de nuevo.')
    } finally {
      submission.current = false
      setSubmitting(false)
    }
  }

  const done = Boolean(receipt)
  const status = done ? (scholarship ? 'En revisión' : 'Pagado') : historical ? 'Registrado' : 'Por confirmar'
  const card = proposal.kind === 'pay-enrollment' ? proposal.paymentMethod : undefined
  const paidWith = receipt?.kind === 'pay-enrollment' ? receipt.paymentMethod : undefined

  return (
    <section className={`student-action ${scholarship ? 'is-scholarship' : 'is-payment'}${done ? ' is-done' : ''}`} aria-label={title}>
      <header>
        <span className="student-action-icon"><Icon name={scholarship ? 'scholarship' : 'payment'} /></span>
        <h3>{title}</h3>
        <span className={`student-action-pill${done ? ' done' : ''}`}>{status}</span>
      </header>

      {details.kind !== 'request-scholarship' ? (
        <>
          <p className="student-action-amount"><span>Importe</span><strong>{money.format(details.payment.amount)} <small>MXN</small></strong></p>
          {!done && (card
            ? <PaymentCard brand={card.brand} last4={card.last4} holder={card.holder} expires={card.expires} />
            : null)}
          <dl>
            {paidWith && <div><dt>Pagado con</dt><dd>{paidWith.brand} •••• {paidWith.last4}</dd></div>}
            {receipt && receipt.kind !== 'request-scholarship' && <div><dt>{historical ? 'Referencia' : 'Comprobante'}</dt><dd>{receipt.payment.reference}</dd></div>}
            {receipt?.kind === 'pay-enrollment'
              ? <div><dt>Fecha de pago</dt><dd>{formatShortDate(paymentDay.format(new Date(receipt.confirmedAt)))}</dd></div>
              : <div><dt>Fecha límite</dt><dd>{formatShortDate(details.payment.dueDate)}</dd></div>}
          </dl>
        </>
      ) : (
        <dl>
          <div><dt>Fecha límite</dt><dd>{formatShortDate(details.dueDate)}</dd></div>
          {receipt?.kind === 'request-scholarship' && receipt.folio && <div><dt>Folio</dt><dd>{receipt.folio}</dd></div>}
          {receipt?.kind === 'request-scholarship' && receipt.motivationLetter && <div><dt>Carta de motivos</dt><dd>{receipt.motivationLetter.name}</dd></div>}
        </dl>
      )}

      {done ? (
        <p className="student-action-status" role="status">
          <Icon name="check" />
          <span><strong>{scholarship ? 'Solicitud enviada.' : 'Pago registrado.'}</strong> <Link to="/solicitudes">Ver mis solicitudes</Link></span>
        </p>
      ) : historical ? <p className="student-action-note">Pide a Compass que prepare el pago de inscripción.</p> : (
        <>
          {needsLetter && (
            <div className="letter-upload">
              <input ref={fileInput} id={hintId + '-file'} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="visually-hidden" disabled={submitting} aria-describedby={hintId}
                onChange={event => { choose(event.target.files?.[0]); event.target.value = '' }} />
              {letter ? (
                <div className="letter-file">
                  <Icon name="file" />
                  <span><strong>{letter.name}</strong><small>{size(letter.size)}</small></span>
                  <button type="button" onClick={() => { setLetter(null); setLetterError('') }} disabled={submitting}>Quitar<span className="visually-hidden"> carta</span></button>
                </div>
              ) : (
                <label htmlFor={hintId + '-file'} className={`letter-drop${dragging ? ' dragging' : ''}`}
                  onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
                  onDrop={event => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]) }}>
                  <Icon name="file" />
                  <span><strong>Sube tu carta de motivos</strong><small id={hintId}>PDF o Word, hasta 1.5 MB</small></span>
                </label>
              )}
              {letterError && <p className="form-error" role="alert">{letterError}</p>}
            </div>
          )}
          <button type="button" className="button primary" onClick={() => void confirm()} disabled={blocked}>
            {submitting ? 'Confirmando…' : scholarship ? 'Enviar solicitud' : `Pagar ${money.format(details.kind === 'request-scholarship' ? 0 : details.payment.amount)}`}
          </button>
        </>
      )}
      {notice && <p className="form-error" role="alert">{notice}</p>}
    </section>
  )
}
