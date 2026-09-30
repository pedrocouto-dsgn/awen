"use client"

import { AlertTriangleIcon, Loader2Icon, PauseCircleIcon, RotateCcwIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import { useAnalysis, type Pause } from "../analysis-provider"

const PAUSE_TEXT: Record<Pause["reason"], string> = {
  rate_limit: "O Gemini limitou as requisições. A análise retoma sozinha.",
  billing: "Os créditos do Gemini acabaram. Adicione créditos ou use uma chave do plano gratuito.",
  auth: "A chave do Gemini foi recusada. Verifique GEMINI_API_KEY.",
  daily_limit: "Você atingiu o limite diário de análises. Os itens continuam na fila.",
}

function minutesUntil(ts: number) {
  return Math.max(1, Math.round((ts - Date.now()) / 60_000))
}

export function AnalysisIndicator() {
  const { stats, pause, retryFailed, kick } = useAnalysis()
  const [retrying, setRetrying] = useState(false)
  const inQueue = stats.queued + stats.analyzing

  if (!pause && inQueue === 0 && stats.failed === 0) return null

  const label = pause
    ? "Análise pausada"
    : inQueue > 0
      ? `Analisando ${inQueue}`
      : `${stats.failed} ${stats.failed === 1 ? "falhou" : "falharam"}`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground" aria-live="polite">
          {pause ? (
            <PauseCircleIcon />
          ) : inQueue > 0 ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <AlertTriangleIcon className="text-destructive" />
          )}
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-3 text-sm">
        <p className="font-medium">Análise por IA</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
          <dt>Na fila</dt>
          <dd className="text-right text-foreground tabular-nums">{stats.queued}</dd>
          <dt>Analisando</dt>
          <dd className="text-right text-foreground tabular-nums">{stats.analyzing}</dd>
          <dt>Para revisar</dt>
          <dd className="text-right text-foreground tabular-nums">{stats.toReview}</dd>
          <dt>Falharam</dt>
          <dd className="text-right text-foreground tabular-nums">{stats.failed}</dd>
        </dl>
        {pause ? (
          <>
            <p className="text-muted-foreground">
              {PAUSE_TEXT[pause.reason]} Nova tentativa em ~{minutesUntil(pause.until)} min.
            </p>
            <Button variant="outline" size="sm" onClick={kick}>
              <RotateCcwIcon /> Tentar agora
            </Button>
          </>
        ) : null}
        {stats.failed > 0 ? (
          <Button
            variant="outline"
            size="sm"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true)
              try {
                const n = await retryFailed()
                toast.success(`${n} ${n === 1 ? "item reenviado" : "itens reenviados"} para análise.`)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Erro ao reenviar.")
              } finally {
                setRetrying(false)
              }
            }}
          >
            <RotateCcwIcon /> Tentar de novo as falhas
          </Button>
        ) : null}
        {stats.toReview > 0 ? (
          <Button variant="secondary" size="sm" asChild>
            <Link href="/review">Ir para a revisão</Link>
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
