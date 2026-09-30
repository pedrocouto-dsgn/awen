import { UsersIcon } from "lucide-react"
import type { Metadata } from "next"

import { EmptyState } from "@/components/shell/empty-state"

export const metadata: Metadata = { title: "Pessoas" }

export default function Page() {
  return <EmptyState icon={UsersIcon} title="Nenhuma pessoa cadastrada" description="Diretores, fotógrafos e artistas ligados às suas referências aparecem aqui." />
}
