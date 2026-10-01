import type { Pause } from "./analysis-provider"

/** Why the analysis queue is paused, in the words shown to the user. */
export const PAUSE_TEXT: Record<Pause["reason"], string> = {
  rate_limit: "O provedor de IA limitou as requisições. A análise retoma sozinha.",
  billing: "Os créditos do provedor de IA acabaram. Adicione créditos ou use uma chave do plano gratuito.",
  auth: "A chave de IA foi recusada ou não está configurada. Verifique AI_API_KEY.",
  daily_limit: "Você atingiu o limite diário de análises. Os itens continuam na fila.",
}
