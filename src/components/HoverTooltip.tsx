import React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipArrow,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HoverTooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  delayDuration?: number;
}

export function HoverTooltip({
  children,
  content,
  className,
  delayDuration = 200,
}: HoverTooltipProps) {
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>
        {children}
      </TooltipTrigger>
      <TooltipContent
        className={cn(
          "max-w-[320px] max-h-[300px] overflow-y-auto p-3 text-xs leading-relaxed bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl",
          className
        )}
      >
        {content}
        <TooltipArrow className="fill-white dark:fill-zinc-950" />
      </TooltipContent>
    </Tooltip>
  );
}
