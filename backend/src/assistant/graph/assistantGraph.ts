// Grafo de LangGraph del asistente. Es determinista (no un agente que elige herramientas):
//   validate -> detectLanguage -> analyze -> gatherFacts -> [retrieve] -> composeTemplate -> [generate -> guardrail] -> finalize
// `retrieve` solo corre si hay un KnowledgeRetriever; `generate` y `guardrail` solo si hay un LlmProvider (modo llm).
// composeTemplate siempre calcula la respuesta por reglas: es el respaldo si el LLM falla o el guardrail la rechaza.
// Cada nodo es un envoltorio fino de funciones puras de domain/. El estado se guarda por conversación
// (thread_id) en el checkpointer; en la Fase 4 será DynamoDB y mientras tanto basta MemorySaver.

import { randomUUID } from 'node:crypto'
import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint'
import { extractEntities } from '../domain/entities.js'
import { buildFactSheet, type FactDeps } from '../domain/facts.js'
import { validateGeneration } from '../domain/guardrail.js'
import { classifyIntent } from '../domain/intent.js'
import { detectLanguage } from '../domain/language.js'
import { buildPrompt, type Prompt } from '../domain/prompt.js'
import { renderReply } from '../domain/templates.js'
import { normalize } from '../domain/text.js'
import type {
  AssistantProfile,
  AssistantReply,
  ChatMessage,
  Classification,
  DraftReply,
  Entities,
  FactSheet,
  Intent,
  KnowledgeRetriever,
  Language,
  LlmProvider,
  Passage,
  Source,
} from '../types.js'

export const MAX_MESSAGE_LENGTH = 500
const MAX_HISTORY = 20
const TOPIC_INTENTS: Intent[] = ['scholarship-info', 'course-info', 'procedure-info', 'event-info', 'career-info', 'recommendation-request', 'deadline-query']

export interface AssistantDeps extends FactDeps {
  retriever?: KnowledgeRetriever
  /** Si se omite, el asistente responde solo con plantillas (modo rules). */
  llm?: LlmProvider
  llmTimeoutMs?: number
  now?: () => Date
}

/** Temas del corpus (metadato `topic`) relevantes por intent; sin entrada = sin filtro por tema. */
const TOPICS_BY_INTENT: Partial<Record<Intent, string[]>> = {
  'scholarship-info': ['scholarships', 'procedures', 'services'],
  'procedure-info': ['procedures', 'calendar', 'services'],
  'event-info': ['events'],
  'career-info': ['career', 'events'],
  'course-info': ['rules', 'services'],
  'deadline-query': ['calendar'],
}

export class InvalidInputError extends Error {}

const replace = <T>() => (_: T, next: T) => next

const State = Annotation.Root({
  // --- Persistente por conversación (se guarda en el checkpointer) ---
  messages: Annotation<ChatMessage[]>({
    reducer: (current, added) => [...current, ...added].slice(-MAX_HISTORY),
    default: () => [],
  }),
  summary: Annotation<string>({ reducer: replace<string>(), default: () => '' }),
  lastIntent: Annotation<Intent | undefined>({ reducer: replace<Intent | undefined>(), default: () => undefined }),
  conversationLanguage: Annotation<Language>({ reducer: replace<Language>(), default: () => 'es' }),
  // --- Del turno actual (validate los reinicia en cada turno) ---
  userMessage: Annotation<string>({ reducer: replace<string>(), default: () => '' }),
  profile: Annotation<AssistantProfile | undefined>({ reducer: replace<AssistantProfile | undefined>(), default: () => undefined }),
  requestedLanguage: Annotation<Language | undefined>({ reducer: replace<Language | undefined>(), default: () => undefined }),
  language: Annotation<Language>({ reducer: replace<Language>(), default: () => 'es' }),
  normalized: Annotation<string>({ reducer: replace<string>(), default: () => '' }),
  classification: Annotation<Classification | undefined>({ reducer: replace<Classification | undefined>(), default: () => undefined }),
  entities: Annotation<Entities | undefined>({ reducer: replace<Entities | undefined>(), default: () => undefined }),
  facts: Annotation<FactSheet | undefined>({ reducer: replace<FactSheet | undefined>(), default: () => undefined }),
  passages: Annotation<Passage[]>({ reducer: replace<Passage[]>(), default: () => [] }),
  prompt: Annotation<Prompt | undefined>({ reducer: replace<Prompt | undefined>(), default: () => undefined }),
  draft: Annotation<string | undefined>({ reducer: replace<string | undefined>(), default: () => undefined }),
  degraded: Annotation<boolean>({ reducer: replace<boolean>(), default: () => false }),
  reply: Annotation<DraftReply | undefined>({ reducer: replace<DraftReply | undefined>(), default: () => undefined }),
  final: Annotation<AssistantReply | undefined>({ reducer: replace<AssistantReply | undefined>(), default: () => undefined }),
})

type AssistantState = typeof State.State

export function buildAssistantGraph(deps: AssistantDeps, checkpointer?: BaseCheckpointSaver) {
  const now = deps.now ?? (() => new Date())

  const graph = new StateGraph(State)
    .addNode('validate', (state: AssistantState) => {
      const message = state.userMessage.trim()
      if (message.length === 0) throw new InvalidInputError('El mensaje no puede estar vacío.')
      if (message.length > MAX_MESSAGE_LENGTH) throw new InvalidInputError(`El mensaje excede ${MAX_MESSAGE_LENGTH} caracteres.`)
      return {
        userMessage: message,
        classification: undefined,
        entities: undefined,
        facts: undefined,
        passages: [],
        prompt: undefined,
        draft: undefined,
        degraded: false,
        reply: undefined,
        final: undefined,
      }
    })
    .addNode('detectLanguage', (state: AssistantState) => ({
      language: detectLanguage(state.userMessage, state.requestedLanguage ?? state.conversationLanguage),
    }))
    .addNode('analyze', async (state: AssistantState) => {
      const normalized = normalize(state.userMessage)
      const catalog = await deps.catalog.list()
      const entities = extractEntities(normalized, catalog)
      const matched = catalog.filter((item) => entities.opportunityIds.includes(item.id))
      const classification = classifyIntent(normalized, {
        lastIntent: state.lastIntent,
        hasCourseCode: entities.courseCodes.length > 0,
        entityTypes: [...new Set(matched.map((item) => item.type))],
      })
      return { normalized, entities, classification }
    })
    .addNode('gatherFacts', async (state: AssistantState) => ({
      facts: await buildFactSheet({
        classification: state.classification!,
        entities: state.entities!,
        profile: state.profile,
        language: state.language,
        deps,
        today: now(),
      }),
    }))
    .addNode('retrieve', async (state: AssistantState) => {
      try {
        const passages = await deps.retriever!.retrieve(state.userMessage, { language: state.language, topics: TOPICS_BY_INTENT[state.facts!.intent], limit: 3 })
        return { passages }
      } catch {
        return { passages: [], degraded: true }
      }
    })
    .addNode('composeTemplate', (state: AssistantState) => {
      const rendered = renderReply(state.facts!, state.profile)
      return {
        reply: {
          content: rendered.content,
          language: state.language,
          intent: state.facts!.intent,
          suggestions: rendered.suggestions,
          sources: rendered.sources,
          degraded: state.degraded,
          generatedBy: 'rules' as const,
        } satisfies DraftReply,
      }
    })
    .addNode('generate', async (state: AssistantState) => {
      const prompt = buildPrompt({
        facts: state.facts!,
        passages: state.passages,
        profile: state.profile,
        history: state.messages,
        question: state.userMessage,
        language: state.language,
      })
      try {
        const draft = await deps.llm!.generate({ system: prompt.system, messages: prompt.messages, timeoutMs: deps.llmTimeoutMs ?? 45_000 })
        return { prompt, draft }
      } catch {
        // OpenAI/Bedrock no disponible o lento: se conserva la respuesta por plantilla.
        return { prompt, draft: undefined, degraded: true }
      }
    })
    .addNode('guardrail', (state: AssistantState) => {
      if (state.draft === undefined) return {}
      const verdict = validateGeneration(state.draft, { language: state.language, allowed: state.prompt!.allowed })
      if (!verdict.ok) return { draft: undefined, degraded: true }
      const documents: Source[] = [...new Map(state.passages.map((p) => [p.source, { kind: 'document' as const, id: p.source, title: p.title ?? p.source }])).values()]
      const reply = state.reply!
      // RF-05.13: si no se entendió la pregunta, la respuesta del modelo siempre ofrece preguntas alternativas.
      const alternatives =
        reply.intent === 'unknown'
          ? `\n\n${state.language === 'es' ? 'Puedes preguntarme, por ejemplo:' : 'You could ask me, for example:'}\n${reply.suggestions.map((text) => `• ${text}`).join('\n')}`
          : ''
      return { reply: { ...reply, content: state.draft + alternatives, sources: [...citedItems(reply.sources, state.draft), ...documents], degraded: state.degraded, generatedBy: 'llm' as const } }
    })
    .addNode('finalize', (state: AssistantState) => {
      // `degraded` se fija aquí: así refleja también un fallo del retriever, del LLM o del guardrail.
      const reply: DraftReply = { ...state.reply!, degraded: state.degraded }
      const stamp = now().toISOString()
      const student: ChatMessage = { id: randomUUID(), role: 'student', content: state.userMessage, language: state.language, intent: reply.intent, createdAt: stamp }
      const assistant: ChatMessage = { id: randomUUID(), role: 'assistant', content: reply.content, language: reply.language, intent: reply.intent, createdAt: stamp }
      // Los saludos y la ayuda no cambian el tema; así los seguimientos ("¿y la fecha límite?") siguen funcionando.
      const keepsTopic = TOPIC_INTENTS.includes(reply.intent)
      return {
        reply,
        final: { ...reply, id: assistant.id, createdAt: stamp } satisfies AssistantReply,
        messages: [student, assistant],
        lastIntent: keepsTopic ? reply.intent : state.lastIntent,
        conversationLanguage: state.language,
        summary: keepsTopic ? appendSummary(state.summary, reply.intent) : state.summary,
      }
    })
    .addEdge(START, 'validate')
    .addEdge('validate', 'detectLanguage')
    .addEdge('detectLanguage', 'analyze')
    .addEdge('analyze', 'gatherFacts')
    .addConditionalEdges(
      'gatherFacts',
      (state: AssistantState) => (deps.retriever && needsKnowledge(state.facts!.intent) ? 'retrieve' : 'composeTemplate'),
      { retrieve: 'retrieve', composeTemplate: 'composeTemplate' },
    )
    .addEdge('retrieve', 'composeTemplate')
    .addConditionalEdges(
      'composeTemplate',
      (state: AssistantState) => (deps.llm && shouldGenerate(state) ? 'generate' : 'finalize'),
      { generate: 'generate', finalize: 'finalize' },
    )
    .addEdge('generate', 'guardrail')
    .addEdge('guardrail', 'finalize')
    .addEdge('finalize', END)

  return graph.compile({ checkpointer })
}

/** Deja solo las oportunidades que el texto menciona por título; si no nombra ninguna, la respuesta se apoya en los documentos. */
function citedItems(sources: Source[], text: string): Source[] {
  const haystack = normalize(text)
  return sources.filter((source) => haystack.includes(normalize(source.title)))
}

/** Los temas de consulta y las preguntas que no se entendieron buscan en el corpus (RF-05.14). */
function needsKnowledge(intent: Intent): boolean {
  return TOPIC_INTENTS.includes(intent) || intent === 'unknown'
}

/** El LLM redacta los temas de consulta, y las preguntas no entendidas solo si hay documentos que las respondan. */
function shouldGenerate(state: AssistantState): boolean {
  const intent = state.facts!.intent
  return TOPIC_INTENTS.includes(intent) || (intent === 'unknown' && state.passages.length > 0)
}

/** Resumen determinista de los temas tratados (los últimos 8, sin repetir consecutivos). */
function appendSummary(summary: string, intent: Intent): string {
  const topics = summary ? summary.split(',') : []
  if (topics[topics.length - 1] !== intent) topics.push(intent)
  return topics.slice(-8).join(',')
}

export type AssistantGraph = ReturnType<typeof buildAssistantGraph>

export interface TurnInput {
  threadId: string
  message: string
  profile?: AssistantProfile
  language?: Language
}

/** Ejecuta un turno completo y devuelve la respuesta. */
export async function runTurn(graph: AssistantGraph, input: TurnInput): Promise<AssistantReply> {
  const result = await graph.invoke(
    { userMessage: input.message, profile: input.profile, requestedLanguage: input.language },
    { configurable: { thread_id: input.threadId } },
  )
  return result.final!
}
