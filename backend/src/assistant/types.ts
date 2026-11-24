// Tipos propios del asistente. No dependen de otras partes del backend: los adaptadores traducen
// el catálogo y el perfil actuales a estas formas (si los datos cambian, solo cambia el adaptador).
import type { OpportunityStage } from '../../../shared/contracts/studentPlanning.js'
import type { ActionProposal } from '../../../shared/contracts/studentActions.js'

export type ChatModel = 'lunna' | 'terra'

export type Language = 'es' | 'en'

export type Intent =
  | 'scholarship-info'
  | 'course-info'
  | 'procedure-info'
  | 'event-info'
  | 'career-info'
  | 'recommendation-request'
  | 'deadline-query'
  | 'profile-help'
  | 'greeting'
  | 'help'
  | 'unknown'

export type CareerId = 'business-administration' | 'communication-entertainment' | 'tourism' | 'international-business' | 'accounting' | 'law' | 'finance' | 'marketing' | 'executive-administration' | 'executive-accounting' | 'executive-business' | 'digital-transformation' | 'senior-management' | 'financial-management' | 'tax-specialty' | 'banking'

/** Resumen del perfil que envía el frontend en cada petición. Todo es opcional. */
export interface AssistantProfile {
  name?: string
  campus?: string
  career?: CareerId
  currentSemester?: number
  completedCourses?: string[]
  interests?: string[]
  goals?: string
  availability?: string
  demoWorkSchedule?: 'works-afternoons'
}

export type OpportunityType = 'course' | 'scholarship' | 'professional-development' | 'event' | 'procedure' | 'career-opportunity'

export interface AssistantOpportunity {
  id: string
  type: OpportunityType
  title: string
  description: string
  careers: string[]
  semesters?: number[]
  stage?: OpportunityStage
  campus?: string[]
  level?: string[]
  simulated?: boolean
  /** Fecha límite o fecha del evento, formato AAAA-MM-DD. */
  deadline?: string
  location?: string
  /** Código de curso (p. ej. FIN-301) cuando el dato existe. */
  code?: string
  prerequisites?: string[]
}

export interface ImportantDate {
  title: string
  date: string
  type: OpportunityType
  opportunityId: string
}

export interface Entities {
  courseCodes: string[]
  opportunityIds: string[]
  careers: CareerId[]
}

export type Focus = 'deadline' | 'requirements'

export interface Classification {
  intent: Intent
  confidence: number
  focus?: Focus
}

/** Un elemento de la hoja de hechos: lo único que el asistente (o el LLM) puede afirmar. */
export interface FactItem {
  id: string
  type: OpportunityType
  title: string
  description: string
  deadline?: string
  daysRemaining?: number
  location?: string
  code?: string
  prerequisites?: string[]
  /** true/false si se pudo evaluar contra el perfil; undefined si no hay datos para evaluarlo. */
  matchesProfile?: boolean
  alreadyCompleted?: boolean
}

export type FactNote = 'no-results' | 'no-profile' | 'no-prerequisite-data'

export interface FactSheet {
  intent: Intent
  language: Language
  focus?: Focus
  items: FactItem[]
  /** Campos obligatorios del perfil que faltan (name, campus, career, currentSemester). */
  missingProfileFields: string[]
  completeness: number
  notes: FactNote[]
  careerFilter?: CareerId
}

/** De dónde salió un pasaje de una guía: la búsqueda vectorial (Knowledge Base sobre S3 Vectors) o el respaldo por palabras. */
export type RetrievalOrigin = 'vector' | 'keyword'

export interface Source {
  kind: 'opportunity' | 'document' | 'record'
  id: string
  title: string
  /** Solo en guías: cómo se recuperó y con qué similitud (0 a 1). */
  origin?: RetrievalOrigin
  score?: number
}

export interface Passage {
  text: string
  source: string
  title?: string
  score?: number
  origin?: RetrievalOrigin
}

export const documentSource = (passage: Passage): Source => ({
  kind: 'document', id: passage.source, title: passage.title ?? passage.source,
  ...(passage.origin ? { origin: passage.origin } : {}), ...(typeof passage.score === 'number' ? { score: Math.round(passage.score * 100) / 100 } : {}),
})

export interface ChatMessage {
  actionProposal?: ActionProposal
  model?: ChatModel
  inputBlock?: InputBlock
  id: string
  role: 'student' | 'assistant'
  content: string
  language: Language
  intent?: Intent
  createdAt: string
  suggestions?: string[]
  interrupted?: boolean
  failure?: AssistantFailure
  catalogFallback?: CatalogFallback
}

export type AssistantFailure = 'MODEL_UNAVAILABLE' | 'VALIDATION_FAILED'
export interface CatalogFallback { content: string; sources: Source[] }

export interface AssistantReply {
  actionProposal?: ActionProposal
  model?: ChatModel
  inputBlock?: InputBlock
  /** Id y fecha del mensaje del asistente guardado en el historial. */
  id: string
  createdAt: string
  content: string
  language: Language
  intent: Intent
  suggestions: string[]
  sources: Source[]
  degraded: boolean
  interrupted?: boolean
  failure?: AssistantFailure
  catalogFallback?: CatalogFallback
  /** error = generación fallida o rechazada; no es una respuesta por reglas. */
  generatedBy: 'rules' | 'llm' | 'error'
  usage?: LlmUsage
  /** Milisegundos que tardó el turno. Se guarda con el mensaje para mostrarlo igual al recargar. */
  latencyMs?: number
  historyStatus?: 'saved' | 'pending'
}

/** Respuesta antes de guardarse (todavía sin id ni fecha). */
export type DraftReply = Omit<AssistantReply, 'id' | 'createdAt'>

// ---------- Puertos ----------

export interface CatalogReader {
  list(filter?: { type?: OpportunityType; career?: string; semester?: number; campus?: string; level?: string }): Promise<AssistantOpportunity[]>
  findByCode(code: string): Promise<AssistantOpportunity | undefined>
}

export interface RecommendationProvider {
  recommend(profile: AssistantProfile | undefined, limit: number): Promise<AssistantOpportunity[]>
}

export interface DatesProvider {
  upcoming(profile: AssistantProfile | undefined, days: number, today: Date): Promise<ImportantDate[]>
}

/** Recuperación de conocimiento (Fase 3: Bedrock Knowledge Base o palabras clave). */
export interface KnowledgeRetriever {
  retrieve(query: string, options: { language: Language; topics?: string[]; limit?: number }): Promise<Passage[]>
}

/** Modelo de lenguaje (Fase 3: Bedrock Converse). */
export interface LlmProvider {
  generate(input: LlmInput): Promise<string>
  stream?(input: LlmInput): AsyncIterable<string>
  selectTools?(input: LlmInput, tools: ModelTool[]): Promise<{ name: string; args: unknown }[]>
}

export interface ModelTool { name: string; description: string; inputSchema: object }

export type PromptCacheMode = 'off' | 'system' | 'system-history'
export interface LlmUsage {
  /** Bedrock: entrada que no se leyó ni escribió en caché. */
  inputTokens: number
  totalInputTokens: number
  outputTokens: number
  totalTokens: number
  /** Ausente cuando el proveedor no informa la métrica; no significa cero. */
  cacheReadInputTokens?: number
  cacheWriteInputTokens?: number
  latencyMs: number
  firstTokenMs?: number
  checkpointMode: PromptCacheMode
}
export interface LlmInput {
  system: string
  language?: Language
  messages: { role: 'user' | 'assistant'; content: string }[]
  timeoutMs: number
  signal?: AbortSignal
  onUsage?: (usage: LlmUsage) => void
}

export interface InputBlock {
  category: 'prompt-injection' | 'other-person-data' | 'harmful-content' | 'out-of-scope' | 'wellbeing' | 'guardrail-unavailable'
  source: 'local' | 'bedrock'
}
export interface InputGuardrail { assess(text: string): Promise<InputBlock | undefined> }
