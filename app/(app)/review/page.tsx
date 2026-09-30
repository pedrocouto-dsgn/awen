import { InboxIcon } from "lucide-react"
import type { Metadata } from "next"

import { EmptyState } from "@/components/shell/empty-state"

export const metadata: Metadata = { title: "Revisão" }

export default function Page() {
  return <EmptyState icon={InboxIcon} title="Nada para revisar" description="Quando novas referências forem analisadas, elas aparecem aqui, uma de cada vez." />
}
