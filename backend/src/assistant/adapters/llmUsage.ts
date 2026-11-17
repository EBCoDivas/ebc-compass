import type { LlmUsage, PromptCacheMode } from '../types.js'

type UsageMetadata = { input_tokens: number; output_tokens: number; total_tokens: number; input_token_details?: { cache_read?: number; cache_creation?: number } }

/** LangChain counts cache reads/writes in input_tokens; Bedrock's inputTokens excludes them. */
export function normalizeUsage(usage: UsageMetadata, timing: { latencyMs: number; firstTokenMs?: number }, checkpointMode: PromptCacheMode): LlmUsage {
  const read = usage.input_token_details?.cache_read
  const write = usage.input_token_details?.cache_creation
  return {
    inputTokens: Math.max(0, usage.input_tokens - (read ?? 0) - (write ?? 0)),
    totalInputTokens: usage.input_tokens, outputTokens: usage.output_tokens, totalTokens: usage.total_tokens,
    ...(read !== undefined ? { cacheReadInputTokens: read } : {}),
    ...(write !== undefined ? { cacheWriteInputTokens: write } : {}),
    ...timing, checkpointMode,
  }
}
