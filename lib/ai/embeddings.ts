import "server-only"

import type { Content } from "@google/genai"

import { embeddingConfig } from "@/lib/env/server"

import { RetryableAnalysisError } from "./errors"
import { classifyGeminiError, geminiClient } from "./providers/gemini"

/** Matches references.embedding vector(768). Changing it needs a migration. */
export const EMBEDDING_DIMENSIONS = 768

export type EmbeddingDocument = {
  /** Preview image (JPEG). Omitted when the reference has no image to read. */
  image?: Uint8Array
  /** Curated text: description, tags, notes… */
  text: string
}

export function embeddingModel(): string | null {
  return embeddingConfig()?.model ?? null
}

/**
 * One fused image+text vector per document, in the same space as text queries,
 * so a single column serves natural-language and similar-image search.
 */
export async function embedDocuments(docs: EmbeddingDocument[]): Promise<number[][]> {
  const contents: Content[] = docs.map((doc) => ({
    parts: [
      ...(doc.image ? [{ inlineData: { data: Buffer.from(doc.image).toString("base64"), mimeType: "image/jpeg" } }] : []),
      // The API rejects empty content, so a reference with neither image nor text gets a placeholder.
      ...(doc.text || !doc.image ? [{ text: doc.text || "Visual reference" }] : []),
    ],
  }))
  return embed(contents, "RETRIEVAL_DOCUMENT")
}

/** Vector for an image used as a search query ("find references like this"). */
export async function embedImageQuery(image: Uint8Array): Promise<number[]> {
  const [vector] = await embed(
    [{ parts: [{ inlineData: { data: Buffer.from(image).toString("base64"), mimeType: "image/jpeg" } }] }],
    "RETRIEVAL_QUERY",
  )
  if (!vector) throw new RetryableAnalysisError("Empty embedding response.")
  return vector
}

/** Vector for a natural-language search query. */
export async function embedQuery(query: string): Promise<number[]> {
  const [vector] = await embed([{ parts: [{ text: query }] }], "RETRIEVAL_QUERY")
  if (!vector) throw new RetryableAnalysisError("Empty embedding response.")
  return vector
}

async function embed(contents: Content[], taskType: string): Promise<number[][]> {
  const config = embeddingConfig()
  if (!config) throw new RetryableAnalysisError("Embeddings are not configured (no Gemini key).", 30 * 60_000, "auth")
  if (contents.length === 0) return []

  let values: (number[] | undefined)[]
  try {
    const res = await geminiClient(config.apiKey).models.embedContent({
      model: config.model,
      contents,
      config: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType },
    })
    values = (res.embeddings ?? []).map((e) => e.values)
  } catch (error) {
    throw classifyGeminiError(error)
  }

  if (values.length !== contents.length || values.some((v) => !v || v.length !== EMBEDDING_DIMENSIONS)) {
    throw new RetryableAnalysisError("Unexpected embedding response.")
  }
  return values.map((v) => normalize(v as number[]))
}

/** Truncated (768-d) vectors are not unit length; normalizing keeps cosine and dot product equivalent. */
function normalize(v: number[]): number[] {
  const norm = Math.hypot(...v)
  return norm > 0 ? v.map((x) => x / norm) : v
}

/** pgvector text format. */
export function toPgVector(v: number[]): string {
  return `[${v.join(",")}]`
}
