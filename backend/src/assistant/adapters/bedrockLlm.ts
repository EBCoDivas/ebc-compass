// LLM por Amazon Bedrock (API Converse) a través de @langchain/aws.
// En local, AWS_ENDPOINT_URL_BEDROCK_RUNTIME apunta al puente (que responde con OpenAI); en el lab, a Bedrock real.
// El cliente usa HTTP/1.1: el HTTP/2 por defecto del SDK no es compatible con el puente en HTTP plano.

import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { ChatBedrockConverse } from '@langchain/aws'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import type { LlmProvider, LlmInput, ModelTool, PromptCacheMode } from '../types.js'
import { converseMessages, effectiveCacheMode } from './promptCache.js'
import { normalizeUsage } from './llmUsage.js'

// Un modelo con razonamiento gasta parte de este límite pensando: se deja holgado para que no devuelva texto vacío.
const MAX_TOKENS = 4000

export class BedrockLlmProvider implements LlmProvider {
  private readonly model: ChatBedrockConverse

  private readonly checkpointMode: PromptCacheMode
  private readonly modelId: string

  constructor(options: { modelId: string; region: string; cacheMode?: PromptCacheMode; client?: BedrockRuntimeClient }) {
    this.modelId = options.modelId
    this.checkpointMode = effectiveCacheMode(options.modelId, options.cacheMode ?? 'system')
    const client = options.client ?? new BedrockRuntimeClient({ region: options.region, requestHandler: new NodeHttpHandler(), maxAttempts: 2 })
    this.model = new ChatBedrockConverse({ model: options.modelId, region: options.region, client, maxTokens: MAX_TOKENS, maxRetries: 1 })
  }

  async generate(input: LlmInput): Promise<string> {
    const started = performance.now()
    const response = await this.model.invoke(
      converseMessages(input, this.checkpointMode),
      { signal: this.signal(input) },
    )
    if (response.usage_metadata) this.report(input, response.usage_metadata, { latencyMs: Math.round(performance.now() - started) })
    const content = response.content
    const text = typeof content === 'string' ? content : content.map((block) => (block.type === 'text' ? block.text : '')).join('')
    return text.trim()
  }

  async selectTools(input: LlmInput, tools: ModelTool[]) {
    const started = performance.now()
    const response = await this.model.bindTools(tools.map(tool => ({ toolSpec: {
      name: tool.name, description: tool.description, inputSchema: { json: tool.inputSchema },
    } }))).invoke(converseMessages(input, 'off'), { signal: this.signal(input) })
    if (response.usage_metadata) this.report(input, response.usage_metadata, { latencyMs: Math.round(performance.now() - started) })
    return response.tool_calls ?? []
  }

  async *stream(input: LlmInput): AsyncIterable<string> {
    const started = performance.now()
    let firstTokenMs: number | undefined
    const chunks = await this.model.stream(converseMessages(input, this.checkpointMode), { signal: this.signal(input) })
    for await (const chunk of chunks) {
      const text = typeof chunk.content === 'string' ? chunk.content : chunk.content.map(block => block.type === 'text' ? block.text : '').join('')
      if (text && firstTokenMs === undefined) firstTokenMs = Math.round(performance.now() - started)
      if (chunk.usage_metadata) this.report(input, chunk.usage_metadata, { latencyMs: Math.round(performance.now() - started), ...(firstTokenMs !== undefined ? { firstTokenMs } : {}) })
      if (text) yield text
    }
  }

  private signal(input: LlmInput): AbortSignal {
    return input.signal ? AbortSignal.any([input.signal, AbortSignal.timeout(input.timeoutMs)]) : AbortSignal.timeout(input.timeoutMs)
  }

  private report(input: LlmInput, usage: Parameters<typeof normalizeUsage>[0], timing: Parameters<typeof normalizeUsage>[1]) {
    const metrics = normalizeUsage(usage, timing, this.checkpointMode)
    // Only aggregate counters and timings: never log prompts, profiles, credentials or generated text.
    console.info(JSON.stringify({ event: 'assistant.llm.usage', modelId: this.modelId, ...metrics }))
    input.onUsage?.(metrics)
  }
}
