// Ensambla el asistente a partir de la configuración (variables de entorno).
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MemorySaver } from '@langchain/langgraph'
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint'
import { loadAssistantConfig, type AssistantConfig } from '../config/env.js'
import { CatalogDates, InMemoryCatalog, ProfileRecommendations } from './adapters/catalog.js'
import { BedrockInputGuardrail } from './adapters/bedrockInputGuardrail.js'
import { BedrockLlmProvider } from './adapters/bedrockLlm.js'
import { DynamoDBSaver } from './adapters/dynamoSaver.js'
import { BedrockKnowledgeBaseRetriever, FallbackRetriever, KeywordRetriever } from './adapters/retrievers.js'
import { buildAssistantGraph, type AssistantDeps } from './graph/assistantGraph.js'
import { ConversationRepository } from './conversations/repository.js'
import { DynamoDocumentStore, MemoryDocumentStore } from './conversations/store.js'
import { DynamoProfileRepository } from '../profiles/repository.js'
import type { AssistantProfile, LlmProvider, InputGuardrail } from './types.js'
import { createStudentMcpClient } from '../mcp/client.js'
import type { BannerClient } from '../banner/reader.js'
import { StudentActions } from '../planning/studentActions.js'
import { buildStudentTools, type StudentMcp } from './studentTools.js'

export { runTurnStreaming, runTurn, InvalidInputError, MAX_MESSAGE_LENGTH, type AssistantGraph } from './graph/assistantGraph.js'
export { suggestionsFor } from './domain/templates.js'
export type * from './types.js'
export { ensureConversation, maintainConversation } from './conversations/lifecycle.js'

export interface AssistantRuntime {
  actions?: StudentActions
  memoryLlm?: LlmProvider
  inputGuardrail?: InputGuardrail
  config: AssistantConfig
  checkpointer: BaseCheckpointSaver
  graph: ReturnType<typeof buildAssistantGraph>
  conversations?: ConversationRepository
  profileReader?: (owner: string) => Promise<AssistantProfile | undefined>
}

export function createAssistant(options: { config?: AssistantConfig; checkpointer?: BaseCheckpointSaver; conversations?: ConversationRepository;
  profileReader?: (owner: string) => Promise<AssistantProfile | undefined>; banner?: BannerClient; studentMcp?: StudentMcp;
  now?: () => Date } = {}): AssistantRuntime & { conversations: ConversationRepository } {
  const config = options.config ?? loadAssistantConfig()
  const catalog = new InMemoryCatalog()
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }), { marshallOptions: { removeUndefinedValues: true } })
  const conversations = options.conversations ?? new ConversationRepository(config.store === 'memory'
    ? new MemoryDocumentStore() : new DynamoDocumentStore(client, config.historyTable))
  const profiles = config.store === 'memory' ? undefined : new DynamoProfileRepository(undefined, client)
  const profileReader = options.profileReader ?? (profiles ? async (owner: string): Promise<AssistantProfile | undefined> => {
    const profile = await profiles.get(owner)
    if (!profile) return undefined
    return { name: profile.name, campus: profile.campus, career: profile.career, currentSemester: profile.currentSemester,
      completedCourses: profile.completedCourses, interests: profile.interests, goals: profile.goals, availability: profile.availability }
  } : undefined)
  const studentMcp: StudentMcp | undefined = options.studentMcp ?? (process.env.MCP_TRANSPORT
    ? (student, signal) => createStudentMcpClient(student, undefined, signal) : undefined)
  const actions = studentMcp && options.banner ? new StudentActions(conversations, options.banner, options.now) : undefined
  const deps: AssistantDeps = {
    catalog,
    inputGuardrail: config.inputGuardrail ? new BedrockInputGuardrail({ region: config.region, ...config.inputGuardrail }) : undefined,
    recommendations: new ProfileRecommendations(catalog),
    dates: new CatalogDates(catalog),
    conversations,
    profileReader,
    now: options.now,
    studentTools: studentMcp && actions ? buildStudentTools(studentMcp, actions) : undefined,
  }

  // Modo llm: LLM por Bedrock Converse y conocimiento por Retrieve (con respaldo por palabras clave).
  if (config.mode === 'llm') {
    deps.models = Object.fromEntries((['lunna', 'terra'] as const).map(name => {
      const key = name.toUpperCase()
      const modelId = process.env['BEDROCK_' + key + '_MODEL_ID']?.trim() || (config.bedrockModelId === 'local-chat' ? 'local-' + name : undefined)
      if (!modelId) throw new Error('Configura BEDROCK_' + key + '_MODEL_ID para habilitar el selector.')
      const cacheMode = process.env['ASSISTANT_' + key + '_PROMPT_CACHE'] ?? config.promptCacheMode
      if (!['off', 'system', 'system-history'].includes(cacheMode)) throw new Error('Configuración de caché inválida para ' + name)
      return [name, new BedrockLlmProvider({ modelId, region: config.region, cacheMode: cacheMode as typeof config.promptCacheMode })]
    }))
    deps.llm = deps.models.lunna
    deps.llmTimeoutMs = config.llmTimeoutMs
    deps.retriever = new FallbackRetriever(
      new BedrockKnowledgeBaseRetriever({ knowledgeBaseId: config.knowledgeBaseId, region: config.region }),
      new KeywordRetriever(config.knowledgeDir),
    )
  }

  // Persistencia de conversaciones: DynamoDB (emulador o AWS) o memoria si se arranca sin Docker.
  const checkpointer =
    options.checkpointer ??
    (config.store === 'memory'
      ? new MemorySaver()
      : new DynamoDBSaver({
          client,
          tableName: config.conversationsTable,
          ttlSeconds: config.conversationTtlSeconds,
        }))

  return { actions, memoryLlm: deps.llm, inputGuardrail: deps.inputGuardrail, config, checkpointer, conversations, profileReader, graph: buildAssistantGraph(deps, checkpointer) }
}
