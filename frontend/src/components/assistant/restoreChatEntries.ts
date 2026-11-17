import type { ChatEntry, StoredMessage } from '../../types/assistant'

/** Los mensajes antiguos sin métricas se muestran sin inventar un tiempo de respuesta. */
export function restoreChatEntries(messages: StoredMessage[]): ChatEntry[] {
  return messages.map((message, index) => ({
    ...message,
    meta: message.role === 'assistant' && message.mode !== undefined && message.latencyMs !== undefined
      ? { mode: message.mode, latencyMs: message.latencyMs, degraded: message.degraded ?? false, usage: message.usage }
      : undefined,
    retryQuestion: messages.slice(0, index).reverse().find(previous => previous.role === 'student')?.content,
  }))
}
