"use client"

import { Loader2Icon, PlusIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type EntityOption = { id: string; name: string }

type Props = {
  label: string
  placeholder: string
  /** Server search (autocomplete). */
  search: (q: string) => Promise<EntityOption[]>
  exclude?: string[]
  onSelect: (option: EntityOption) => void
  onCreate: (name: string) => void
  createLabel: (name: string) => string
}

/** Autocomplete with "create new" for people and projects. */
export function EntityCombobox({ label, placeholder, search, exclude = [], onSelect, onCreate, createLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<EntityOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      search(query)
        .then((res) => !cancelled && setOptions(res))
        .catch(() => !cancelled && setOptions([]))
        .finally(() => !cancelled && setLoading(false))
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, query, search])

  const visible = options.filter((o) => !exclude.includes(o.id))
  const trimmed = query.trim()
  const exact = options.some((o) => o.name.toLowerCase() === trimmed.toLowerCase())

  function close() {
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs">
          <PlusIcon /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {loading ? (
              <div className="flex justify-center py-4 text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              </div>
            ) : null}
            {!loading && visible.length === 0 && !trimmed ? <CommandEmpty>Digite para buscar.</CommandEmpty> : null}
            {visible.length > 0 ? (
              <CommandGroup>
                {visible.map((o) => (
                  <CommandItem
                    key={o.id}
                    value={o.id}
                    onSelect={() => {
                      onSelect(o)
                      close()
                    }}
                  >
                    {o.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {trimmed && !exact ? (
              <CommandGroup>
                <CommandItem
                  value={`__create__${trimmed}`}
                  onSelect={() => {
                    onCreate(trimmed)
                    close()
                  }}
                >
                  <PlusIcon /> {createLabel(trimmed)}
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
