"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, DropdownProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2 sm:p-3", className)}
      classNames={{
        months: "flex flex-col lg:flex-row gap-3 lg:gap-4 relative w-full",
        month: "space-y-3 w-full",
        caption_label: "flex justify-center pt-1 relative items-center gap-1 text-xs sm:text-sm font-medium flex-1",
        caption_dropdowns: "flex justify-center items-center gap-1 h-7",
        dropdown: "flex-1 peer min-w-[70px]",
        nav: "hidden",
        nav_button_previous: "hidden",
        nav_button_next: "hidden",
        table: "w-full border-collapse space-y-1",
        head_row: "flex gap-1 w-full",
        head_cell:
          "text-muted-foreground rounded-md w-8 sm:w-9 font-normal text-[0.75rem] sm:text-[0.8rem]",
        row: "flex w-full mt-1 sm:mt-2",
        day: "h-8 w-8 sm:h-9 sm:w-9 text-center text-xs sm:text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 sm:h-9 sm:w-9 p-0 font-normal text-xs sm:text-sm aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-bold",
        day_today: "bg-surface-3 text-text-body font-bold",
        day_outside:
          "day-outside text-text-hint opacity-50 aria-selected:bg-surface-3 aria-selected:text-text-hint aria-selected:opacity-30",
        day_disabled: "text-text-hint opacity-50",
        day_range_middle:
          "aria-selected:bg-surface-2 aria-selected:text-text-body",
        day_hidden: "invisible",
        vhidden: "sr-only",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
        Dropdown: ({ value, onChange, children, ...props }: DropdownProps) => {
          const options = React.Children.toArray(children) as React.ReactElement<React.HTMLProps<HTMLOptionElement>>[]
          const selected = options.find((child) => child.props.value === value)
          const handleChange = (val: string) => {
            const changeEvent = {
              target: { value: val },
            } as React.ChangeEvent<HTMLSelectElement>
            onChange?.(changeEvent)
          }
          return (
            <Select
              value={value?.toString()}
              onValueChange={(val) => {
                handleChange(val)
              }}
            >
              <SelectTrigger className="p-0 focus:ring-0 border-0 bg-transparent h-7 text-xs font-bold hover:bg-accent hover:text-accent-foreground transition-colors min-w-0">
                <SelectValue>{selected?.props?.children}</SelectValue>
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[300px] bg-surface border-border-subtle shadow-xl rounded-xl z-[200]">
                {options.map((option, id: number) => (
                  <SelectItem key={`${option.props.value}-${id}`} value={option.props.value?.toString() ?? ""} disabled={option.props.disabled} className="cursor-pointer focus:bg-surface-2 rounded-lg">
                    {option.props.children}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
