import type OpenAI from 'openai'

interface Block { text?: string; cachePoint?: { type: string } }
interface PromptRequest { system?: Block[]; messages?: { role: 'user' | 'assistant'; content?: Block[] }[] }

/** Translate stable Bedrock boundaries to OpenAI, without caching the variable turn. */
export function openAiPrompt(body: PromptRequest, model: string): Pick<OpenAI.Chat.ChatCompletionCreateParams, 'messages' | 'prompt_cache_options'> {
  const explicitSupported = /^gpt-(?:6(?:[.-]|$)|5\.[6-9](?:[.-]|$))/.test(model)
  let hasCheckpoint = false
  function content(blocks: Block[]) {
    const parts: OpenAI.Chat.ChatCompletionContentPartText[] = []
    for (const block of blocks) {
      if (block.text) parts.push({ type: 'text', text: block.text })
      if (explicitSupported && block.cachePoint?.type === 'default' && parts.length) {
        parts[parts.length - 1].prompt_cache_breakpoint = { mode: 'explicit' }
        hasCheckpoint = true
      }
    }
    return parts
  }
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
  const system = content(body.system ?? [])
  if (system.length) messages.push({ role: 'system', content: system })
  for (const message of body.messages ?? []) {
    const parts = content(message.content ?? [])
    if (parts.length) messages.push({ role: message.role, content: parts })
  }
  return { messages, ...(hasCheckpoint ? { prompt_cache_options: { mode: 'explicit', ttl: '30m' } } : {}) }
}
