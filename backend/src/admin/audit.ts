import { randomUUID } from 'node:crypto'
import type { Claims } from '../auth/identity.js'
import { Conflict, MemoryDocumentStore, type DocumentStore, type Value } from '../assistant/conversations/store.js'

export type AuditUser = { name: string; personaId?: string }
export type AuditRating = 'positive' | 'negative'
export type AuditSource = { kind: 'opportunity' | 'document' | 'record'; id: string; title: string; origin?: 'vector' | 'keyword'; score?: number }
export type AuditRecord = {
  id: string; createdAt: string; owner: string; user: AuditUser; conversationId: string; messageId: string; agent: string
  /** Lo que escribió el alumno (o la acción que confirmó) y lo que respondió Compass, recortados para el panel. */
  question: string; answer: string
  tools: string[]; usefulInfo: string[]
  /** Fuentes con su tipo y, en las guías, cómo se recuperaron (vector store o respaldo) y su similitud. */
  sources?: AuditSource[]; intent?: string; latencyMs: number; guardrail: string; rating?: AuditRating; mode: string
}
export type NewAuditRecord = Omit<AuditRecord, 'id' | 'createdAt'>
export type PublicAuditRecord = Omit<AuditRecord, 'owner'>

// Las ejecuciones viven en la misma tabla de DynamoDB que el historial, en una partición propia ordenada por hora.
const AUDIT_OWNER = 'ADMIN#AUDIT'
const PREFIX = 'AUDIT#'
const MAX_TEXT = 600
const pointerKey = (messageId: string) => 'AUDITKEY#' + messageId

export const auditSources = (sources: readonly AuditSource[]): AuditSource[] => sources.slice(0, 6).map(({ kind, id, title, origin, score }) =>
  ({ kind, id: id.slice(0, 120), title: title.slice(0, 120), ...(origin ? { origin } : {}), ...(typeof score === 'number' ? { score } : {}) }))

export const clip = (text: string) => text.length > MAX_TEXT ? text.slice(0, MAX_TEXT - 1).trimEnd() + '…' : text

/** Quién ejecutó la acción, tal como lo muestra el panel: nombre y cuenta de demostración. Nunca el identificador del alumno. */
export function auditUser(claims: Claims | undefined): AuditUser {
  const text = (key: string) => typeof claims?.[key] === 'string' && claims[key] ? String(claims[key]).slice(0, 80) : undefined
  const personaId = text('custom:personaId')
  return { name: text('name') ?? text('email') ?? personaId ?? 'Usuario sin nombre', ...(personaId ? { personaId } : {}) }
}

export function createAuditLog(store: DocumentStore) {
  const guard = async <T>(label: string, fallback: T, run: () => Promise<T>) => {
    try { return await run() } catch (error) { console.error(JSON.stringify({ event: 'admin.audit.' + label + '.failed', error: (error as Error).name })); return fallback }
  }
  return {
    /** Una ejecución por mensaje: si se vuelve a registrar el mismo mensaje (por ejemplo, una confirmación repetida) se ignora. */
    record: (record: NewAuditRecord) => guard('record', undefined, async () => {
      const createdAt = new Date().toISOString()
      const key = PREFIX + createdAt + '#' + randomUUID()
      try { await store.write(record.owner, [{ key: pointerKey(record.messageId), value: { key } }]) } catch (error) {
        if (error instanceof Conflict) return
        throw error
      }
      await store.write(AUDIT_OWNER, [{ key, value: { ...record, id: key.split('#')[2], createdAt, version: 0 } as Value }])
    }),
    list: (limit = 100) => guard<PublicAuditRecord[]>('list', [], async () => {
      const page = await store.page(AUDIT_OWNER, PREFIX, limit, undefined, true)
      return page.items.map(({ value }) => { const { owner: _owner, version: _version, ...record } = value as AuditRecord & { version?: number }; return record })
    }),
    /** La valoración llega desde el chat sobre un mensaje concreto; `null` es quitarla. Solo la puede cambiar quien ejecutó la acción. */
    rate: (owner: string, conversationId: string, messageId: string, rating: AuditRating | null) => guard('rate', undefined, async () => {
      const pointer = await store.get(owner, pointerKey(messageId))
      const key = typeof pointer?.key === 'string' ? pointer.key : undefined
      for (let attempt = 0; key && attempt < 3; attempt++) {
        const current = await store.get(AUDIT_OWNER, key) as (Value & { owner?: string; conversationId?: string; version?: number; rating?: AuditRating }) | undefined
        if (!current || current.owner !== owner || current.conversationId !== conversationId) return
        const { rating: _previous, ...rest } = current
        try {
          await store.write(AUDIT_OWNER, [{ key, version: current.version ?? 0, value: { ...rest, ...(rating ? { rating } : {}), version: (current.version ?? 0) + 1 } }])
          return
        } catch (error) { if (!(error instanceof Conflict)) throw error }
      }
    }),
  }
}

export type AuditLog = ReturnType<typeof createAuditLog>
const logs = new WeakMap<DocumentStore, AuditLog>()
const fallbackStore = new MemoryDocumentStore()

/** Un registro por almacén: las rutas del chat, de las acciones y del panel comparten el mismo. */
export function auditLogFor(store: DocumentStore | undefined): AuditLog {
  const target = store ?? fallbackStore
  let log = logs.get(target)
  if (!log) { log = createAuditLog(target); logs.set(target, log) }
  return log
}
