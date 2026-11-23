export type AuditRecord = { id: string; createdAt: string; owner: string; conversationId: string; agent: string; tools: string[]; usefulInfo: string[]; intent?: string; latencyMs: number; guardrail: string; rating?: 'positive' | 'negative'; mode: string }
const records: AuditRecord[] = []
export function recordAudit(record: Omit<AuditRecord, 'id' | 'createdAt'>) {
  records.unshift({ ...record, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
  if (records.length > 100) records.pop()
}
export function listAudit() { return records.map(({ owner: _owner, ...record }) => record) }
export function rateAudit(conversationId: string, rating: 'positive' | 'negative') {
  const record = records.find(item => item.conversationId === conversationId && !item.rating)
  if (record) record.rating = rating
}
