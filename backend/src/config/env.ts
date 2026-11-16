// Lectura de la configuración del asistente desde variables de entorno (sin dependencias).
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface AssistantConfig {
  /** llm = el modelo redacta; rules = solo plantillas. */
  mode: 'llm' | 'rules'
  llmTimeoutMs: number
  bedrockModelId: string
  knowledgeBaseId: string
  region: string
  /** Carpeta con los .md del corpus (solo la usa el respaldo por palabras clave). */
  knowledgeDir: string
  /** dynamodb = conversaciones persistentes (emulador/AWS); memory = en memoria (sin Docker). */
  store: 'dynamodb' | 'memory'
  conversationsTable: string
  /** Vida de una conversación en DynamoDB (atributo ttl). */
  conversationTtlSeconds: number
}

export function loadAssistantConfig(env: NodeJS.ProcessEnv = process.env): AssistantConfig {
  const here = dirname(fileURLToPath(import.meta.url))
  return {
    mode: env.ASSISTANT_MODE === 'rules' ? 'rules' : 'llm',
    llmTimeoutMs: Number(env.ASSISTANT_LLM_TIMEOUT_MS ?? 45_000),
    bedrockModelId: env.BEDROCK_MODEL_ID ?? 'local-chat',
    knowledgeBaseId: env.KNOWLEDGE_BASE_ID ?? 'local-kb',
    region: env.AWS_REGION ?? 'us-east-1',
    // En Lambda los documentos se empaquetan en /var/task/knowledge (KNOWLEDGE_DIR); en local están en ../knowledge.
    knowledgeDir: env.KNOWLEDGE_DIR ?? join(here, '..', '..', '..', 'knowledge'),
    store: env.ASSISTANT_STORE === 'memory' ? 'memory' : 'dynamodb',
    conversationsTable: env.CONVERSATIONS_TABLE ?? 'ConversationCheckpoints',
    conversationTtlSeconds: Number(env.CONVERSATION_TTL_SECONDS ?? 7 * 24 * 3600),
  }
}
