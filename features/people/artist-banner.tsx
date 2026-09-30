"use client"

import { CameraIcon, Loader2Icon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { downscaleImage } from "@/lib/media/client-image"

type Props = {
  person: { id: string; name: string }
  photoUrl: string | null
  /** e.g. "12 referências na biblioteca · Direção, Fotografia" */
  subtitle: string
}

/** Artist page header: the artist's photo as a wide banner, name over a scrim, photo controls. */
export function ArtistBanner({ person, photoUrl, subtitle }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null)

  async function upload(file: File) {
    setBusy("upload")
    try {
      // Shrink in the browser first: phone photos easily pass the 10 MB request limit.
      const body = new FormData()
      const photo = await downscaleImage(file, 2400)
      body.set("file", photo, photo.type === "image/webp" ? "photo.webp" : "photo.jpg")
      const res = await fetch(`/api/people/${person.id}/photo`, { method: "POST", body })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar a foto.")
      toast.success("Foto do artista atualizada.")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a foto.")
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy("remove")
    try {
      const res = await fetch(`/api/people/${person.id}/photo`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("Foto removida.")
      router.refresh()
    } catch {
      toast.error("Não foi possível remover a foto.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <header className="relative isolate flex h-72 flex-col justify-between overflow-hidden rounded-2xl bg-media md:h-96">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
        <img src={photoUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 -z-10 bg-gradient-dusk" aria-hidden>
          <div className="absolute inset-0 bg-gradient-glow" />
          <span className="absolute top-1/2 right-10 -translate-y-1/2 text-[10rem] leading-none font-medium text-foreground/10 select-none md:text-[14rem]">
            {person.name.trim().charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-scrim" aria-hidden />

      <div className="flex items-start justify-between gap-2 p-4">
        <div className="ml-auto flex gap-2">
          {photoUrl ? (
            <Button variant="ghost" size="sm" className="glass-strong" onClick={() => void remove()} disabled={busy !== null}>
              {busy === "remove" ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
              <span className="hidden sm:inline">Remover</span>
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" className="glass-strong" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
            {busy === "upload" ? <Loader2Icon className="animate-spin" /> : <CameraIcon />}
            {photoUrl ? "Trocar foto" : "Adicionar foto"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(file)
              e.target.value = ""
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 p-6 text-scrim-foreground md:p-8">
        <p className="type-label opacity-80">Artista</p>
        <h1 className="type-display-lg break-words md:text-5xl">{person.name}</h1>
        <p className="text-sm opacity-80">{subtitle}</p>
      </div>
    </header>
  )
}
