import { requestsMemory } from './explicitMemory.js'
import { randomUUID } from 'node:crypto'
import type { AssistantGraph, TurnInput } from '../graph/assistantGraph.js'
import type { AssistantProfile, AssistantReply, ChatMessage } from '../types.js'
import { ConversationRepository, type ArchivedMessage, type Turn } from './repository.js'
import { Conflict, HistoryUnavailable, NotFound } from './store.js'
import { compactSummary, extractMemories, memoryContext, seedMemories } from './memory.js'

interface Binding { repository: ConversationRepository; profile?: (owner: string) => Promise<AssistantProfile | undefined> }
const bindings = new WeakMap<AssistantGraph, Binding>()
export function registerConversations(graph: AssistantGraph, binding: Binding) { bindings.set(graph, binding) }
const config = (threadId: string) => ({ configurable: { thread_id: threadId } })
const split = (thread: string) => { const [owner, id] = thread.split('#'); if (!owner || !id) throw new Error('thread_id inválido.'); return { owner, id } }

export async function ensureConversation(graph: AssistantGraph, owner: string, id: string, create = false) {
  try { return await ensureRecord(graph, owner, id, create) }
  catch (error) {
    if ((error as { status?: number }).status) throw error
    throw new HistoryUnavailable('No pudimos consultar el historial. Intenta nuevamente.')
  }
}

async function ensureRecord(graph: AssistantGraph, owner: string, id: string, create: boolean) {
  const binding = bindings.get(graph)
  if (!binding) return
  let conversation = await binding.repository.get(owner, id)
  if (!conversation) {
    const old = await graph.getState(config(owner + '#' + id))
    const messages = (old.values.messages ?? []) as ChatMessage[]
    if (messages.length) await binding.repository.importLegacy(owner, id, messages)
    else if (create) await binding.repository.create(owner, id)
    else throw new NotFound('No encontramos esa conversación.')
    conversation = await binding.repository.get(owner, id)
  }
  if (!conversation || conversation.deleted || conversation.deleting) throw new NotFound('No encontramos esa conversación.')
  return conversation
}

export async function beginTurn(graph: AssistantGraph, input: TurnInput) {
  try { return await prepareTurn(graph, input) }
  catch (error) {
    if ((error as { status?: number }).status) throw error
    throw new HistoryUnavailable('No pudimos preparar el historial. Intenta nuevamente.')
  }
}

async function prepareTurn(graph: AssistantGraph, input: TurnInput) {
  const binding = bindings.get(graph)
  if (!binding) return { input }
  const { owner, id } = split(input.threadId)
  await ensureConversation(graph, owner, id, !input.requireExisting)
  const requestId = input.requestId ?? randomUUID()
  const replay = await binding.repository.turn(owner, id, requestId)
  if (replay) {
    if (replay.student.content !== input.message || (replay.reply.model ?? 'lunna') !== (input.model ?? 'lunna')) throw new Conflict('requestId ya fue utilizado con otro mensaje.')
    return { input, replay: { ...replay.reply, historyStatus: 'saved' as const } }
  }
  const token = randomUUID()
  await binding.repository.acquire(owner, id, token)
  try {
    const checkpoint = await graph.getState(config(input.threadId))
    const pending = (checkpoint.values.pendingTurns ?? []) as Turn[]
    for (const turn of pending) await binding.repository.append(owner, id, turn)
    if (pending.length) await graph.updateState(config(input.threadId), { pendingTurns: [] })
    const retried = await binding.repository.turn(owner, id, requestId)
    if (retried) return { input, replay: { ...retried.reply, historyStatus: 'saved' as const }, token }
    const conversation = await binding.repository.require(owner, id)
    const canonical = { ...await binding.profile?.(owner), ...input.trustedProfile }
    const hasCanonical = Object.keys(canonical).length > 0
    if (binding.profile || input.trustedProfile) await seedMemories(binding.repository, owner, canonical)
    const profile = hasCanonical ? { ...input.profile, ...canonical } : input.profile
    const storedMemories = await binding.repository.memories(owner)
    const memories = memoryContext(storedMemories, profile)
    const forgottenAt = storedMemories.filter(item => item.suppressed).map(item => item.updatedAt).sort().at(-1)
    const recent = await binding.repository.messages(owner, id, 6, undefined, true)
    // Forgetting memory keeps the user's archive, but prevents old chat text from silently reintroducing it.
    const history = recent.messages.reverse().filter(message => !message.inputBlock && !requestsMemory(message.content) && (!forgottenAt || message.createdAt > forgottenAt))
    console.info(JSON.stringify({ event: 'assistant.context', archivedMessages: conversation.messageCount, historyMessages: history.length,
      historyCharacters: history.reduce((size, item) => size + item.content.length, 0), summaryCharacters: conversation.summary.length, memoryItems: memories.length }))
    return { input: { ...input, requestId, profile, history, compactedSummary: conversation.summary, memories,
      restoredLanguage: conversation.language, restoredIntent: conversation.lastIntent }, token }
  } catch (error) {
    await binding.repository.release(owner, id, token).catch(() => {})
    throw error
  }
}

export async function releaseTurn(graph: AssistantGraph, threadId: string, token?: string) {
  if (!token) return
  const { owner, id } = split(threadId)
  await bindings.get(graph)?.repository.release(owner, id, token).catch(error => console.error('assistant.history.release', (error as Error).name))
}

export async function persistTurn(graph: AssistantGraph, input: TurnInput, student: ChatMessage, reply: AssistantReply): Promise<AssistantReply> {
  const binding = bindings.get(graph)
  if (!binding) return reply
  const { owner, id } = split(input.threadId)
  const turn: Turn = { requestId: input.requestId!, student, reply }
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await binding.repository.append(owner, id, turn); return { ...reply, historyStatus: 'saved' } }
    catch (error) { console.error(JSON.stringify({ event: 'assistant.history.retry', attempt: attempt + 1, error: (error as Error).name })) }
  }
  const state = await graph.getState(config(input.threadId))
  const pending = (state.values.pendingTurns ?? []) as Turn[]
  // Durable operational outbox: retried before generating the next turn, never silently discarded.
  if (!pending.some(item => item.requestId === turn.requestId)) await graph.updateState(config(input.threadId), { pendingTurns: [...pending, turn] })
  return { ...reply, historyStatus: 'pending' }
}

/** Await after ending the HTTP response, including Lambda, so background work is not frozen. No LLM calls. */
export async function maintainConversation(graph: AssistantGraph, threadId: string) {
  const binding = bindings.get(graph)
  if (!binding) return
  const { owner, id } = split(threadId)
  const token = randomUUID()
  let acquired = false
  try {
    acquired = await binding.repository.maintenanceLock(owner, id, token)
    if (!acquired) return
    let metadata = await binding.repository.require(owner, id)
    const prefix = 'MSG#' + id + '#'
    const memoryPage = await binding.repository.store.page(owner, prefix, 100, metadata.memoryCursor)
    for (const item of memoryPage.items) {
      const message = item.value as unknown as ArchivedMessage
      if (message.role !== 'student' || message.inputBlock || requestsMemory(message.content)) continue
      for (const fact of extractMemories(message.content)) await binding.repository.saveMemory(owner, { ...fact, origin: 'conversation', sourceMessageId: message.id, observedAt: message.createdAt })
    }
    if (memoryPage.items.length) await binding.repository.saveMemoryCursor(owner, id, Buffer.from(memoryPage.items.at(-1)!.key).toString('base64url'))
    metadata = await binding.repository.require(owner, id)
    if (metadata.messageCount - metadata.summarizedCount >= 12) {
      const page = await binding.repository.store.page(owner, prefix, Math.min(100, metadata.messageCount - metadata.summarizedCount - 6), metadata.summaryCursor)
      if (page.items.length) {
        const summary = compactSummary(metadata.summary, page.items.map(item => item.value as unknown as ArchivedMessage))
        await binding.repository.saveSummary(owner, id, summary, metadata.summarizedCount + page.items.length, Buffer.from(page.items.at(-1)!.key).toString('base64url'))
        console.info(JSON.stringify({ event: 'assistant.context.compacted', retiredMessages: page.items.length, recentMessages: 6,
          beforeCharacters: page.items.reduce((size, item) => size + String(item.value.content).length, 0), afterCharacters: summary.length }))
      }
    }
  } catch (error) { console.error(JSON.stringify({ event: 'assistant.history.maintenance', error: (error as Error).name })) }
  finally { if (acquired) await binding.repository.maintenanceLock(owner, id, token, true).catch(() => {}) }
}
