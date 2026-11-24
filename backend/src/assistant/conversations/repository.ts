import { randomUUID } from 'node:crypto'
import type { AssistantReply, ChatMessage, Intent, Language, Source, LlmUsage } from '../types.js'
import { Conflict, FeedbackLocked, NotFound, type DocumentStore, type Value } from './store.js'

export interface Conversation {
  id: string; title: string; createdAt: string; updatedAt: string; preview: string; messageCount: number; version: number
  language: Language; lastIntent?: Intent; summary: string; summarizedCount: number; summaryCursor?: string
  lease?: { token: string; until: number }; deleted?: boolean; deleting?: boolean; renamed?: boolean
  memoryCursor?: string
  maintenance?: { token: string; until: number }
}
export interface ArchivedMessage extends ChatMessage {
  feedback?: 'positive' | 'negative'; sources?: Source[]; suggestions?: string[]; usage?: LlmUsage; mode?: AssistantReply['generatedBy']
  /** Datos del turno que la interfaz muestra y no deben perderse al recargar. */
  latencyMs?: number; degraded?: boolean
}
export interface Turn { requestId: string; student: ChatMessage; reply: AssistantReply }
export type MemoryKey = `note:${number}` | 'career' | 'campus' | 'semester' | 'interests' | 'goal' | 'schedule' | 'language' | 'modality' | 'workSchedule'
export interface MemoryFact {
  key: MemoryKey; value: string; origin: 'profile' | 'conversation' | 'user' | 'demo'; sourceMessageId?: string; updatedAt: string
  version: number; suppressed?: boolean
  observedAt?: string
}
const value = (item: object) => item as Value
const metaKey = (id: string) => 'CONV#' + id
const msgPrefix = (id: string) => 'MSG#' + id + '#'
const turnKey = (id: string, request: string) => 'TURN#' + id + '#' + request
const proactiveKey = (notice: string) => 'PROACTIVE#' + notice
const messageKey = (id: string, message: ChatMessage) => msgPrefix(id) + message.createdAt + '#' + (message.role === 'student' ? '0#' : '1#') + message.id
const TOPIC_INTENTS = ['scholarship-info', 'course-info', 'procedure-info', 'event-info', 'career-info', 'recommendation-request', 'deadline-query']

export class ConversationRepository {
  constructor(readonly store: DocumentStore) {}
  async get(owner: string, id: string): Promise<Conversation | undefined> { return await this.store.get(owner, metaKey(id)) as unknown as Conversation | undefined }
  async require(owner: string, id: string): Promise<Conversation> {
    const conversation = await this.get(owner, id)
    if (!conversation || conversation.deleted || conversation.deleting) throw new NotFound('No encontramos esa conversación.')
    return conversation
  }
  async create(owner: string, id: string): Promise<Conversation> {
    const stamp = new Date().toISOString()
    const conversation: Conversation = { id, title: 'Nueva conversación', createdAt: stamp, updatedAt: stamp, preview: '', messageCount: 0, version: 0, language: 'es', summary: '', summarizedCount: 0 }
    await this.store.write(owner, [{ key: metaKey(id), value: value(conversation) }])
    return conversation
  }
  async createProactive(owner: string, notice: string, title: string, content: string, suggestions: string[]) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const mapped = await this.store.get(owner, proactiveKey(notice)) as { conversationId?: string; version?: number } | undefined
      if (typeof mapped?.conversationId === 'string') {
        const current = await this.get(owner, mapped.conversationId)
        if (current && !current.deleted && !current.deleting) return current
      }
      const id = randomUUID()
      const stamp = new Date().toISOString()
      const message: ChatMessage = { id: randomUUID(), role: 'assistant', content, language: 'es', intent: 'unknown', createdAt: stamp, suggestions }
      const conversation: Conversation = { id, title, createdAt: stamp, updatedAt: stamp, preview: content.slice(0, 160), messageCount: 1, version: 0, language: 'es', summary: '', summarizedCount: 0 }
      try {
        await this.store.write(owner, [
          { key: proactiveKey(notice), value: value({ conversationId: id, version: Number(mapped?.version ?? -1) + 1 }), version: mapped?.version },
          { key: metaKey(id), value: value(conversation) }, { key: messageKey(id, message), value: value(message) },
        ])
        return conversation
      } catch (error) { if (!(error instanceof Conflict) || attempt === 2) throw error }
    }
    throw new Conflict('No pudimos crear la conversación de Compass.')
  }
  async list(owner: string, limit = 30, cursor?: string) {
    const page = await this.store.page(owner, 'CONV#', limit, cursor)
    return { conversations: page.items.map(item => item.value as unknown as Conversation).filter(item => !item.deleted && !item.deleting)
      .map(({ id, title, createdAt, updatedAt, preview, messageCount, language }) => ({ id, title, createdAt, updatedAt, preview, messageCount, language })), nextCursor: page.cursor }
  }
  async messages(owner: string, id: string, limit = 50, cursor?: string, reverse = false) {
    await this.require(owner, id)
    const page = await this.store.page(owner, msgPrefix(id), limit, cursor, reverse)
    const messages = await Promise.all(page.items.map(async item => {
      const message = item.value as unknown as ArchivedMessage
      const rating = message.role === 'assistant' ? await this.store.get(owner, `FEEDBACK#${id}#${message.id}`) : undefined
      return { ...message, ...(rating?.rating ? { feedback: rating.rating as 'positive' | 'negative' } : {}) }
    }))
    return { messages, nextCursor: page.cursor }
  }
  async rate(owner: string, id: string, messageId: string, rating: 'positive' | 'negative' | null) {
    await this.require(owner, id)
    let cursor: string | undefined
    let found = false
    do {
      const page = await this.store.page(owner, msgPrefix(id), 100, cursor)
      found = page.items.some(item => item.value.id === messageId && item.value.role === 'assistant')
      cursor = page.cursor
    } while (!found && cursor)
    if (!found) throw new NotFound('No encontramos esa respuesta.')
    const key = `FEEDBACK#${id}#${messageId}`
    const current = await this.store.get(owner, key)
    const saved = (current?.rating ?? null) as 'positive' | 'negative' | null
    if (saved === rating) return
    if (saved !== null) throw new FeedbackLocked('Ya valoraste esta respuesta.')
    if (rating === null) return
    const stamp = new Date().toISOString()
    try {
      await this.store.write(owner, [{ key, value: { rating, messageId, conversationId: id,
        createdAt: current?.createdAt ?? stamp, updatedAt: stamp, version: Number(current?.version ?? -1) + 1 },
        version: current?.version as number | undefined }])
    } catch (error) {
      // Dos valoraciones simultáneas: gana la primera; repetir la misma es inofensivo.
      if (!(error instanceof Conflict)) throw error
      if ((await this.store.get(owner, key))?.rating === rating) return
      throw new FeedbackLocked('Ya valoraste esta respuesta.')
    }
    // If deletion ran concurrently, do not leave feedback for a deleted conversation.
    try { await this.require(owner, id) } catch (error) { await this.store.remove(owner, [key]); throw error }
  }
  async acquire(owner: string, id: string, token: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await this.require(owner, id)
      if (current.lease && current.lease.until > Date.now()) throw new Conflict('Hay una respuesta en curso. Intenta nuevamente en un momento.')
      try { await this.store.write(owner, [{ key: metaKey(id), value: value({ ...current, version: current.version + 1, lease: { token, until: Date.now() + 120000 } }), version: current.version }]); return }
      catch (error) { if (!(error instanceof Conflict) || attempt === 2) throw error }
    }
  }
  async release(owner: string, id: string, token: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await this.get(owner, id)
      if (!current || current.lease?.token !== token) return
      const { lease: _lease, ...rest } = current
      try { await this.store.write(owner, [{ key: metaKey(id), value: value({ ...rest, version: current.version + 1 }), version: current.version }]); return }
      catch (error) { if (!(error instanceof Conflict) || attempt === 2) throw error }
    }
  }
  async maintenanceLock(owner: string, id: string, token: string, release = false) {
    const current = await this.require(owner, id)
    if (!release && current.maintenance && current.maintenance.until > Date.now()) return false
    if (release && current.maintenance?.token !== token) return false
    const { maintenance: _maintenance, ...rest } = current
    const next = release ? rest : { ...rest, maintenance: { token, until: Date.now() + 120000 } }
    await this.store.write(owner, [{ key: metaKey(id), value: value({ ...next, version: current.version + 1 }), version: current.version }])
    return true
  }
  async turn(owner: string, id: string, requestId: string): Promise<Turn | undefined> { return await this.store.get(owner, turnKey(id, requestId)) as unknown as Turn | undefined }
  async append(owner: string, id: string, turn: Turn) {
    const existing = await this.turn(owner, id, turn.requestId)
    if (existing) {
      if (existing.student.content !== turn.student.content) throw new Conflict('requestId ya fue utilizado con otro mensaje.')
      return
    }
    const current = await this.require(owner, id)
    const { reply, student } = turn
    const assistant: ArchivedMessage = { id: reply.id, role: 'assistant', content: reply.content, language: reply.language, intent: reply.intent,
      createdAt: reply.createdAt, sources: reply.sources, suggestions: reply.suggestions, usage: reply.usage, mode: reply.generatedBy,
      model: reply.model, inputBlock: reply.inputBlock, interrupted: reply.interrupted, failure: reply.failure, catalogFallback: reply.catalogFallback, latencyMs: reply.latencyMs, degraded: reply.degraded, actionProposal: reply.actionProposal }
    await this.store.write(owner, [
      { key: metaKey(id), value: value({ ...current, version: current.version + 1,
        title: !current.messageCount && !current.renamed ? student.content.slice(0, 80) : current.title,
        updatedAt: reply.createdAt, preview: reply.content.slice(0, 160), language: reply.language,
        lastIntent: TOPIC_INTENTS.includes(reply.intent) ? reply.intent : current.lastIntent, messageCount: current.messageCount + 2 }), version: current.version },
      { key: messageKey(id, student), value: value(student) }, { key: messageKey(id, assistant), value: value(assistant) },
      { key: turnKey(id, turn.requestId), value: value(turn) },
    ])
  }
  async importLegacy(owner: string, id: string, messages: ChatMessage[]) {
    if (await this.get(owner, id)) return
    const stamp = messages[0]?.createdAt ?? new Date().toISOString()
    const conversation: Conversation = { id, title: messages.find(item => item.role === 'student')?.content.slice(0, 80) ?? 'Conversación',
      createdAt: stamp, updatedAt: messages.at(-1)?.createdAt ?? stamp, preview: messages.at(-1)?.content.slice(0, 160) ?? '',
      messageCount: messages.length, version: 0, language: messages.at(-1)?.language ?? 'es', lastIntent: [...messages].reverse().find(message => message.intent && TOPIC_INTENTS.includes(message.intent))?.intent, summary: '', summarizedCount: 0 }
    try { await this.store.write(owner, [{ key: metaKey(id), value: value(conversation) }, ...messages.map(message => ({ key: messageKey(id, message), value: value(message) }))]) }
    catch (error) { if (!(error instanceof Conflict) || !(await this.get(owner, id))) throw error }
  }
  async rename(owner: string, id: string, title: string) {
    const current = await this.require(owner, id)
    if (current.lease?.until && current.lease.until > Date.now()) throw new Conflict('Espera a que termine la respuesta.')
    await this.store.write(owner, [{ key: metaKey(id), value: value({ ...current, title, renamed: true, version: current.version + 1 }), version: current.version }])
  }
  async remove(owner: string, id: string, deleteCheckpoint: () => Promise<void>) {
    const current = await this.get(owner, id)
    if (!current || current.deleted) throw new NotFound('No encontramos esa conversación.')
    if (current.lease && current.lease.until > Date.now()) throw new Conflict('Espera a que termine la respuesta.')
    const deleting = { ...current, deleting: true, version: current.version + 1 }
    if (!current.deleting) await this.store.write(owner, [{ key: metaKey(id), value: value(deleting), version: current.version }])
    await deleteCheckpoint()
    for (const prefix of [msgPrefix(id), 'TURN#' + id + '#', 'FEEDBACK#' + id + '#']) {
      let page
      do { page = await this.store.page(owner, prefix, 100); await this.store.remove(owner, page.items.map(item => item.key)) } while (page.items.length)
    }
    const last = (await this.get(owner, id))!
    // An ID-only tombstone prevents an old checkpoint or retry from resurrecting deleted content.
    await this.store.write(owner, [{ key: metaKey(id), value: { id, deleted: true, version: last.version + 1 }, version: last.version }])
  }
  async saveSummary(owner: string, id: string, summary: string, count: number, cursor: string | undefined) {
    const current = await this.require(owner, id)
    await this.store.write(owner, [{ key: metaKey(id), value: value({ ...current, summary, summarizedCount: count, summaryCursor: cursor, version: current.version + 1 }), version: current.version }])
  }
  async saveMemoryCursor(owner: string, id: string, memoryCursor: string) {
    const current = await this.require(owner, id)
    await this.store.write(owner, [{ key: metaKey(id), value: value({ ...current, memoryCursor, version: current.version + 1 }), version: current.version }])
  }
  async memories(owner: string): Promise<MemoryFact[]> {
    const page = await this.store.page(owner, 'MEM#', 50)
    return page.items.map(item => item.value as unknown as MemoryFact)
  }
  async saveNote(owner: string, text: string): Promise<boolean> {
    if ((await this.memories(owner)).some(fact => !fact.suppressed && fact.value === text && fact.key.startsWith('note:'))) return true
    for (let slot = 1; slot <= 10; slot++) {
      const key = 'note:' + slot as MemoryKey
      const current = await this.store.get(owner, 'MEM#' + key) as unknown as MemoryFact | undefined
      if (current?.value && !current.suppressed) {
        if (current.value === text) return true
        continue
      }
      const stamp = new Date().toISOString()
      try {
        await this.store.write(owner, [{ key: 'MEM#' + key, value: value({ key, value: text, origin: 'user', observedAt: stamp, updatedAt: stamp, version: (current?.version ?? -1) + 1 }), version: current?.version }])
        return true
      } catch (error) { if (!(error instanceof Conflict)) throw error }
    }
    return false
  }
  async saveMemory(owner: string, fact: Omit<MemoryFact, 'version' | 'updatedAt'>, respectSuppression = true) {
    const current = await this.store.get(owner, 'MEM#' + fact.key) as unknown as MemoryFact | undefined
    if (fact.origin === 'demo' && current) return
    if (respectSuppression && current?.suppressed) return
    if (fact.origin !== 'user' && current?.origin === 'user' && current.value) return
    if (current && fact.origin === 'profile' && current.value === fact.value && current.origin === fact.origin && !current.suppressed && !fact.suppressed) return
    if (fact.origin === 'conversation' && current?.origin === 'profile' && current.value) return
    const observedAt = fact.observedAt ?? new Date().toISOString()
    if (fact.origin === 'conversation' && current?.observedAt && observedAt <= current.observedAt) return
    try {
      await this.store.write(owner, [{ key: 'MEM#' + fact.key, value: value({ ...fact, observedAt, updatedAt: new Date().toISOString(), version: (current?.version ?? -1) + 1 }), version: current?.version }])
    } catch (error) {
      if (fact.origin !== 'demo' || !(error instanceof Conflict)) throw error
    }
  }
}
