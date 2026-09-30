import "server-only"

import { GoogleGenAI } from "@google/genai"

import { serverEnv } from "@/lib/env/server"

let client: GoogleGenAI | undefined

export function gemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: serverEnv().GEMINI_API_KEY })
  return client
}

export function geminiModel(): string {
  return serverEnv().GEMINI_MODEL
}
