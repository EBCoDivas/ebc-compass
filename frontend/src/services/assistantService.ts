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

export class AssistantError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // El almacenamiento puede estar bloqueado (modo privado): el chat funciona, solo no recuerda la conversación.
  }
}

/** Identificador anónimo del estudiante en este navegador (no hay inicio de sesión en la demo local). */
export function getStudentId(): string {
  const existing = readStorage(STUDENT_ID_KEY)
  if (existing) return existing
  const created = crypto.randomUUID()
  writeStorage(STUDENT_ID_KEY, created)
  return created
}

export const getConversationId = (): string | null => readStorage(CONVERSATION_ID_KEY)
const saveConversationId = (id: string | null) => writeStorage(CONVERSATION_ID_KEY, id)

/** Convierte el perfil guardado en el navegador al resumen que entiende el asistente. */
export function toAssistantProfile(profile: StudentProfile | null): AssistantProfile | undefined {
  if (!profile) return undefined
  return {
    name: profile.name.trim() || undefined,
    campus: profile.campus || undefined,
    career: profile.career || undefined,
    currentSemester: typeof profile.currentSemester === 'number' ? profile.currentSemester : undefined,
    interests: profile.interests,
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    const token = getToken()
    response = await fetch(`${API_URL}/api/assistant${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...init?.headers },
    })
  } catch {
    throw new AssistantError('No pudimos conectar con el asistente. Revisa que el servidor esté en marcha e inténtalo de nuevo.')
  }
  if (response.status === 204) return undefined as T
  const body = (await response.json().catch(() => undefined)) as { message?: string; code?: string } | undefined
  if (!response.ok) {
    throw new AssistantError(body?.message ?? 'El asistente no pudo responder. Inténtalo de nuevo.', body?.code)
  }
  return body as T
}

export async function sendMessage(message: string, profile: StudentProfile | null, language?: AssistantLanguage): Promise<AssistantReply> {
  const reply = await request<AssistantReply>('/messages', {
    method: 'POST',
    body: JSON.stringify({
      studentId: getStudentId(),
      conversationId: getConversationId() ?? undefined,
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
    const data = await request<{ messages: StoredMessage[] }>(`/conversations/${id}?studentId=${getStudentId()}`)
    return data.messages
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
