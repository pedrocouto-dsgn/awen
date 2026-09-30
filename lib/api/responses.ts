import "server-only"

import { NextResponse } from "next/server"
import type { z } from "zod"

export type ApiError = { error: string; details?: unknown }

export function jsonError(status: number, error: string, details?: unknown) {
  return NextResponse.json<ApiError>({ error, ...(details ? { details } : {}) }, { status })
}

export const unauthorized = () => jsonError(401, "Sessão expirada. Entre novamente.")
export const notFound = () => jsonError(404, "Referência não encontrada.")

export function invalid(error: z.ZodError) {
  return jsonError(
    400,
    "Dados inválidos.",
    error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  )
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

/** Logs server errors without leaking details (or secrets) to the client. */
export function serverError(context: string, error: unknown) {
  console.error(`[${context}]`, error instanceof Error ? error.message : error)
  return jsonError(500, "Erro no servidor. Tente novamente.")
}
