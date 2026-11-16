// Tipos del contrato de la API del asistente (backend: /api/assistant).

export type AssistantLanguage = 'es' | 'en'

export interface AssistantSource {
  kind: 'opportunity' | 'document'
  id: string
  title: string
}

export interface AssistantReplyMeta {
  /** llm = redactada por el modelo; rules = respuesta por reglas y plantillas. */
  mode: 'llm' | 'rules'
  latencyMs: number
  /** true si el modelo o la búsqueda de conocimiento fallaron y se respondió con reglas. */
  degraded: boolean
}

export interface AssistantReply {
  conversationId: string
  message: {
    id: string
    role: 'assistant'
    content: string
    language: AssistantLanguage
    intent: string
    createdAt: string
    suggestions: string[]
    sources: AssistantSource[]
  }
  meta: AssistantReplyMeta
}

export interface StoredMessage {
  id: string
  role: 'student' | 'assistant'
  content: string
  language: AssistantLanguage
  intent?: string
  createdAt: string
}

/** Resumen del perfil que se envía en cada mensaje (el backend no conoce el perfil guardado en el navegador). */
export interface AssistantProfile {
  name?: string
  campus?: string
  career?: string
  currentSemester?: number
  interests?: string[]
}

/** Un mensaje tal como se muestra en pantalla. */
export interface ChatEntry {
  id: string
  role: 'student' | 'assistant'
  content: string
  sources?: AssistantSource[]
  suggestions?: string[]
  meta?: AssistantReplyMeta
  /** Mensaje de error del asistente (no se guarda en el historial del servidor). */
  isError?: boolean
}
