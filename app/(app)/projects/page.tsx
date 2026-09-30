import { FolderIcon } from "lucide-react"
import type { Metadata } from "next"

import { EmptyState } from "@/components/shell/empty-state"

export const metadata: Metadata = { title: "Projetos" }

export default function Page() {
  return <EmptyState icon={FolderIcon} title="Nenhum projeto ainda" description="Crie projetos para agrupar referências." />
}
