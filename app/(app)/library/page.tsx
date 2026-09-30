import { ImagesIcon } from "lucide-react"
import type { Metadata } from "next"

import { EmptyState } from "@/components/shell/empty-state"

export const metadata: Metadata = { title: "Biblioteca" }

export default function Page() {
  return <EmptyState icon={ImagesIcon} title="Nenhuma referência aprovada ainda" description="Adicione imagens, vídeos ou links. Depois da análise e da revisão, eles aparecem aqui." />
}
