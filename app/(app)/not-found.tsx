import { SearchXIcon } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shell/empty-state"
import { Button } from "@/components/ui/button"

export default function AppNotFound() {
  return (
    <EmptyState
      icon={SearchXIcon}
      title="Não encontrado"
      description="Esta referência, pessoa ou projeto não existe ou foi excluído."
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href="/library">Ir para a biblioteca</Link>
        </Button>
      }
    />
  )
}
