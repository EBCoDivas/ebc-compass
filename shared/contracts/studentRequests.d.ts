/** Las solicitudes del alumno que Banner registra: beca y pago de inscripción, con su folio y su estado. */
export type StudentRequestKind = 'scholarship' | 'enrollment-payment'
export type StudentRequestStatus = 'in-review' | 'resolved'

export interface StudentRequestStep {
  label: string
  /** Fecha (aaaa-mm-dd) en que se cumplió el paso. Sin fecha, el paso sigue pendiente. */
  at?: string
  done: boolean
}

export interface StudentRequest {
  id: string
  kind: StudentRequestKind
  title: string
  folio: string
  /** Área de EBC que atiende la solicitud. */
  owner: string
  status: StudentRequestStatus
  /** Cómo terminó: «Aprobada», «Pagada». Solo si está resuelta. */
  outcome?: string
  submittedAt: string
  resolvedAt?: string
  /** Fecha estimada de respuesta (aaaa-mm-dd) mientras está en revisión. */
  estimatedResponse?: string
  detail?: string
  steps: StudentRequestStep[]
}

export interface StudentRequestsResponse { requests: StudentRequest[] }
