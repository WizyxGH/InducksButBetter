import * as React from "react"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface FilterChipProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode
  avatarUrl?: string | null
  onRemove?: (e: React.MouseEvent) => void
  disabled?: boolean
}

export const FilterChip = React.forwardRef<HTMLDivElement, FilterChipProps>(
  ({ label, avatarUrl, onRemove, disabled, className, ...props }, ref) => {
    return (
      <Badge
        ref={ref}
        variant="secondary"
        className={cn(
          "bg-surface-2 text-text-body shadow-sm border border-border-subtle hover:border-border transition-all text-[11px] font-semibold tracking-tight rounded-full px-2 py-0.5 flex items-center gap-1.5 group shrink-0",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        {...props}
      >
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt=""
            className="w-3.5 h-3.5 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800 shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        )}
        <span>{label}</span>
        {onRemove && (
          <span
            role="button"
            tabIndex={0}
            className="cursor-pointer text-text-secondary hover:text-destructive transition-colors p-0.5 -mr-1 rounded-full hover:bg-destructive/10"
            onMouseDown={(e) => {
              if (!disabled) {
                e.preventDefault()
                e.stopPropagation()
                onRemove(e)
              }
            }}
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </Badge>
    )
  }
)
FilterChip.displayName = "FilterChip"
