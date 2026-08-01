"use client"

import * as React from "react"
import { format, subDays, startOfYear, endOfYear, endOfMonth } from "date-fns"
import { fr, enUS } from "date-fns/locale"
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useTranslation } from "react-i18next"

interface DateRangePickerProps {
  className?: string
  date: DateRange | undefined
  setDate: (date: DateRange | undefined) => void
}

export function DateRangePicker({
  className,
  date,
  setDate,
}: DateRangePickerProps) {
  const { t, i18n } = useTranslation();

  const currentYear = new Date().getFullYear();
  const presets = [
    { label: t('dates.any_time') || "Toute période", value: undefined },
    { label: t('dates.last_year') || "Dernière année", value: { from: subDays(new Date(), 365), to: new Date() } },
    { label: `${currentYear}`, value: { from: startOfYear(new Date(currentYear, 0, 1)), to: endOfYear(new Date(currentYear, 11, 31)) } },
    { label: "2020s", value: { from: startOfYear(new Date(2020, 0, 1)), to: endOfYear(new Date(2029, 11, 31)) } },
    { label: "2010s", value: { from: startOfYear(new Date(2010, 0, 1)), to: endOfYear(new Date(2019, 11, 31)) } },
    { label: "2000s", value: { from: startOfYear(new Date(2000, 0, 1)), to: endOfYear(new Date(2009, 11, 31)) } },
    { label: "Gold Age (1938-1956)", value: { from: new Date(1938, 5, 1), to: new Date(1956, 11, 31) } },
  ];

  const [fromMonth, setFromMonth] = React.useState<Date | undefined>(date?.from);
  const [toMonth, setToMonth] = React.useState<Date | undefined>(date?.to || date?.from);

  React.useEffect(() => {
    if (date?.from) {
      setFromMonth(date.from);
    } else {
      setFromMonth(undefined);
    }
    if (date?.to) {
      setToMonth(date.to);
    } else if (date?.from) {
      setToMonth(date.from);
    } else {
      setToMonth(undefined);
    }
  }, [date?.from, date?.to]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full h-10 justify-start text-left font-normal rounded-xl border border-border-subtle bg-surface text-text-body hover:bg-surface-2 shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span className="text-zinc-400 truncate">{t('search.all_periods')}</span>
            )}
            {date?.from ? (
              <span
                role="button"
                tabIndex={0}
                className="ml-auto mr-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 hover:bg-surface-2 rounded-md transition-colors shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setDate(undefined);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            ) : (
              <ChevronDown className="ml-auto h-4 w-4 opacity-50 flex-shrink-0" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[calc(100vw-2rem)] max-w-[800px] sm:w-auto p-0 rounded-2xl shadow-2xl border border-border-subtle bg-surface" align="start">
          <div className="flex flex-col md:flex-row">
            <div className="p-4 border-b md:border-b-0 md:border-r border-border-subtle min-w-[160px] bg-surface-2/90">
              <h4 className="text-xs font-bold text-text-hint uppercase tracking-widest mb-4 px-2">Presets</h4>
              <div className="space-y-1">
                {presets.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    className="justify-start font-medium text-xs h-8 rounded-lg hover:bg-surface hover:shadow-sm transition-all w-full"
                    onClick={() => {
                      setDate(preset.value)
                      if (preset.value?.from) setFromMonth(preset.value.from);
                      if (preset.value?.to) setToMonth(preset.value.to);
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x border-border-subtle bg-surface">
              <div className="p-4 w-full sm:min-w-[280px]">
                <div className="text-sm font-semibold mb-3 text-foreground">{t('search.from_date') || "Start"}</div>
                <Calendar
                  mode="single"
                  month={fromMonth}
                  onMonthChange={(newMonth) => {
                    setFromMonth(newMonth);
                    setDate({ ...date, from: newMonth });
                  }}
                  selected={date?.from}
                  onSelect={(d) => {
                    setFromMonth(d);
                    setDate({ ...date, from: d });
                  }}
                  locale={i18n.language === 'fr' ? fr : enUS}
                  captionLayout="dropdown-buttons"
                  fromYear={1930}
                  toYear={currentYear + 2}
                />
              </div>
              <div className="p-4 w-full sm:min-w-[280px]">
                <div className="text-sm font-semibold mb-3 text-foreground">{t('search.to_date') || "End"}</div>
                <Calendar
                  mode="single"
                  month={toMonth || fromMonth}
                  onMonthChange={(newMonth) => {
                    setToMonth(newMonth);
                    setDate({ ...date, from: date?.from, to: endOfMonth(newMonth) });
                  }}
                  selected={date?.to}
                  onSelect={(d) => {
                    setToMonth(d);
                    setDate({ ...date, from: date?.from, to: d });
                  }}
                  locale={i18n.language === 'fr' ? fr : enUS}
                  captionLayout="dropdown-buttons"
                  fromYear={1930}
                  toYear={currentYear + 2}
                />
              </div>
            </div>
          </div>
          {date?.from && (
            <div className="p-2 border-t border-border-subtle flex justify-end items-center bg-surface-2/40">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-destructive hover:bg-destructive/10 hover:text-destructive font-semibold px-3 rounded-lg"
                onClick={() => setDate(undefined)}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                {t('dates.clear_period')}
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
