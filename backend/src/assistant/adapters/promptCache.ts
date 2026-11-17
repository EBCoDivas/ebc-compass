import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { LlmInput, PromptCacheMode } from '../types.js'

// Explicit Converse cache points only for documented models. Unknown models use normal inference.
// local-chat translates cachePoint to explicit OpenAI boundaries on supported models.
// Conservative allowlist from the Bedrock prompt-caching table (2026-11-16).
const SUPPORTED = new Set([
  'amazon.nova-micro-v1:0', 'amazon.nova-lite-v1:0', 'amazon.nova-pro-v1:0', 'amazon.nova-2-lite-v1:0',
  'anthropic.claude-haiku-4-5-20251001-v1:0', 'anthropic.claude-sonnet-4-6',
  'anthropic.claude-opus-4-5-20251101-v1:0', 'anthropic.claude-opus-4-6-v1',
  'anthropic.claude-opus-4-7', 'anthropic.claude-opus-4-8',
])

export function effectiveCacheMode(modelId: string, requested: PromptCacheMode): PromptCacheMode {
  const id = modelId.split('/').at(-1)!.replace(/^(us|eu|apac|global)\./, '')
  return id === 'local-chat' || SUPPORTED.has(id) ? requested : 'off'
}

export function converseMessages(input: Pick<LlmInput, 'system' | 'messages' | 'language'>, mode: PromptCacheMode) {
  const point = { type: 'cache_point', cachePoint: { type: 'default' } }
  const system = new SystemMessage({ content: [{ type: 'text', text: input.system }, ...(mode !== 'off' ? [point] : [])] })
  const historyEnd = input.messages.length - 2
  const messages = input.messages.map((message, index) => {
    const content = [{ type: 'text', text: message.content }, ...(mode === 'system-history' && index === historyEnd ? [point] : [])]
    return message.role === 'user' ? new HumanMessage({ content }) : new AIMessage({ content })
  })
  const language = new SystemMessage(input.language === 'en' ? 'Responde en inglés.' : 'Responde en español.')
  return [system, language, ...messages]
}
