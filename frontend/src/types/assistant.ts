export interface InputBlock { category: 'prompt-injection' | 'other-person-data' | 'harmful-content' | 'out-of-scope' | 'guardrail-unavailable'; source: 'local' | 'bedrock' }
// Tipos del contrato de la API del asistente (backend: /api/assistant).

export type AssistantLanguage = 'es' | 'en'

export interface AssistantSource {
  kind: 'opportunity' | 'document'
  id: string
  title: string
}

export interface AssistantReplyMeta {
  /** llm = modelo; rules = reglas explícitas; error = generación fallida o no verificable. */
  mode: 'llm' | 'rules' | 'error'
  latencyMs: number
  /** true si hubo un fallo de generación, validación o recuperación de conocimiento. */
  degraded: boolean
  historyStatus?: 'saved' | 'pending'
  /** Métricas agregadas; no se presentan en el flujo del chat. */
  usage?: {
    inputTokens: number
    totalInputTokens: number
    outputTokens: number
    totalTokens: number
    cacheReadInputTokens?: number
    cacheWriteInputTokens?: number
    latencyMs: number
    firstTokenMs?: number
    checkpointMode: 'off' | 'system' | 'system-history'
  }
}

export type AssistantFailure = 'MODEL_UNAVAILABLE' | 'VALIDATION_FAILED'
export interface CatalogFallback { content: string; sources: AssistantSource[] }

export interface AssistantReply {
  conversationId: string
  message: {
    inputBlock?: InputBlock
    id: string
    role: 'assistant'
    content: string
    language: AssistantLanguage
    intent: string
    interrupted?: boolean
    failure?: AssistantFailure
    catalogFallback?: CatalogFallback
    createdAt: string
    suggestions: string[]
    sources: AssistantSource[]
  }
  meta: AssistantReplyMeta
}

export interface StoredMessage {
  inputBlock?: InputBlock
  mode?: AssistantReplyMeta['mode']
  latencyMs?: number
  degraded?: boolean
  usage?: AssistantReplyMeta['usage']
  feedback?: 'positive' | 'negative'
  id: string
  role: 'student' | 'assistant'
  content: string
  language: AssistantLanguage
  intent?: string
  interrupted?: boolean
  failure?: AssistantFailure
  catalogFallback?: CatalogFallback
  createdAt: string
  sources?: AssistantSource[]
  suggestions?: string[]
}

/** Resumen del perfil que se envía en cada mensaje (el backend no conoce el perfil guardado en el navegador). */
export interface AssistantProfile {
  name?: string
  campus?: string
  career?: string
  currentSemester?: number
  completedCourses?: string[]
  interests?: string[]
}

/** Un mensaje tal como se muestra en pantalla. */
export interface ChatEntry {
  inputBlock?: InputBlock
  feedback?: 'positive' | 'negative'
  id: string
  role: 'student' | 'assistant'
  content: string
  sources?: AssistantSource[]
  suggestions?: string[]
  meta?: AssistantReplyMeta
  /** Mensaje de error del asistente (no se guarda en el historial del servidor). */
  isStreaming?: boolean
  interrupted?: boolean
  streamError?: string
  failure?: AssistantFailure
  catalogFallback?: CatalogFallback
  retryQuestion?: string
  requestId?: string
  isError?: boolean
}

export class AssistantError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
  }
}
