// Base de conocimiento local sobre S3 Vectors (emulador), con la misma forma que la del lab:
// índice float32 de 1,024 dimensiones con distancia coseno y embeddings de Titan Text Embeddings v2.
// En local, el puente traduce esos embeddings a OpenAI. Lo comparten el puente (Retrieve) y kb/cli.ts (ingesta).

import { CreateIndexCommand, CreateVectorBucketCommand, GetIndexCommand, GetVectorBucketCommand, S3VectorsClient } from '@aws-sdk/client-s3vectors'
import type { DocumentType } from '@smithy/types'

export const VECTOR_BUCKET = process.env.KNOWLEDGE_VECTOR_BUCKET ?? 'ebc-compass-knowledge-vectors-local'
export const VECTOR_INDEX = process.env.KNOWLEDGE_VECTOR_INDEX ?? 'ebc-compass-knowledge'
export const DIMENSION = 1024
export const EMBEDDING_MODEL_ID = 'amazon.titan-embed-text-v2:0'
/** Claves de metadatos que Bedrock usa con S3 Vectors. El texto del fragmento no se puede filtrar, igual que en el lab. */
export const TEXT_KEY = 'AMAZON_BEDROCK_TEXT_CHUNK'
export const SOURCE_KEY = 'x-amz-bedrock-kb-source-uri'
export const METADATA_KEY = 'AMAZON_BEDROCK_METADATA'

// ---------- Fragmentos ----------

export interface Chunk { key: string; text: string }

/** Estrategia por omisión de Bedrock Knowledge Bases (la que usa la del lab, que no declara otra): ~300 tokens por fragmento. */
export const CHUNK_MAX_TOKENS = 300
export const CHUNK_OVERLAP = 0.2

/** Conteo estimado (~4 caracteres por token): Titan usa su propio tokenizador y aquí no hay uno equivalente. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4)

/**
 * Fragmenta como la estrategia por omisión de Bedrock: fragmentos de unos 300 tokens que respetan los límites de
 * oración (aquí también los saltos de línea), con 20 % de traslape. Un texto de 300 tokens o menos no se divide.
 * Es una aproximación: el conteo de tokens es estimado y el traslape sigue la guía de AWS para esa estrategia.
 */
export function chunkText(text: string, { maxTokens = CHUNK_MAX_TOKENS, overlap = CHUNK_OVERLAP } = {}): string[] {
  const maxChars = maxTokens * 4
  const segments: string[] = []
  // Cada segmento conserva su espacio final para poder reconstruir el texto sin perder saltos de línea.
  for (const sentence of text.split(/(?<=[.!?…]\s|\n)/).filter(Boolean)) {
    for (let at = 0; at < sentence.length; at += maxChars) segments.push(sentence.slice(at, at + maxChars)) // oración más larga que un fragmento
  }
  const chunks: string[] = []
  let current: string[] = []
  const size = (parts: string[]) => parts.reduce((total, part) => total + part.length, 0)
  for (const segment of segments) {
    if (current.length > 0 && size(current) + segment.length > maxChars) {
      chunks.push(current.join('').trim())
      const carried: string[] = []
      for (let i = current.length - 1; i > 0 && size(carried) + current[i].length <= maxChars * overlap; i--) carried.unshift(current[i])
      current = size(carried) + segment.length <= maxChars ? carried : []
    }
    current.push(segment)
  }
  if (current.length > 0) chunks.push(current.join('').trim())
  return chunks.filter(Boolean)
}

/** Fragmenta un documento tal como lo lee Bedrock desde S3: el archivo completo, con su front-matter. */
export function chunkDocument(path: string, text: string): Chunk[] {
  return chunkText(text).map((chunk, index) => ({ key: `${path}#${index}`, text: chunk }))
}

// ---------- Filtros ----------

export type BedrockFilter = {
  equals?: { key: string; value: unknown }
  notEquals?: { key: string; value: unknown }
  in?: { key: string; value: unknown }
  andAll?: BedrockFilter[]
  orAll?: BedrockFilter[]
}

/** Traduce el filtro de Retrieve de Bedrock a la sintaxis de metadatos de S3 Vectors. */
export function toS3VectorsFilter(filter: BedrockFilter | undefined): DocumentType | undefined {
  if (!filter) return undefined
  const value = (entry: { value: unknown }) => entry.value as DocumentType
  if (filter.equals) return { [filter.equals.key]: { $eq: value(filter.equals) } }
  if (filter.notEquals) return { [filter.notEquals.key]: { $ne: value(filter.notEquals) } }
  if (filter.in) return { [filter.in.key]: { $in: value(filter.in) } }
  const list = (items: BedrockFilter[]) => items.map(toS3VectorsFilter).filter((item): item is DocumentType => item !== undefined)
  if (filter.andAll) return { $and: list(filter.andAll) }
  if (filter.orAll) return { $or: list(filter.orAll) }
  throw new Error('Filtro de recuperación no soportado.')
}

// ---------- Recursos ----------

const isMissing = (error: unknown) => {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e.name === 'NotFoundException' || e.name === 'ResourceNotFoundException' || e.$metadata?.httpStatusCode === 404
}

/** Crea el bucket y el índice de vectores si no existen. Con `check`, solo verifica. Devuelve true si ya existían. */
export async function ensureVectorIndex(client: S3VectorsClient, check = false): Promise<boolean> {
  let existed = true
  try {
    await client.send(new GetVectorBucketCommand({ vectorBucketName: VECTOR_BUCKET }))
  } catch (error) {
    if (!isMissing(error)) throw error
    if (check) throw new Error(`Falta el bucket de vectores ${VECTOR_BUCKET}`)
    await client.send(new CreateVectorBucketCommand({ vectorBucketName: VECTOR_BUCKET }))
    existed = false
  }
  try {
    const { index } = await client.send(new GetIndexCommand({ vectorBucketName: VECTOR_BUCKET, indexName: VECTOR_INDEX }))
    if (index?.dimension !== DIMENSION) throw new Error(`El índice ${VECTOR_INDEX} tiene ${index?.dimension} dimensiones; se esperaban ${DIMENSION}.`)
  } catch (error) {
    if (!isMissing(error)) throw error
    if (check) throw new Error(`Falta el índice de vectores ${VECTOR_INDEX}`)
    await client.send(new CreateIndexCommand({
      vectorBucketName: VECTOR_BUCKET, indexName: VECTOR_INDEX, dataType: 'float32', dimension: DIMENSION, distanceMetric: 'cosine',
      metadataConfiguration: { nonFilterableMetadataKeys: [TEXT_KEY, METADATA_KEY] },
    }))
    existed = false
  }
  return existed
}
