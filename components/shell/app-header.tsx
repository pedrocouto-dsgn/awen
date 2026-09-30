import { Wordmark } from "@/components/brand/wordmark"

import { MobileNav } from "./mobile-nav"
import { UserMenu } from "./user-menu"

/** Top bar (64px). Navigation lives in the sidebar; the bar holds page-level actions. */
export function AppHeader({ email, actions }: { email: string | null; actions?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-16 items-center gap-2 px-4 md:px-6">
        <MobileNav />
        <Wordmark href="/library" className="text-xl md:hidden" />
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <UserMenu email={email} />
        </div>
      </div>
    </header>
  )
}
