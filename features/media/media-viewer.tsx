"use client"

import { ImageOffIcon } from "lucide-react"

import type { MediaView } from "@/lib/references/view"
import { cn } from "@/lib/utils"

type Props = {
  media: MediaView
  aspectRatio?: number | null
  title?: string | null
  className?: string
  children?: React.ReactNode
}

/** Large media stage: image, HTML5 video, or YouTube/Vimeo embed. The media is the hero. */
export function MediaViewer({ media, aspectRatio, title, className, children }: Props) {
  return (
    <div className={cn("relative flex size-full min-h-0 items-center justify-center bg-media", className)}>
      {media.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned private URL
        <img
          src={media.src}
          alt={title ?? ""}
          className="max-h-full max-w-full object-contain"
          decoding="async"
          draggable={false}
        />
      ) : media.kind === "video" ? (
        <video
          key={media.src}
          src={media.src}
          poster={media.poster ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="max-h-full max-w-full"
        />
      ) : media.kind === "embed" ? (
        <div
          className="w-full max-w-full bg-cover bg-center"
          style={{
            // Poster behind the player while it loads.
            backgroundImage: media.poster ? `url("${media.poster}")` : undefined,
            aspectRatio: aspectRatio ? String(aspectRatio) : "16 / 9",
            maxHeight: "100%",
            maxWidth: aspectRatio && aspectRatio < 1 ? `calc(100% * ${aspectRatio})` : undefined,
          }}
        >
          <iframe
            key={media.embedUrl}
            src={media.embedUrl}
            title={title ?? (media.provider === "youtube" ? "YouTube" : "Vimeo")}
            className="size-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 p-8 text-center text-media-foreground/70">
          <ImageOffIcon className="size-8" aria-hidden />
          <p className="text-sm">Sem mídia capturável para este link.</p>
          {children}
        </div>
      )}
    </div>
  )
}
