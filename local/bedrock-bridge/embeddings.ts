// Contrato de Titan Text Embeddings v2 (InvokeModel) que el puente atiende con la API de embeddings de OpenAI.

export const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small'
const DIMENSIONS = [256, 512, 1024]

export interface TitanEmbeddingRequest { inputText?: string; dimensions?: number; normalize?: boolean }
export interface TitanEmbeddingResponse { embedding: number[]; inputTextTokenCount: number }

/** Valida la petición de Titan v2 y devuelve el texto y las dimensiones (1,024 por omisión, como en el lab). */
export function parseTitanRequest(modelId: string, body: TitanEmbeddingRequest): { text: string; dimensions: number } {
  if (!modelId.startsWith('amazon.titan-embed-text-v2')) throw new RangeError(`El puente solo traduce embeddings de amazon.titan-embed-text-v2, no ${modelId}.`)
  const text = body.inputText?.trim()
  if (!text) throw new RangeError('inputText es obligatorio.')
  const dimensions = body.dimensions ?? 1024
  if (!DIMENSIONS.includes(dimensions)) throw new RangeError(`dimensions debe ser ${DIMENSIONS.join(', ')}.`)
  if (body.normalize === false) throw new RangeError('El puente solo devuelve embeddings normalizados.')
  return { text, dimensions }
}
