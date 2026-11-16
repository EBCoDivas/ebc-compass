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

export { runTurn, InvalidInputError, MAX_MESSAGE_LENGTH, type AssistantGraph } from './graph/assistantGraph.js'
export { suggestionsFor } from './domain/templates.js'
export type * from './types.js'

export function createAssistant(options: { config?: AssistantConfig; checkpointer?: BaseCheckpointSaver } = {}) {
  const config = options.config ?? loadAssistantConfig()
  const catalog = new InMemoryCatalog()
  const deps: AssistantDeps = {
    catalog,
    recommendations: new ProfileRecommendations(catalog),
    dates: new CatalogDates(catalog),
  }

  // Modo llm: LLM por Bedrock Converse y conocimiento por Retrieve (con respaldo por palabras clave).
  if (config.mode === 'llm') {
    deps.llm = new BedrockLlmProvider({ modelId: config.bedrockModelId, region: config.region })
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
          client: DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }), { marshallOptions: { removeUndefinedValues: true } }),
          tableName: config.conversationsTable,
          ttlSeconds: config.conversationTtlSeconds,
        }))

  return { config, checkpointer, graph: buildAssistantGraph(deps, checkpointer) }
}
