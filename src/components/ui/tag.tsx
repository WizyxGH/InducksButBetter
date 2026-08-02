import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const tagVariants = cva(
  "inline-flex items-center gap-1.5 font-medium transition-colors focus:outline-none",
  {
    variants: {
      color: {
        blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/10 dark:border-blue-500/20",
        emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 dark:border-emerald-500/20",
        purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/10 dark:border-purple-500/20",
        amber: "bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/10 dark:border-amber-500/20",
        rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/10 dark:border-rose-500/20",
        indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 dark:border-indigo-500/20",
        zinc: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/10 dark:border-zinc-500/20",
        surface: "bg-surface border border-border-subtle text-foreground",
        primary: "bg-primary text-primary-foreground border-transparent",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[9px] rounded-full",
        md: "px-2 py-0.5 text-[10px] rounded-full",
        lg: "px-2.5 py-1 text-xs rounded-full",
      }
    },
    defaultVariants: {
      color: "zinc",
      size: "md",
    },
  }
)

export interface TagProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>,
    VariantProps<typeof tagVariants> {
  icon?: React.ReactNode;
}

export const Tag = React.memo(function Tag({ className, color, size, icon, children, ...props }: TagProps) {
  return (
    <span className={cn(tagVariants({ color, size }), className)} {...props}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  )
})
