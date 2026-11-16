// Tipos propios del asistente. No dependen de otras partes del backend: los adaptadores traducen
// el catálogo y el perfil actuales a estas formas (si los datos cambian, solo cambia el adaptador).

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

export type CareerId = 'banking' | 'finance' | 'marketing' | 'business-administration'

/** Resumen del perfil que envía el frontend en cada petición. Todo es opcional. */
export interface AssistantProfile {
  name?: string
  campus?: string
  career?: CareerId
  currentSemester?: number
  completedCourses?: string[]
  interests?: string[]
}

export type OpportunityType = 'course' | 'scholarship' | 'professional-development' | 'event' | 'procedure' | 'career-opportunity'

export interface AssistantOpportunity {
  id: string
  type: OpportunityType
  title: string
  description: string
  careers: string[]
  semesters?: number[]
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

export interface Source {
  kind: 'opportunity' | 'document'
  id: string
  title: string
}

export interface Passage {
  text: string
  source: string
  title?: string
  score?: number
}

export interface ChatMessage {
  id: string
  role: 'student' | 'assistant'
  content: string
  language: Language
  intent?: Intent
  createdAt: string
}

export interface AssistantReply {
  /** Id y fecha del mensaje del asistente guardado en el historial. */
  id: string
  createdAt: string
  content: string
  language: Language
  intent: Intent
  suggestions: string[]
  sources: Source[]
  degraded: boolean
  /** rules = plantilla determinista; llm = redactada por el modelo y validada por el guardrail. */
  generatedBy: 'rules' | 'llm'
}

/** Respuesta antes de guardarse (todavía sin id ni fecha). */
export type DraftReply = Omit<AssistantReply, 'id' | 'createdAt'>

// ---------- Puertos ----------

export interface CatalogReader {
  list(filter?: { type?: OpportunityType; career?: string; semester?: number }): Promise<AssistantOpportunity[]>
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
  generate(input: { system: string; messages: { role: 'user' | 'assistant'; content: string }[]; timeoutMs: number }): Promise<string>
}
