import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 bg-gradient-glow p-6 text-center">
      <p className="type-display-mega">404</p>
      <p className="text-muted-foreground">Página não encontrada.</p>
      <Button variant="outline" size="sm" asChild>
        <Link href="/library">Voltar para o Awen</Link>
      </Button>
    </main>
  )
}
