import type { Pause } from "./analysis-provider"

/** Why the analysis queue is paused, in the words shown to the user. */
export const PAUSE_TEXT: Record<Pause["reason"], string> = {
  rate_limit: "O Gemini limitou as requisições. A análise retoma sozinha.",
  billing: "Os créditos do Gemini acabaram. Adicione créditos ou use uma chave do plano gratuito.",
  auth: "A chave do Gemini foi recusada. Verifique GEMINI_API_KEY.",
  daily_limit: "Você atingiu o limite diário de análises. Os itens continuam na fila.",
}
