import { cn, getFlagUrl } from "@/lib/utils"

interface FlagBadgeProps {
  country: string
  name: string
  className?: string
}

export function FlagBadge({ country, name, className }: FlagBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-1 py-0.5 text-[10px] font-medium text-text-secondary",
        className
      )}
    >
      <img
        src={getFlagUrl(country)}
        className="w-3.5 h-2.5 rounded-sm object-cover transition-transform hover:scale-110"
        alt={country}
        loading="lazy"
        decoding="async"
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
      <span className="truncate max-w-[100px]">{name}</span>
    </div>
  )
}
