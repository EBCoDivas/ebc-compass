import { fileURLToPath } from 'node:url'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { ConversationRepository } from '../assistant/conversations/repository.js'
import { DynamoDocumentStore } from '../assistant/conversations/store.js'
import { BedrockKnowledgeBaseRetriever, FallbackRetriever, KeywordRetriever } from '../assistant/adapters/retrievers.js'
import { createBannerReader } from '../banner/reader.js'
import { loadAssistantConfig } from '../config/env.js'
import { ensureCatalog } from '../catalog/catalog.js'
import { makeToolHandler } from './tools.js'

export function createToolRuntime() {
  const config = loadAssistantConfig()
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }))
  const store = new DynamoDocumentStore(client, config.historyTable)
  const fallback = new KeywordRetriever(process.env.MCP_PACKAGED_KNOWLEDGE === 'true'
    ? fileURLToPath(new URL('./knowledge/', import.meta.url)) : config.knowledgeDir)
  const knowledge = process.env.MCP_KNOWLEDGE_MODE === 'keyword'
    ? fallback : new FallbackRetriever(new BedrockKnowledgeBaseRetriever({
      region: config.region, knowledgeBaseId: config.knowledgeBaseId,
    }), fallback)
  const banner = createBannerReader()
  const handle = makeToolHandler({ banner, store, memories: new ConversationRepository(store), knowledge })
  // Las herramientas leen el catálogo de Banner: se carga (y se renueva cada minuto) antes de cada llamada.
  return (async (...args: Parameters<typeof handle>) => {
    try { await ensureCatalog(banner) } catch { return { ok: false, code: 'UNAVAILABLE' } as const }
    return handle(...args)
  }) as typeof handle
}
