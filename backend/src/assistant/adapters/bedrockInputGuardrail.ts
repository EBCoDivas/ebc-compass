import { ApplyGuardrailCommand, BedrockRuntimeClient, type ApplyGuardrailCommandOutput } from '@aws-sdk/client-bedrock-runtime'
import type { InputBlock, InputGuardrail } from '../types.js'

type Client = { send(command: ApplyGuardrailCommand, options: { abortSignal: AbortSignal }): Promise<ApplyGuardrailCommandOutput> }
export class BedrockInputGuardrail implements InputGuardrail {
  private readonly client: Client
  constructor(private readonly options: { region: string; id: string; version: string; client?: Client }) {
    this.client = options.client ?? new BedrockRuntimeClient({ region: options.region, maxAttempts: 1 })
  }
  async assess(text: string): Promise<InputBlock | undefined> {
    const result = await this.client.send(new ApplyGuardrailCommand({ guardrailIdentifier: this.options.id,
      guardrailVersion: this.options.version, source: 'INPUT', content: [{ text: { text, qualifiers: ['guard_content'] } }] }),
    { abortSignal: AbortSignal.timeout(5000) })
    if (result.action === 'NONE') return undefined
    if (result.action !== 'GUARDRAIL_INTERVENED') throw new Error('Respuesta de guardrail inválida.')
    const assessments = result.assessments ?? []
    const filters = assessments.flatMap(item => item.contentPolicy?.filters ?? []).filter(item => item.action === 'BLOCKED')
    const category: InputBlock['category'] = filters.some(item => item.type === 'PROMPT_ATTACK') ? 'prompt-injection'
      : filters.length ? 'harmful-content'
        : assessments.some(item => item.topicPolicy?.topics?.some(topic => topic.name === 'OtherStudentRecords' && topic.action === 'BLOCKED')) ? 'other-person-data'
          : 'out-of-scope'
    return { category, source: 'bedrock' }
  }
}
