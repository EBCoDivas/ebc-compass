interface OpenAiUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number } | null
}

/** OpenAI includes cached tokens in prompt_tokens; Bedrock excludes them from inputTokens. */
export function bedrockUsage(usage: OpenAiUsage) {
  const read = usage.prompt_tokens_details?.cached_tokens
  const write = usage.prompt_tokens_details?.cache_write_tokens
  return {
    inputTokens: Math.max(0, usage.prompt_tokens - (read ?? 0) - (write ?? 0)),
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    ...(read !== undefined ? { cacheReadInputTokens: read } : {}),
    ...(write !== undefined ? { cacheWriteInputTokens: write } : {}),
    // Missing counters remain absent, never an invented zero.
  }
}
