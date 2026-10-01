/** Glass section used by the settings tabs. */
export function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="glass flex flex-col gap-5 rounded-2xl p-6">
      <header className="flex flex-col gap-1">
        <h2 className="type-title-sm text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </section>
  )
}
