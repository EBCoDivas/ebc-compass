/** Nombre legible de un modelo a partir de su identificador de Bedrock (o del puente local), para selector y traza. */
export function modelDisplayName(modelId: string | undefined): string | undefined {
  const raw = modelId?.trim()
  if (!raw) return undefined
  const base = raw
    .replace(/^(?:us|eu|apac|global)\./, '')
    .replace(/^(?:local-|[a-z0-9-]+\.)/, '')
    .replace(/(?:-v?\d{1,2})?:\d+$/, '')
    .replace(/-\d{8}$/, '')
  const parts = base.split('-').filter(Boolean)
  if (parts.length === 0) return raw
  const word = (part: string) => part === 'oss' ? 'OSS' : part.charAt(0).toUpperCase() + part.slice(1)
  if (parts[0].toLowerCase() === 'gpt') return ['GPT-' + (parts[1] ? word(parts[1]) : ''), ...parts.slice(2).map(word)].join(' ').trim().replace(/-$/, '')
  return parts.map(word).join(' ')
}
