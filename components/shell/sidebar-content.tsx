"use client"

import {
  AlertTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FilmIcon,
  FolderIcon,
  ImageIcon,
  ImagesIcon,
  InboxIcon,
  LayoutDashboardIcon,
  Loader2Icon,
  PaletteIcon,
  PauseIcon,
  PlusIcon,
  ScrollTextIcon,
  SearchIcon,
  ShuffleIcon,
  StarIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useOptionalAnalysis } from "@/features/analysis/analysis-provider"
import { PAUSE_TEXT } from "@/features/analysis/pause-text"
import { useIngest } from "@/features/ingest/ingest-provider"
import { openRandomReference } from "@/features/library/random-action"
import type { NavData } from "@/lib/shell/nav-data"
import { cn } from "@/lib/utils"

import { Avatar } from "./avatar"

type Props = {
  data: NavData
  expanded: boolean
  /** Desktop only: collapse/expand the rail. */
  onToggle?: () => void
  /** Called after any navigation (closes the mobile drawer). */
  onNavigate?: () => void
}

/** Library shortcuts: plain URL filters, so they stay shareable and back-button friendly. */
const EXPLORE: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "tipo=video", label: "Vídeos", icon: FilmIcon },
  { key: "tipo=image", label: "Imagens", icon: ImageIcon },
  { key: "nota=4", label: "Favoritas", icon: StarIcon },
]

const ROW =
  "relative flex h-10 w-full items-center gap-3.5 rounded-xl border border-transparent px-3 text-left whitespace-nowrap text-muted-foreground transition-colors hover:bg-glass-hover hover:text-foreground"
/* Glass pill brightening to the right, with a short bar at the end (expanded only). */
const ROW_ACTIVE =
  "border-glass-border bg-gradient-nav-active text-foreground shadow-[var(--glass-inset)] hover:bg-gradient-nav-active"
const ROW_ACTIVE_BAR = "after:absolute after:top-1/2 after:right-3.5 after:h-4 after:w-0.5 after:-translate-y-1/2 after:rounded-full after:bg-foreground"

/**
 * Sidebar content, modelled on the "Quantix" reference: wordmark, greeting, search and add, labelled sections, the account at the bottom.
 * Collapsed, it becomes an icon rail with a tooltip on every item.
 */
export function SidebarContent({ data, expanded, onToggle, onNavigate }: Props) {
  const searchRef = useRef<HTMLInputElement>(null)
  const focusSearchOnExpand = useRef(false)

  useEffect(() => {
    if (expanded && focusSearchOnExpand.current) {
      focusSearchOnExpand.current = false
      searchRef.current?.focus()
    }
  }, [expanded])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Brand + toggle */}
      <div className={cn("flex h-14 shrink-0 items-center gap-3 pt-2", expanded ? "px-5" : "h-auto flex-col px-3 pt-5")}>
        <Link
          href="/library"
          onClick={onNavigate}
          aria-label="Awen, início"
          className={cn("font-heading leading-none font-medium tracking-tight text-foreground", expanded ? "pl-1 text-2xl" : "text-xl")}
        >
          {expanded ? "Awen" : "A"}
        </Link>
        {onToggle ? (
          <WithTooltip label={expanded ? "Recolher menu" : "Expandir menu"} hint="[" show>
            <button
              type="button"
              onClick={onToggle}
              aria-label={expanded ? "Recolher menu" : "Expandir menu"}
              aria-expanded={expanded}
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-glass-hover text-muted-foreground transition-colors hover:text-foreground",
                expanded && "ml-auto",
              )}
            >
              {expanded ? <ChevronLeftIcon className="size-4" /> : <ChevronRightIcon className="size-4" />}
            </button>
          </WithTooltip>
        ) : null}
      </div>

      {/* Greeting: a small line, then the name as the headline. */}
      {expanded ? (
        <div className="shrink-0 px-5 pt-5">
          <p className="text-xs text-muted-foreground">Bem-vindo de volta,</p>
          <p className="truncate text-xl leading-tight font-medium tracking-tight text-foreground">{data.user.name}</p>
        </div>
      ) : null}

      {/* Search + add */}
      <div className={cn("flex shrink-0 flex-col gap-2 pt-5", expanded ? "px-5" : "items-center px-3")}>
        {expanded ? (
          <SearchField inputRef={searchRef} onNavigate={onNavigate} />
        ) : (
          <WithTooltip label="Buscar referências" show>
            <button
              type="button"
              onClick={() => {
                focusSearchOnExpand.current = true
                onToggle?.()
              }}
              aria-label="Buscar referências"
              className={cn(ROW, "w-10 justify-center px-0")}
            >
              <SearchIcon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
            </button>
          </WithTooltip>
        )}
        <AddButton expanded={expanded} onNavigate={onNavigate} />
      </div>

      {/* Navigation */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto pt-4 pb-3 [scrollbar-width:none]",
          expanded ? "px-5" : "items-center px-3",
        )}
      >
        <Suspense fallback={<Sections expanded={expanded} params={null} onNavigate={onNavigate} />}>
          <SectionsWithParams expanded={expanded} onNavigate={onNavigate} />
        </Suspense>
      </div>

      {/* Queue + account */}
      <div className={cn("flex shrink-0 flex-col gap-3 border-t border-glass-border py-3", expanded ? "px-5" : "items-center px-3")}>
        <QueueStatus expanded={expanded} onNavigate={onNavigate} />
        <AccountLink data={data} expanded={expanded} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- pieces */

function WithTooltip({
  label,
  hint,
  show,
  children,
}: {
  label: React.ReactNode
  hint?: string
  show: boolean
  children: React.ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {show ? (
        <TooltipContent side="right" sideOffset={12}>
          {label}
          {hint ? <kbd className="rounded-[5px] border border-current/30 px-1 font-mono text-[10px] opacity-70">{hint}</kbd> : null}
        </TooltipContent>
      ) : null}
    </Tooltip>
  )
}

function Section({ label, expanded, children }: { label: string; expanded: boolean; children: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-0.5", !expanded && "items-center")}>
      {expanded ? (
        <h2 className="pb-1 text-xs text-muted-foreground/70">{label}</h2>
      ) : (
        <div className="mb-1 h-px w-5 bg-glass-border" aria-hidden />
      )}
      {children}
    </section>
  )
}

function CountBox({ n, expanded, tone = "muted" }: { n: number; expanded: boolean; tone?: "muted" | "danger" }) {
  if (n <= 0) return null
  if (!expanded) {
    return (
      <span
        className={cn(
          "absolute -top-1 -right-1 min-w-4 rounded-full px-1 text-center text-[9px] leading-4 font-semibold tabular-nums",
          tone === "danger" ? "bg-destructive text-background" : "bg-primary text-primary-foreground",
        )}
      >
        {n > 99 ? "99+" : n}
      </span>
    )
  }
  return (
    <span
      className={cn(
        "ml-auto flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md border border-glass-border bg-glass-hover px-1.5 text-xs tabular-nums",
        tone === "danger" ? "text-destructive" : "text-foreground",
      )}
    >
      {n > 999 ? "999+" : n}
    </span>
  )
}

function NavRow({
  href,
  label,
  icon: Icon,
  count = 0,
  tone,
  active: activeProp,
  expanded,
  onNavigate,
}: {
  href: string
  label: string
  icon: LucideIcon
  count?: number
  tone?: "muted" | "danger"
  active?: boolean
  expanded: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const active = activeProp ?? (pathname === href || pathname.startsWith(`${href}/`))
  return (
    <WithTooltip label={count > 0 ? `${label} · ${count}` : label} show={!expanded}>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          ROW,
          !expanded && "w-10 justify-center px-0",
          active && ROW_ACTIVE,
          active && expanded && count === 0 && ROW_ACTIVE_BAR,
        )}
      >
        <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
        {expanded ? <span className="min-w-0 flex-1 truncate text-[15px]">{label}</span> : null}
        <CountBox n={count} expanded={expanded} tone={tone} />
      </Link>
    </WithTooltip>
  )
}

function AddButton({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  const { setDialogOpen } = useIngest()
  return (
    <WithTooltip label="Adicionar referência" show={!expanded}>
      <button
        type="button"
        onClick={() => {
          onNavigate?.()
          setDialogOpen(true)
        }}
        aria-label="Adicionar referência"
        className={cn(
          "flex h-10 items-center gap-3 rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary-hover",
          expanded ? "w-full px-3" : "w-10 justify-center",
        )}
      >
        <PlusIcon className="size-[18px] shrink-0" aria-hidden />
        {expanded ? <span className="text-sm font-medium">Adicionar referência</span> : null}
      </button>
    </WithTooltip>
  )
}

function SearchField({ inputRef, onNavigate }: { inputRef: React.RefObject<HTMLInputElement | null>; onNavigate?: () => void }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        const term = q.trim()
        router.push(term ? `/library?q=${encodeURIComponent(term)}` : "/library")
        setQ("")
        inputRef.current?.blur()
        onNavigate?.()
      }}
      className="relative"
    >
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar referências"
        aria-label="Buscar referências"
        className="h-10 w-full rounded-xl border border-glass-border bg-glass-hover pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
      />
    </form>
  )
}

/* The library shortcuts and Revisão/Falharam need the query string to know which one is active. */
function SectionsWithParams(props: { expanded: boolean; onNavigate?: () => void }) {
  const params = useSearchParams()
  return <Sections {...props} params={params.toString()} />
}

function Sections({ expanded, params, onNavigate }: { expanded: boolean; params: string | null; onNavigate?: () => void }) {
  const pathname = usePathname()
  const stats = useOptionalAnalysis()?.stats
  const shortcut = pathname === "/library" ? EXPLORE.find((e) => e.key === params)?.key : undefined
  const [randomPending, startRandom] = useTransition()
  const isBoard = /^\/projects\/[^/]+\/board/.test(pathname)

  return (
    <>
      <Section label="Visão geral" expanded={expanded}>
        <NavRow
          href="/library"
          label="Biblioteca"
          icon={ImagesIcon}
          active={pathname.startsWith("/library") && !shortcut}
          expanded={expanded}
          onNavigate={onNavigate}
        />
        <NavRow href="/prompts" label="Prompts" icon={ScrollTextIcon} expanded={expanded} onNavigate={onNavigate} />
        <NavRow
          href="/review"
          label="Revisão"
          icon={InboxIcon}
          count={stats?.toReview ?? 0}
          active={pathname === "/review" && params !== "aba=falhas"}
          expanded={expanded}
          onNavigate={onNavigate}
        />
        {stats && stats.failed > 0 ? (
          <NavRow
            href="/review?aba=falhas"
            label="Falharam"
            icon={AlertTriangleIcon}
            count={stats.failed}
            tone="danger"
            active={pathname === "/review" && params === "aba=falhas"}
            expanded={expanded}
            onNavigate={onNavigate}
          />
        ) : null}
      </Section>

      <Section label="Explorar" expanded={expanded}>
        {EXPLORE.map((e) => (
          <NavRow
            key={e.key}
            href={`/library?${e.key}`}
            label={e.label}
            icon={e.icon}
            active={shortcut === e.key}
            expanded={expanded}
            onNavigate={onNavigate}
          />
        ))}
        <WithTooltip label="Referência aleatória" show={!expanded}>
          <button
            type="button"
            disabled={randomPending}
            onClick={() =>
              startRandom(async () => {
                const result = await openRandomReference()
                if (result?.error) toast.error(result.error)
                else onNavigate?.()
              })
            }
            aria-label="Abrir uma referência aleatória"
            className={cn(ROW, !expanded && "w-10 justify-center px-0", "disabled:opacity-60")}
          >
            {randomPending ? (
              <Loader2Icon className="size-5 shrink-0 animate-spin" aria-hidden />
            ) : (
              <ShuffleIcon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
            )}
            {expanded ? <span className="min-w-0 flex-1 truncate text-[15px]">Aleatória</span> : null}
          </button>
        </WithTooltip>
      </Section>

      <Section label="Organizar" expanded={expanded}>
        <NavRow href="/people" label="Artistas" icon={PaletteIcon} expanded={expanded} onNavigate={onNavigate} />
        <NavRow
          href="/projects"
          label="Projetos"
          icon={FolderIcon}
          active={pathname.startsWith("/projects") && !isBoard}
          expanded={expanded}
          onNavigate={onNavigate}
        />
        <NavRow
          href="/moodboards"
          label="Moodboards"
          icon={LayoutDashboardIcon}
          active={pathname === "/moodboards" || isBoard}
          expanded={expanded}
          onNavigate={onNavigate}
        />
      </Section>
    </>
  )
}

/** Live analysis queue. Hidden when there is nothing to report. */
function QueueStatus({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
  const analysis = useOptionalAnalysis()
  if (!analysis) return null
  const { stats, pause } = analysis
  if (stats.queued + stats.analyzing === 0 && !pause) return null

  const title = pause ? "Análise pausada" : "Analisando referências"
  const detail = pause
    ? PAUSE_TEXT[pause.reason]
    : [stats.analyzing > 0 ? `${stats.analyzing} em análise` : null, stats.queued > 0 ? `${stats.queued} na fila` : null]
        .filter(Boolean)
        .join(" · ")
  const Icon = pause ? PauseIcon : Loader2Icon
  const iconClass = cn("shrink-0", pause ? "text-warning" : "animate-spin text-info")

  if (!expanded) {
    return (
      <WithTooltip label={`${title} · ${detail}`} show>
        <Link href="/review" onClick={onNavigate} aria-label={`${title}: ${detail}`} className={cn(ROW, "w-10 justify-center px-0")}>
          <Icon className={cn("size-5", iconClass)} aria-hidden />
        </Link>
      </WithTooltip>
    )
  }

  return (
    <Link
      href="/review"
      onClick={onNavigate}
      className="flex flex-col gap-1.5 rounded-xl border border-glass-border bg-glass-hover p-3 transition-colors hover:border-border-strong"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className={cn("size-4", iconClass)} aria-hidden />
        {title}
      </span>
      <span className="line-clamp-2 text-xs text-muted-foreground">{detail}</span>
    </Link>
  )
}

function AccountLink({ data, expanded, onNavigate }: { data: NavData; expanded: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const active = pathname === "/settings"
  const { user } = data
  return (
    <WithTooltip label={`${user.name} · Configurações da conta`} show={!expanded}>
      <Link
        href="/settings"
        onClick={onNavigate}
        aria-label="Configurações da conta"
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-xl border border-transparent transition-colors hover:bg-glass-hover",
          expanded ? "w-full p-2" : "p-1",
          active && ROW_ACTIVE,
        )}
      >
        <Avatar name={user.name} url={user.avatarUrl} />
        {expanded ? (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
            {user.email ? <span className="truncate text-xs text-muted-foreground">{user.email}</span> : null}
          </span>
        ) : null}
      </Link>
    </WithTooltip>
  )
}
