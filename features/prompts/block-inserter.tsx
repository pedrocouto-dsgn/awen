"use client"

import { BlocksIcon, Loader2Icon } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import type { BlockItem } from "./block-dialog"

/** "Inserir bloco": pick a saved block and hand its text to the editor. */
export function BlockInserter({ onInsert }: { onInsert: (block: BlockItem) => void }) {
  const [open, setOpen] = useState(false)
  const [blocks, setBlocks] = useState<BlockItem[] | null>(null)

  // Loaded on first open, then kept (new blocks come back on the next page load).
  useEffect(() => {
    if (!open || blocks) return
    fetch("/api/prompt-blocks")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BlockItem[]) => setBlocks(data))
      .catch(() => setBlocks([]))
  }, [open, blocks])

  const groups = new Map<string, BlockItem[]>()
  for (const b of blocks ?? []) groups.set(b.category ?? "Sem categoria", [...(groups.get(b.category ?? "Sem categoria") ?? []), b])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="xs">
          <BlocksIcon /> Inserir bloco
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Buscar bloco" />
          <CommandList>
            {blocks === null ? (
              <div className="flex justify-center py-4 text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              </div>
            ) : (
              <CommandEmpty>{blocks.length ? "Nenhum bloco encontrado." : "Nenhum bloco salvo ainda."}</CommandEmpty>
            )}
            {[...groups.entries()].map(([category, list]) => (
              <CommandGroup key={category} heading={category}>
                {list.map((b) => (
                  <CommandItem
                    key={b.id}
                    value={`${b.name} ${b.category ?? ""} ${b.body.slice(0, 200)}`}
                    onSelect={() => {
                      onInsert(b)
                      setOpen(false)
                    }}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="text-sm">{b.name}</span>
                    <span className="line-clamp-1 font-mono text-[11px] text-muted-foreground">{b.body}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
