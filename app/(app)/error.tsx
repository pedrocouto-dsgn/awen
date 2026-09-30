"use client" // Error boundaries must be Client Components

import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react"
import { useEffect } from "react"

import { EmptyState } from "@/components/shell/empty-state"
import { Button } from "@/components/ui/button"

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <EmptyState
      icon={AlertTriangleIcon}
      title="Algo deu errado"
      description={
        error.digest
          ? `Não foi possível carregar esta página. Tente de novo. (código ${error.digest})`
          : "Não foi possível carregar esta página. Tente de novo."
      }
      action={
        <Button variant="outline" size="sm" onClick={() => retry()}>
          <RotateCcwIcon /> Tentar de novo
        </Button>
      }
    />
  )
}
