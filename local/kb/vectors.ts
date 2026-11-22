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
const MAX_CHUNK_CHARS = 1200

// ---------- Fragmentos ----------

export interface Chunk { key: string; text: string }

/**
 * Divide un documento por secciones (`##`) y parte las secciones largas por párrafos.
 * Cada fragmento conserva el título del documento y de su sección para que el embedding tenga contexto.
 */
export function chunkDocument(path: string, title: string, body: string): Chunk[] {
  const sections = body.replace(/^#\s.*\n?/m, '').split(/\n(?=##\s)/).map((part) => part.trim()).filter(Boolean)
  const chunks: string[] = []
  for (const section of sections) {
    const heading = section.startsWith('##') ? section.split('\n')[0].replace(/^#+\s*/, '') : ''
    const prefix = heading ? `${title} · ${heading}\n` : `${title}\n`
    const content = heading ? section.split('\n').slice(1).join('\n').trim() : section
    let current = ''
    for (const paragraph of content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
      if (current && prefix.length + current.length + paragraph.length + 2 > MAX_CHUNK_CHARS) {
        chunks.push(prefix + current)
        current = ''
      }
      current = current ? `${current}\n\n${paragraph}` : paragraph
    }
    if (current) chunks.push(prefix + current)
  }
  return chunks.map((text, index) => ({ key: `${path}#${index}`, text }))
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
      metadataConfiguration: { nonFilterableMetadataKeys: [TEXT_KEY] },
    }))
    existed = false
  }
  return existed
}
