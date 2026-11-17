// Ensambla el asistente a partir de la configuración (variables de entorno).
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MemorySaver } from '@langchain/langgraph'
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint'
import { loadAssistantConfig, type AssistantConfig } from '../config/env.js'
import { CatalogDates, InMemoryCatalog, ProfileRecommendations } from './adapters/catalog.js'
import { BedrockLlmProvider } from './adapters/bedrockLlm.js'
import { DynamoDBSaver } from './adapters/dynamoSaver.js'
import { BedrockKnowledgeBaseRetriever, FallbackRetriever, KeywordRetriever } from './adapters/retrievers.js'
import { buildAssistantGraph, type AssistantDeps } from './graph/assistantGraph.js'
import { ConversationRepository } from './conversations/repository.js'
import { DynamoDocumentStore, MemoryDocumentStore } from './conversations/store.js'
import { DynamoProfileRepository } from '../profiles/repository.js'
import type { AssistantProfile } from './types.js'

export { runTurnStreaming, runTurn, InvalidInputError, MAX_MESSAGE_LENGTH, type AssistantGraph } from './graph/assistantGraph.js'
export { suggestionsFor } from './domain/templates.js'
export type * from './types.js'
export { ensureConversation, maintainConversation } from './conversations/lifecycle.js'

export interface AssistantRuntime {
  config: AssistantConfig
  checkpointer: BaseCheckpointSaver
  graph: ReturnType<typeof buildAssistantGraph>
  conversations?: ConversationRepository
  profileReader?: (owner: string) => Promise<AssistantProfile | undefined>
}

export function createAssistant(options: { config?: AssistantConfig; checkpointer?: BaseCheckpointSaver; conversations?: ConversationRepository;
  profileReader?: (owner: string) => Promise<AssistantProfile | undefined> } = {}): AssistantRuntime {
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
  const deps: AssistantDeps = {
    catalog,
    recommendations: new ProfileRecommendations(catalog),
    dates: new CatalogDates(catalog),
    conversations,
    profileReader,
  }

  // Modo llm: LLM por Bedrock Converse y conocimiento por Retrieve (con respaldo por palabras clave).
  if (config.mode === 'llm') {
    deps.llm = new BedrockLlmProvider({ modelId: config.bedrockModelId, region: config.region, cacheMode: config.promptCacheMode })
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

  return { config, checkpointer, conversations, profileReader, graph: buildAssistantGraph(deps, checkpointer) }
}
