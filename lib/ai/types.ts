import type { AnalysisContext } from "./prompt"
import type { Vocabularies } from "./schema"

export type AnalysisInput =
  | { kind: "images"; images: { data: Uint8Array; mimeType: string }[] }
  | { kind: "youtube"; url: string }

/** What every provider receives: media, the prompt text and the JSON Schema to answer with. */
export type AnalysisRequest = {
  input: AnalysisInput
  ctx: AnalysisContext
  vocab: Vocabularies
  prompt: string
  jsonSchema: Record<string, unknown>
}

export type AnalysisProvider = {
  /** Name used in user-facing error messages. */
  label: string
  /**
   * Returns the model's raw JSON text. Throws RetryableAnalysisError or FatalAnalysisError.
   * Providers that cannot read YouTube URLs throw FatalAnalysisError, so the caller falls back to the thumbnail.
   */
  generate(request: AnalysisRequest, config: { model: string; apiKey: string }): Promise<string | undefined>
}
