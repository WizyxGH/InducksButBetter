import * as React from "react"
import { cn } from "@/lib/utils"
import { Maximize2, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ThumbUrls } from "./thumbUrl"

interface ResultCardThumbProps {
  thumb: ThumbUrls | null
  /** Row identity; changing it resets the load/error state for the new image. */
  resetKey: string
  /** Placeholder text when there is no image ("No Image" / "No Cover"). */
  emptyLabel: string
  /** Container classes; must include `relative` and the `group/thumb` scope. */
  className: string
  /** Image classes (object fit, hover scale) shared with the container hover. */
  imgClassName: string
}

/**
 * Thumbnail block of the story and issue result cards: shimmer while loading,
 * proxied preview, placeholder on error, and a zoom button that opens the
 * full-size scan without triggering the surrounding card click.
 */
export function ResultCardThumb({ thumb, resetKey, emptyLabel, className, imgClassName }: ResultCardThumbProps) {
  const [imageError, setImageError] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [resetKey]);

  return (
    <div className={className}>
      {/* Shimmer skeleton while image loads */}
      {thumb && !imageError && !imageLoaded && (
        <div className="absolute inset-1 rounded animate-shimmer" />
      )}
      <img
        src={thumb && !imageError ? thumb.preview : ""}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn(
          imgClassName,
          (!thumb || imageError) && "hidden",
          imageLoaded ? "opacity-90" : "opacity-0"
        )}
        onError={() => setImageError(true)}
        onLoad={() => setImageLoaded(true)}
      />
      {(!thumb || imageError) && (
        <div className="flex flex-col items-center gap-2 text-zinc-300">
          <BookOpen className="w-8 h-8 opacity-20" />
          <span className="text-[10px] font-bold uppercase tracking-tighter opacity-30">{emptyLabel}</span>
        </div>
      )}

      {thumb && !imageError && imageLoaded && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7 rounded-full opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-zinc-700 shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            window.open(thumb.full, "_blank");
          }}
        >
          <Maximize2 className="w-3.5 h-3.5 text-zinc-600" />
        </Button>
      )}
    </div>
  )
}
