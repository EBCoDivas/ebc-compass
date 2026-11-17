// Grafo de LangGraph del asistente. Es determinista (no un agente que elige herramientas):
//   validate -> detectLanguage -> checkInput -> analyze -> gatherFacts -> [retrieve] -> composeTemplate -> [generate -> guardrail] -> finalize
// `retrieve` solo corre si hay un KnowledgeRetriever; `generate` y `guardrail` solo si hay un LlmProvider (modo llm).
// composeTemplate calcula los resultados por reglas; ante un fallo solo se ofrecen bajo una acción explícita.
// Cada nodo es un envoltorio fino de funciones puras de domain/. El estado se guarda por conversación
// (thread_id) en el checkpointer; en la Fase 4 será DynamoDB y mientras tanto basta MemorySaver.

import { personalContextQuery, personalContextReply } from '../domain/personalContext.js'
import { rememberRequested, requestsMemory } from '../conversations/explicitMemory.js'
import { randomUUID } from 'node:crypto'
import { Annotation, END, START, StateGraph, getWriter, type LangGraphRunnableConfig } from '@langchain/langgraph'
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint'
import { assessInput, inputBlockMessage } from '../domain/inputGuardrail.js'
import { extractEntities } from '../domain/entities.js'
import { buildFactSheet, type FactDeps } from '../domain/facts.js'
import { validateGeneration } from '../domain/guardrail.js'
import { classifyIntent } from '../domain/intent.js'
import { detectLanguage } from '../domain/language.js'
import { buildPrompt, type Prompt } from '../domain/prompt.js'
import { loadSystemPrompt } from '../domain/systemPrompt.js'
import { renderReply } from '../domain/templates.js'
import { normalize } from '../domain/text.js'
import { beginTurn, persistTurn, registerConversations, releaseTurn } from '../conversations/lifecycle.js'
import type { ConversationRepository, MemoryFact, Turn } from '../conversations/repository.js'
import type {
  InputBlock,
  InputGuardrail,
  AssistantProfile,
  AssistantFailure,
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
  LlmUsage,
  Passage,
  Source,
} from '../types.js'

export const MAX_MESSAGE_LENGTH = 500
const MAX_HISTORY = 20
const TOPIC_INTENTS: Intent[] = ['scholarship-info', 'course-info', 'procedure-info', 'event-info', 'career-info', 'recommendation-request', 'deadline-query']

export interface AssistantDeps extends FactDeps {
  inputGuardrail?: InputGuardrail
  retriever?: KnowledgeRetriever
  /** Si se omite, el asistente responde solo con plantillas (modo rules). */
  models?: Partial<Record<'lunna' | 'terra', LlmProvider>>
  llm?: LlmProvider
  llmTimeoutMs?: number
  systemPromptsDir?: string
  conversations?: ConversationRepository
  profileReader?: (owner: string) => Promise<AssistantProfile | undefined>
  now?: () => Date
}

/** Temas del corpus (metadato `topic`) relevantes por intent; sin entrada = sin filtro por tema. */
const TOPICS_BY_INTENT: Partial<Record<Intent, string[]>> = {
  'scholarship-info': ['scholarships', 'procedures', 'services'],
  'procedure-info': ['procedures', 'calendar', 'services'],
  'event-info': ['events'],
  'career-info': ['career', 'careers', 'events'],
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
  pendingTurns: Annotation<Turn[]>({ reducer: replace<Turn[]>(), default: () => [] }),
  history: Annotation<ChatMessage[] | undefined>({ reducer: replace<ChatMessage[] | undefined>(), default: () => undefined }),
  compactedSummary: Annotation<string | undefined>({ reducer: replace<string | undefined>(), default: () => undefined }),
  memories: Annotation<MemoryFact[]>({ reducer: replace<MemoryFact[]>(), default: () => [] }),
  summary: Annotation<string>({ reducer: replace<string>(), default: () => '' }),
  lastIntent: Annotation<Intent | undefined>({ reducer: replace<Intent | undefined>(), default: () => undefined }),
  conversationLanguage: Annotation<Language>({ reducer: replace<Language>(), default: () => 'es' }),
  // --- Del turno actual (validate los reinicia en cada turno) ---
  inputBlock: Annotation<InputBlock | undefined>({ reducer: replace<InputBlock | undefined>(), default: () => undefined }),
  model: Annotation<'lunna' | 'terra'>({ reducer: replace<'lunna' | 'terra'>(), default: () => 'lunna' }),
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
  usage: Annotation<LlmUsage | undefined>({ reducer: replace<LlmUsage | undefined>(), default: () => undefined }),
  draft: Annotation<string | undefined>({ reducer: replace<string | undefined>(), default: () => undefined }),
  interrupted: Annotation<boolean>({ reducer: replace<boolean>(), default: () => false }),
  degraded: Annotation<boolean>({ reducer: replace<boolean>(), default: () => false }),
  reply: Annotation<DraftReply | undefined>({ reducer: replace<DraftReply | undefined>(), default: () => undefined }),
  final: Annotation<AssistantReply | undefined>({ reducer: replace<AssistantReply | undefined>(), default: () => undefined }),
})

type AssistantState = typeof State.State

function failedReply(state: AssistantState, failure: AssistantFailure): DraftReply {
  const template = renderReply(state.facts!, state.profile)
  const sources = template.sources.filter(source => source.kind === 'opportunity')
  const content = failure === 'MODEL_UNAVAILABLE'
    ? (state.language === 'es' ? 'No pudimos generar la respuesta en este momento. Intenta nuevamente.' : 'We could not generate a response right now. Please try again.')
    : (state.language === 'es' ? 'No pudimos verificar la respuesta generada. Intenta nuevamente.' : 'We could not verify the generated response. Please try again.')
  return { ...state.reply!, content, sources: [], suggestions: [], generatedBy: 'error', degraded: true, failure,
    ...(sources.length ? { catalogFallback: { content: template.content, sources } } : {}) }
}

export function buildAssistantGraph(deps: AssistantDeps, checkpointer?: BaseCheckpointSaver) {
  const now = deps.now ?? (() => new Date())
  const systemPrompt = loadSystemPrompt(deps.systemPromptsDir)

  const graph = new StateGraph(State)
    .addNode('validate', (state: AssistantState) => {
      const message = state.userMessage.trim()
      if (message.length === 0) throw new InvalidInputError('El mensaje no puede estar vacío.')
      if (message.length > MAX_MESSAGE_LENGTH) throw new InvalidInputError(`El mensaje excede ${MAX_MESSAGE_LENGTH} caracteres.`)
      return {
        userMessage: message,
        inputBlock: undefined,
        classification: undefined,
        entities: undefined,
        facts: undefined,
        passages: [],
        prompt: undefined,
        draft: undefined,
        usage: undefined,
        degraded: false,
        interrupted: false,
        reply: undefined,
        final: undefined,
      }
    })
    .addNode('detectLanguage', (state: AssistantState) => ({
      language: state.requestedLanguage ?? detectLanguage(state.userMessage, state.conversationLanguage),
    }))
    .addNode('checkInput', async (state: AssistantState) => {
      let inputBlock = assessInput(state.userMessage)
      if (!inputBlock && deps.inputGuardrail) {
        try { inputBlock = await deps.inputGuardrail.assess(state.userMessage) }
        catch { inputBlock = { category: 'guardrail-unavailable', source: 'bedrock' } }
      }
      if (!inputBlock) return {}
      console.info(JSON.stringify({ event: 'assistant.input.blocked', category: inputBlock.category, source: inputBlock.source }))
      return { inputBlock, reply: { content: inputBlockMessage(inputBlock, state.language), language: state.language,
        intent: 'unknown' as const, sources: [], suggestions: [], generatedBy: 'rules' as const, degraded: false, inputBlock } }
    })
    .addNode('personalContext', (state: AssistantState) => ({
      reply: { content: personalContextReply(personalContextQuery(state.userMessage)!, state.memories, state.language), language: state.language,
        intent: 'profile-help' as const, sources: [], suggestions: [], generatedBy: 'rules' as const, degraded: false },
    }))
    .addNode('remember', async (state: AssistantState, config: LangGraphRunnableConfig) => {
      const content = await rememberRequested({ text: state.userMessage, owner: String(config.configurable?.thread_id).split('#')[0],
        repo: deps.conversations, llm: deps.models?.[state.model] ?? deps.llm, language: state.language,
        signal: config.context?.generationSignal as AbortSignal | undefined, guardrail: deps.inputGuardrail })
      return { reply: { content, language: state.language, intent: 'unknown' as const, sources: [], suggestions: [], generatedBy: 'rules' as const, degraded: false } }
    })
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
    .addNode('composeTemplate', (state: AssistantState, config: LangGraphRunnableConfig) => {
      const rendered = renderReply(state.facts!, state.profile)
      getWriter(config)?.({ event: 'meta', language: state.language, intent: state.facts!.intent, sources: rendered.sources })
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
    .addNode('generate', async (state: AssistantState, config: LangGraphRunnableConfig) => {
      const prompt = buildPrompt({
        system: systemPrompt,
        facts: state.facts!,
        passages: state.passages,
        profile: state.profile,
        history: (state.history ?? state.messages).filter(message => !message.failure),
        summary: state.compactedSummary,
        memories: state.memories,
        question: state.userMessage,
        language: state.language,
      })
      let partial = ''
      let usage: LlmUsage | undefined
      const onUsage = (value: LlmUsage) => { usage = value }
      const signal = config.context?.generationSignal as AbortSignal | undefined
      const writer = getWriter(config)
      try {
        signal?.throwIfAborted()
        if (writer && (deps.models?.[state.model] ?? deps.llm)!.stream) {
          for await (const text of (deps.models?.[state.model] ?? deps.llm)!.stream!({ system: prompt.system, language: state.language, messages: prompt.messages, timeoutMs: deps.llmTimeoutMs ?? 45_000, signal, onUsage })) {
            partial += text
            writer({ event: 'token', text })
          }
          signal?.throwIfAborted()
          return { prompt, draft: partial, usage }
        }
        const draft = await (deps.models?.[state.model] ?? deps.llm)!.generate({ system: prompt.system, language: state.language, messages: prompt.messages, timeoutMs: deps.llmTimeoutMs ?? 45_000, signal, onUsage })
        return { prompt, draft, usage }
      } catch {
        if (signal?.aborted) return { prompt, draft: undefined, usage, interrupted: true, reply: { ...state.reply!, content: partial, interrupted: true, generatedBy: partial ? 'llm' as const : 'rules' as const } }
        const reply = failedReply(state, 'MODEL_UNAVAILABLE')
        writer?.({ event: 'replace', text: reply.content, reason: reply.content })
        return { prompt, draft: undefined, degraded: true, reply, usage }
      }
    })
    .addNode('guardrail', (state: AssistantState, config: LangGraphRunnableConfig) => {
      if (state.interrupted) {
        if (state.reply!.content && !validateGeneration(state.reply!.content, { language: state.language, allowed: state.prompt!.allowed }).ok) {
          const reply = failedReply(state, 'VALIDATION_FAILED')
          getWriter(config)?.({ event: 'replace', text: reply.content, reason: reply.content })
          return { reply, degraded: true }
        }
        return {}
      }
      if (state.draft === undefined) return {}
      const verdict = validateGeneration(state.draft, { language: state.language, allowed: state.prompt!.allowed })
      if (!verdict.ok) {
        const reply = failedReply(state, 'VALIDATION_FAILED')
        getWriter(config)?.({ event: 'replace', text: reply.content, reason: reply.content })
        return { draft: undefined, degraded: true, reply }
      }
      const documents: Source[] = [...new Map(state.passages.map((p) => [p.source, { kind: 'document' as const, id: p.source, title: p.title ?? p.source }])).values()]
      const reply = state.reply!
      // RF-05.13: si no se entendió la pregunta, la respuesta del modelo siempre ofrece preguntas alternativas.
      const alternatives =
        reply.intent === 'unknown'
          ? `\n\n${state.language === 'es' ? 'Puedes preguntarme, por ejemplo:' : 'You could ask me, for example:'}\n${reply.suggestions.map((text) => `- ${text}`).join('\n')}`
          : ''
      return { reply: { ...reply, content: state.draft + alternatives, sources: [...citedItems(reply.sources, state.draft), ...documents], degraded: state.degraded, generatedBy: 'llm' as const } }
    })
    .addNode('finalize', (state: AssistantState) => {
      // `degraded` se fija aquí: así refleja también un fallo del retriever, del LLM o del guardrail.
      const reply: DraftReply = { ...state.reply!, model: state.model, ...(state.usage ? { usage: state.usage } : {}), degraded: state.degraded, ...(state.interrupted ? { interrupted: true } : {}) }
      const stamp = now().toISOString()
      const student: ChatMessage = { id: randomUUID(), role: 'student', content: state.userMessage, language: state.language, intent: reply.intent, createdAt: stamp, ...(state.inputBlock ? { inputBlock: state.inputBlock } : {}) }
      const assistant: ChatMessage = { id: randomUUID(), role: 'assistant', content: reply.content, language: reply.language, intent: reply.intent, createdAt: stamp,
        ...(state.inputBlock ? { inputBlock: state.inputBlock } : {}), ...(reply.failure ? { failure: reply.failure, catalogFallback: reply.catalogFallback } : {}), ...(state.interrupted ? { interrupted: true } : {}) }
      // Los saludos y la ayuda no cambian el tema; así los seguimientos ("¿y la fecha límite?") siguen funcionando.
      const keepsTopic = TOPIC_INTENTS.includes(reply.intent)
      return {
        reply,
        final: { ...reply, id: assistant.id, createdAt: stamp } satisfies AssistantReply,
        messages: [student, assistant],
        lastIntent: keepsTopic ? reply.intent : state.lastIntent,
        conversationLanguage: state.language,
        summary: deps.conversations ? state.compactedSummary ?? '' : keepsTopic ? appendSummary(state.summary, reply.intent) : state.summary,
      }
    })
    .addEdge(START, 'validate')
    .addEdge('validate', 'detectLanguage')
    .addEdge('detectLanguage', 'checkInput')
    .addConditionalEdges('checkInput', (state: AssistantState) => state.inputBlock ? 'finalize' : requestsMemory(state.userMessage) ? 'remember' : personalContextQuery(state.userMessage) ? 'personalContext' : 'analyze', { personalContext: 'personalContext', finalize: 'finalize', remember: 'remember', analyze: 'analyze' })
    .addEdge('personalContext', 'finalize')
    .addEdge('remember', 'finalize')
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

  const compiled = graph.compile({ checkpointer })
  if (deps.conversations) registerConversations(compiled, { repository: deps.conversations, profile: deps.profileReader })
  return compiled
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
  model?: 'lunna' | 'terra'
  threadId: string
  message: string
  profile?: AssistantProfile
  language?: Language
  requestId?: string
  requireExisting?: boolean
  trustedProfile?: AssistantProfile
  history?: ChatMessage[]
  compactedSummary?: string
  memories?: MemoryFact[]
  restoredLanguage?: Language
  restoredIntent?: Intent
}

function graphInput(input: TurnInput) {
  return { model: input.model ?? 'lunna', userMessage: input.message, profile: input.profile, requestedLanguage: input.language,
    history: input.history, compactedSummary: input.compactedSummary, memories: input.memories ?? [],
    ...(input.history ? { conversationLanguage: input.restoredLanguage, lastIntent: input.restoredIntent } : {}),
  }
}

/** Ejecuta un turno y guarda el registro íntegro con una clave de reintento estable. */
export async function runTurn(graph: AssistantGraph, input: TurnInput): Promise<AssistantReply> {
  const started = performance.now()
  const prepared = await beginTurn(graph, input)
  try {
    if (prepared.replay) return prepared.replay
    const result = await graph.invoke(graphInput(prepared.input), { configurable: { thread_id: input.threadId } })
    return await persistTurn(graph, prepared.input, result.messages.at(-2)!, { ...result.final!, model: input.model ?? 'lunna', latencyMs: Math.round(performance.now() - started) })
  } finally { await releaseTurn(graph, input.threadId, prepared.token) }
}

export type TurnStreamEvent =
  | { event: 'meta'; language: Language; intent: Intent; sources: Source[] }
  | { event: 'token'; text: string }
  | { event: 'replace'; text: string; reason: string }

/** No aborta el grafo completo: permite que finalize guarde el turno parcial tras cancelar el proveedor. */
export async function runTurnStreaming(graph: AssistantGraph, input: TurnInput, signal: AbortSignal, onEvent: (event: TurnStreamEvent) => Promise<void>): Promise<AssistantReply> {
  const started = performance.now()
  const prepared = await beginTurn(graph, input)
  try {
    if (prepared.replay) return prepared.replay
    const stream = await graph.stream(graphInput(prepared.input),
      { configurable: { thread_id: input.threadId }, context: { generationSignal: signal }, streamMode: ['custom', 'updates'] })
    let reply: AssistantReply | undefined
    let student: ChatMessage | undefined
    for await (const [mode, value] of stream) {
      if (mode === 'custom') await onEvent(value as TurnStreamEvent)
      if (mode === 'updates') {
        const update = value as { finalize?: { final?: AssistantReply; messages?: ChatMessage[] } }
        if (update.finalize?.final) { reply = update.finalize.final; student = update.finalize.messages?.[0] }
      }
    }
    if (!reply || !student) throw new Error('El turno no produjo una respuesta final.')
    return await persistTurn(graph, prepared.input, student, { ...reply, model: input.model ?? 'lunna', latencyMs: Math.round(performance.now() - started) })
  } finally { await releaseTurn(graph, input.threadId, prepared.token) }
}
