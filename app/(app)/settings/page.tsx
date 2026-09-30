import { SettingsIcon } from "lucide-react"
import type { Metadata } from "next"

import { EmptyState } from "@/components/shell/empty-state"

export const metadata: Metadata = { title: "Configurações" }

export default function Page() {
  return <EmptyState icon={SettingsIcon} title="Configurações" description="A edição dos vocabulários chega em breve." />
}
