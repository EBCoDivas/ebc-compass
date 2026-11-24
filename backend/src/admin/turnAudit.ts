import type { Claims } from '../auth/identity.js'
import type { AssistantReply } from '../assistant/types.js'
import { modelDisplayName } from '../assistant/domain/modelName.js'
import { auditLogFor, auditSources, auditUser, clip } from './audit.js'
import type { DocumentStore } from '../assistant/conversations/store.js'

/**
 * Registra en la traza del administrador un turno del chat: quién lo hizo, qué preguntó, qué respondió, qué herramientas
 * y fuentes usó y qué hizo el guardrail. Lo comparten la API normal (JSON y SSE) y la Lambda de streaming del lab.
 */
/** Nombre legible del modelo que atiende el selector, tal como se configuró, para que la traza diga con qué respondió. */
function modelLabel(selected?: string) {
  const name = selected === 'terra' ? 'terra' : 'lunna'
  const id = process.env['BEDROCK_' + name.toUpperCase() + '_MODEL_ID']?.trim() || process.env.BEDROCK_MODEL_ID?.trim()
  return modelDisplayName(id) ?? (name === 'terra' ? 'Terra' : 'Lunna')
}

export function recordTurnAudit(store: DocumentStore | undefined, turn: {
  owner: string; claims: Claims | undefined; conversationId: string; message: string; reply: AssistantReply; tools?: string[]; latencyMs: number; model?: string
}) {
  const { reply } = turn
  return auditLogFor(store).record({
    owner: turn.owner, user: auditUser(turn.claims), conversationId: turn.conversationId, messageId: reply.id,
    question: clip(turn.message), answer: clip(reply.content), agent: 'Compass', tools: turn.tools ?? [],
    usefulInfo: reply.sources.slice(0, 5).map(source => source.title || source.id), sources: auditSources(reply.sources),
    intent: reply.intent, latencyMs: turn.latencyMs, guardrail: reply.inputBlock ? `Bloqueado · ${reply.inputBlock.category}` : 'Permitido', mode: reply.generatedBy,
    ...(reply.generatedBy === 'llm' ? { model: modelLabel(turn.model) } : {}),
  })
}
