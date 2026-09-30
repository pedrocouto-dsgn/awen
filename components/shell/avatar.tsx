import { cn } from "@/lib/utils"

/** Round profile picture, or the first letter of the name on the steel gradient. */
export function Avatar({ name, url, className }: { name: string; url: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-steel text-sm font-semibold text-foreground ring-1 ring-glass-border",
        className,
      )}
      aria-hidden
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        name.trim().charAt(0).toUpperCase() || "A"
      )}
    </span>
  )
}
