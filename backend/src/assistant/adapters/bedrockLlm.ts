// LLM por Amazon Bedrock (API Converse) a través de @langchain/aws.
// En local, AWS_ENDPOINT_URL_BEDROCK_RUNTIME apunta al puente (que responde con OpenAI); en el lab, a Bedrock real.
// El cliente usa HTTP/1.1: el HTTP/2 por defecto del SDK no es compatible con el puente en HTTP plano.

import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime'
import { ChatBedrockConverse } from '@langchain/aws'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import type { LlmProvider } from '../types.js'

// Un modelo con razonamiento gasta parte de este límite pensando: se deja holgado para que no devuelva texto vacío.
const MAX_TOKENS = 4000

export class BedrockLlmProvider implements LlmProvider {
  private readonly model: ChatBedrockConverse

  constructor(options: { modelId: string; region: string }) {
    const client = new BedrockRuntimeClient({ region: options.region, requestHandler: new NodeHttpHandler(), maxAttempts: 2 })
    this.model = new ChatBedrockConverse({ model: options.modelId, region: options.region, client, maxTokens: MAX_TOKENS, maxRetries: 1 })
  }

  async generate(input: { system: string; messages: { role: 'user' | 'assistant'; content: string }[]; timeoutMs: number }): Promise<string> {
    const response = await this.model.invoke(
      [
        ['system', input.system],
        ...input.messages.map((message) => [message.role === 'user' ? 'human' : 'ai', message.content] as [string, string]),
      ],
      { signal: AbortSignal.timeout(input.timeoutMs) },
    )
    const content = response.content
    const text = typeof content === 'string' ? content : content.map((block) => (block.type === 'text' ? block.text : '')).join('')
    return text.trim()
  }
}
