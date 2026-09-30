import { Wordmark } from "@/components/brand/wordmark"

import { NavLinks, SETTINGS_ITEM } from "./nav-links"

/** Fixed sidebar: icon rail on tablet (md), full 240px on desktop (lg). Hidden on mobile. */
export function AppSidebar() {
  return (
    <aside
      aria-label="Navegação"
      className="sticky top-0 hidden h-svh w-16 shrink-0 flex-col border-r bg-background md:flex lg:w-60"
    >
      <div className="flex h-16 items-center justify-center px-4 lg:justify-start lg:px-6">
        <Wordmark href="/library" className="text-xl lg:text-2xl" />
      </div>
      <NavLinks compact className="flex-1 gap-1 pt-4" />
      <NavLinks compact items={[SETTINGS_ITEM]} className="pb-6" />
    </aside>
  )
}
