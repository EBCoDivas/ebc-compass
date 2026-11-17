import { AssistantError } from '../types/assistant'
export { AssistantError } from '../types/assistant'
import { readAssistantEvents, type StreamEvent } from './assistantStream'
import { sessionFetch, sessionSubject } from './session'
import { personaStorageKey } from './personaService'
import type { StudentProfile } from '../types/profile'
import { getToken } from './authService'
import type { AssistantLanguage, AssistantProfile, AssistantReply, StoredMessage } from '../types/assistant'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const STUDENT_ID_KEY = 'ebc_compass_student_id'
const CONVERSATION_ID_KEY = 'ebc_compass_conversation_id'

export const MAX_MESSAGE_LENGTH = 500

/** Ruta del asistente con una pregunta ya escrita (se revisa y se envía desde el chat). */
export function assistantPath(question: string): string {
  return `/asistente?q=${encodeURIComponent(question.slice(0, MAX_MESSAGE_LENGTH))}`
}


function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(personaStorageKey(key))
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(personaStorageKey(key))
    else window.localStorage.setItem(personaStorageKey(key), value)
  } catch {
    // El almacenamiento puede estar bloqueado (modo privado): el chat funciona, solo no recuerda la conversación.
  }
}

/** Identificador anónimo del estudiante en este navegador (no hay inicio de sesión en la demo local). */
export function getStudentId(): string {
  const subject = sessionSubject()
  if (subject) return subject
  const existing = readStorage(STUDENT_ID_KEY)
  if (existing) return existing
  const created = crypto.randomUUID()
  writeStorage(STUDENT_ID_KEY, created)
  return created
}

export const getConversationId = (): string | null => readStorage(CONVERSATION_ID_KEY)
const saveConversationId = (id: string | null) => writeStorage(CONVERSATION_ID_KEY, id)

export interface ConversationSummary { id: string; title: string; updatedAt: string; preview: string; messageCount: number }
export interface MemoryFact { key: string; value: string; origin: 'profile' | 'conversation' | 'user'; updatedAt: string }
export interface MemoryData { facts: MemoryFact[]; allowedValues: Record<string, string[]> }
export async function listConversations(): Promise<ConversationSummary[]> {
  const data = await request<{ conversations: ConversationSummary[] }>('/conversations?limit=100')
  return data.conversations
}
export async function createConversation(): Promise<string> {
  const id = crypto.randomUUID()
  await request('/conversations', { method: 'POST', body: JSON.stringify({ conversationId: id }) })
  saveConversationId(id)
  return id
}
export function setActiveConversation(id: string | null): void { saveConversationId(id) }
export async function renameConversation(id: string, title: string): Promise<void> {
  await request<void>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) })
}
export async function deleteConversation(id: string): Promise<void> {
  await request<void>(`/conversations/${id}?studentId=${getStudentId()}`, { method: 'DELETE' })
  if (getConversationId() === id) saveConversationId(null)
}
export async function loadMemories(): Promise<MemoryData> {
  return request<MemoryData>('/memory')
}
export async function updateMemory(key: string, value: string): Promise<void> {
  await request<void>(`/memory/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ value }) })
}
export async function deleteMemory(key?: string): Promise<void> {
  await request<void>(key ? `/memory/${encodeURIComponent(key)}` : '/memory', { method: 'DELETE' })
}

/** Convierte el perfil guardado en el navegador al resumen que entiende el asistente. */
export function toAssistantProfile(profile: StudentProfile | null): AssistantProfile | undefined {
  if (!profile) return undefined
  return {
    name: profile.name.trim() || undefined,
    campus: profile.campus || undefined,
    career: profile.career || undefined,
    currentSemester: typeof profile.currentSemester === 'number' ? profile.currentSemester : undefined,
    interests: profile.interests,
    completedCourses: profile.completedCourses,
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    const token = getToken()
    response = await sessionFetch(`${API_URL}/api/assistant${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...init?.headers },
    })
  } catch {
    throw new AssistantError('No pudimos conectar con Compass. Revisa que el servidor esté en marcha e inténtalo de nuevo.')
  }
  if (response.status === 204) return undefined as T
  const body = (await response.json().catch(() => undefined)) as { message?: string; code?: string } | undefined
  if (!response.ok) {
    throw new AssistantError(body?.message ?? 'Compass no pudo responder. Inténtalo de nuevo.', body?.code)
  }
  return body as T
}

async function ensureActiveConversation(): Promise<string> {
  const existing = getConversationId()
  if (existing) return existing
  const id = crypto.randomUUID()
  await request('/conversations', { method: 'POST', body: JSON.stringify({ conversationId: id }) })
  saveConversationId(id)
  return id
}

export async function sendMessage(message: string, profile: StudentProfile | null, language?: AssistantLanguage, signal?: AbortSignal, requestId: string = crypto.randomUUID()): Promise<AssistantReply> {
  const conversationId = await ensureActiveConversation()
  const reply = await request<AssistantReply>('/messages', {
    signal,
    method: 'POST',
    body: JSON.stringify({
      studentId: getStudentId(),
      conversationId,
      requestId,
      message,
      profile: toAssistantProfile(profile),
      language,
    }),
  })
  saveConversationId(reply.conversationId)
  return reply
}

/** Historial guardado de la conversación actual; si ya no existe en el servidor, la olvida. */
export async function loadConversation(): Promise<StoredMessage[]> {
  const id = getConversationId()
  if (!id) return []
  try {
    const messages: StoredMessage[] = []
    const seen = new Set<string>()
    let cursor: string | undefined
    do {
      const data: { messages: StoredMessage[]; nextCursor?: string } = await request(`/conversations/${id}?limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`)
      messages.push(...data.messages)
      cursor = data.nextCursor
      if (cursor && seen.has(cursor)) throw new AssistantError('El historial devolvió una página repetida.')
      if (cursor) seen.add(cursor)
    } while (cursor)
    return messages
  } catch (error) {
    if (error instanceof AssistantError && error.code === 'CONVERSATION_NOT_FOUND') saveConversationId(null)
    return []
  }
}

/** Borra la conversación en el servidor y en este navegador (NF-03.5). */
export async function clearConversation(): Promise<void> {
  const id = getConversationId()
  if (id) await request<void>(`/conversations/${id}?studentId=${getStudentId()}`, { method: 'DELETE' })
  saveConversationId(null)
}

export async function fetchSuggestions(language: AssistantLanguage = 'es'): Promise<string[]> {
  try {
    return (await request<{ suggestions: string[] }>(`/suggestions?language=${language}`)).suggestions
  } catch {
    return []
  }
}


export async function sendMessageStreaming(message: string, profile: StudentProfile | null, options: { signal: AbortSignal; requestId?: string; onEvent: (event: StreamEvent) => void }): Promise<AssistantReply> {
  const conversationId = await ensureActiveConversation()
  const requestId = options.requestId ?? crypto.randomUUID()
  const response = await sessionFetch(API_URL + '/api/assistant/messages/stream', {
    method: 'POST', signal: options.signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: getStudentId(), conversationId, requestId, message, profile: toAssistantProfile(profile) }),
  })
  // Un servidor anterior puede no tener la ruta. El respaldo solo se usa antes de iniciar un turno.
  if (response.status === 404 || response.status === 405) return sendMessage(message, profile, undefined, options.signal, requestId)
  if (!response.ok) {
    const error = await response.json().catch(() => undefined) as { message?: string; code?: string } | undefined
    throw new AssistantError(error?.message ?? 'No fue posible iniciar la respuesta.', error?.code)
  }
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new AssistantError('El servidor no devolvió una respuesta de chat válida.')
  let reply: AssistantReply | undefined
  await readAssistantEvents(response.body, event => {
    if (typeof event.data.conversationId === 'string') saveConversationId(event.data.conversationId)
    if (event.event === 'error') throw new AssistantError(String(event.data.message ?? 'La respuesta se interrumpió.'))
    if (event.event === 'done') {
      const candidate = event.data as unknown as AssistantReply
      if (!candidate.message || typeof candidate.message.content !== 'string' || typeof candidate.conversationId !== 'string') throw new AssistantError('La respuesta final no es válida.')
      reply = candidate
    }
    options.onEvent(event)
  })
  if (!reply) throw new AssistantError('La respuesta se interrumpió. Puedes reintentar.')
  return reply
}

export async function saveFeedback(messageId: string, rating: 'positive' | 'negative' | null): Promise<void> {
  const id = getConversationId()
  if (!id) throw new AssistantError('No encontramos la conversación para guardar tu valoración.')
  await request<void>(`/conversations/${id}/messages/${messageId}/feedback`, { method: 'PUT', body: JSON.stringify({ rating }) })
}
