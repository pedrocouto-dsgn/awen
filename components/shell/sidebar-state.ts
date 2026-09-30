/** Cookie that remembers whether the desktop sidebar is expanded, so SSR renders the right width. */
export const SIDEBAR_COOKIE = "awen_sidebar"

export function isSidebarExpanded(value: string | undefined): boolean {
  return value === "expanded"
}
