import type { Metadata } from "next"
import Link from "next/link"

import { PageBreadcrumb } from "@/components/shell/page-breadcrumb"
import { AccountSettings } from "@/features/settings/account-settings"
import { VocabularyEditor } from "@/features/settings/vocabulary-editor"
import { getVocabularies } from "@/lib/references/vocab"
import { getNavData } from "@/lib/shell/nav-data"
import { createClient } from "@/lib/supabase/server"
import type { VocabCategory } from "@/types/database"

export const metadata: Metadata = { title: "Configurações" }

const TABS = [
  { key: "conta", label: "Conta" },
  { key: "filtros", label: "Filtros" },
] as const

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const tab = (await searchParams).aba === "filtros" ? "filtros" : "conta"
  const supabase = await createClient()

  if (tab === "conta") {
    const { user } = await getNavData(supabase)
    return (
      <SettingsShell tab={tab} description="Seu perfil, senha e aparência do Awen.">
        <AccountSettings user={user} />
      </SettingsShell>
    )
  }

  const [vocab, refs] = await Promise.all([
    getVocabularies(supabase),
    supabase.from("references").select("shot_type, camera_angle, camera_movement, lighting, mood").neq("status", "rejected"),
  ])
  if (refs.error) throw refs.error

  // Usage per term (personal-scale library: counted in memory).
  const counts: Record<VocabCategory, Record<string, number>> = {
    shot_type: {},
    camera_angle: {},
    camera_movement: {},
    lighting: {},
    mood: {},
  }
  const bump = (c: VocabCategory, t: string | null) => {
    if (t) counts[c][t] = (counts[c][t] ?? 0) + 1
  }
  for (const r of refs.data ?? []) {
    bump("shot_type", r.shot_type)
    bump("camera_angle", r.camera_angle)
    bump("camera_movement", r.camera_movement)
    r.lighting.forEach((t) => bump("lighting", t))
    r.mood.forEach((t) => bump("mood", t))
  }

  return (
    <SettingsShell
      tab={tab}
      description="Vocabulários usados pela IA na análise e nos filtros da biblioteca. Os termos ficam em inglês, como a análise."
    >
      <VocabularyEditor vocab={vocab} counts={counts} />
    </SettingsShell>
  )
}

function SettingsShell({
  tab,
  description,
  children,
}: {
  tab: string
  description: string
  children: React.ReactNode
}) {
  return (
    <>
      <PageBreadcrumb
        items={[
          { label: "Configurações", href: "/settings" },
          { label: TABS.find((t) => t.key === tab)?.label ?? "Conta" },
        ]}
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-4 pb-8 md:px-8">
        <header className="flex flex-col gap-2">
          <h1 className="type-display-lg">Configurações</h1>
          <p className="text-muted-foreground">{description}</p>
        </header>
        <nav aria-label="Seções das configurações" className="glass flex w-fit gap-1 rounded-xl p-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "conta" ? "/settings" : `/settings?aba=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={
                tab === t.key
                  ? "rounded-lg border border-glass-border bg-gradient-nav-active px-4 py-1.5 text-sm font-medium text-foreground shadow-[var(--glass-inset)]"
                  : "rounded-lg border border-transparent px-4 py-1.5 text-sm text-muted-foreground hover:bg-glass-hover hover:text-foreground"
              }
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </>
  )
}
