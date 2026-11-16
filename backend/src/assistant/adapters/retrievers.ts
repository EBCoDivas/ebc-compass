// Recuperación de conocimiento. Un solo adaptador para local y producción (Retrieve de Bedrock Knowledge Bases):
// local lo atiende el puente con el Vector Store de OpenAI; en el lab, la Knowledge Base real sobre S3 Vectors.
// KeywordRetriever es el respaldo (sin red) y FallbackRetriever los encadena.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { contentTokens, fuzzyEquals, normalize } from '../domain/text.js'
import type { KnowledgeRetriever, Language, Passage } from '../types.js'

type Options = { language: Language; topics?: string[]; limit?: number }

export class BedrockKnowledgeBaseRetriever implements KnowledgeRetriever {
  private readonly client: BedrockAgentRuntimeClient

  constructor(private readonly options: { knowledgeBaseId: string; region: string }) {
    this.client = new BedrockAgentRuntimeClient({ region: options.region, requestHandler: new NodeHttpHandler(), maxAttempts: 2 })
  }

  /**
   * Filtra por metadatos del documento: siempre por idioma y, si se indican temas, una consulta por tema
   * (filtro `equals` + `andAll`, sin anidar) cuyos resultados se combinan por puntaje. Son los mismos filtros
   * y metadatos escalares que se exportan en los .metadata.json para la Knowledge Base sobre S3 Vectors.
   */
  async retrieve(query: string, { language, topics, limit = 3 }: Options): Promise<Passage[]> {
    const topicList = topics && topics.length > 0 ? topics : [undefined]
    const batches = await Promise.all(topicList.map((topic) => this.search(query, language, topic, limit)))
    const merged = new Map<string, Passage>()
    for (const passage of batches.flat()) {
      const key = `${passage.source}:${passage.text.slice(0, 40)}`
      if (!merged.has(key) || (passage.score ?? 0) > (merged.get(key)?.score ?? 0)) merged.set(key, passage)
    }
    return [...merged.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
  }

  private async search(query: string, language: Language, topic: string | undefined, limit: number): Promise<Passage[]> {
    const filters = [{ equals: { key: 'language', value: language } }, ...(topic ? [{ equals: { key: 'topic', value: topic } }] : [])]
    const response = await this.client.send(
      new RetrieveCommand({
        knowledgeBaseId: this.options.knowledgeBaseId,
        retrievalQuery: { text: query },
        retrievalConfiguration: {
          vectorSearchConfiguration: { numberOfResults: limit, filter: filters.length === 1 ? filters[0] : { andAll: filters } },
        },
      }),
    )
    return (response.retrievalResults ?? []).map((result) => {
      const uri = result.location?.s3Location?.uri ?? ''
      const metadata = (result.metadata ?? {}) as Record<string, unknown>
      return {
        text: stripFrontMatter(result.content?.text ?? ''),
        source: uri.split('/').pop() ?? uri,
        title: typeof metadata.title === 'string' ? metadata.title : undefined,
        score: result.score,
      }
    })
  }
}

function stripFrontMatter(text: string): string {
  return text.replace(/^---[\s\S]*?---\s*/, '').trim()
}

interface Chunk {
  source: string
  title: string
  topic: string
  language: Language
  text: string
  tokens: string[]
}

/** Respaldo sin red: puntúa secciones de los .md por coincidencia de palabras (con tolerancia a erratas). */
export class KeywordRetriever implements KnowledgeRetriever {
  private chunks?: Chunk[]

  constructor(private readonly dir: string) {}

  private load(): Chunk[] {
    if (this.chunks) return this.chunks
    const chunks: Chunk[] = []
    if (existsSync(this.dir)) {
      for (const name of readdirSync(this.dir).filter((file) => file.endsWith('.md'))) {
        const raw = readFileSync(join(this.dir, name), 'utf8')
        const front = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
        const meta = Object.fromEntries((front?.[1] ?? '').split('\n').map((line) => line.split(/:\s*(.*)/).slice(0, 2)))
        const body = front?.[2] ?? raw
        const language: Language = meta.language === 'en' ? 'en' : 'es'
        const title = meta.title ?? name
        for (const section of body.split(/\n(?=## )/)) {
          const text = section.trim()
          if (text.length > 0) chunks.push({ source: name, title, topic: meta.topic ?? '', language, text, tokens: contentTokens(normalize(`${title} ${text}`)) })
        }
      }
    }
    this.chunks = chunks
    return chunks
  }

  async retrieve(query: string, { language, topics, limit = 3 }: Options): Promise<Passage[]> {
    const queryTokens = contentTokens(normalize(query)).filter((token) => token.length > 2)
    if (queryTokens.length === 0) return []
    return this.load()
      .filter((chunk) => chunk.language === language && (!topics || topics.length === 0 || topics.includes(chunk.topic)))
      .map((chunk) => ({ chunk, score: queryTokens.filter((token) => chunk.tokens.some((word) => fuzzyEquals(token, word))).length / queryTokens.length }))
      .filter((entry) => entry.score >= 0.34)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ chunk, score }) => ({ text: chunk.text, source: chunk.source, title: chunk.title, score }))
  }
}

/** Usa el retriever principal y, si falla (sin red, sin clave, KB no cargada), el de respaldo. */
export class FallbackRetriever implements KnowledgeRetriever {
  constructor(
    private readonly primary: KnowledgeRetriever,
    private readonly secondary: KnowledgeRetriever,
  ) {}

  async retrieve(query: string, options: Options): Promise<Passage[]> {
    try {
      return await this.primary.retrieve(query, options)
    } catch {
      return this.secondary.retrieve(query, options)
    }
  }
}
