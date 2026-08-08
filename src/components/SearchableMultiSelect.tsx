import * as React from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { FilterChip } from "@/components/FilterChip"
import { cn } from "@/lib/utils"
import { Tag } from "@/components/ui/tag"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

export interface MultiSelectOption {
  value: string
  label: string
  description?: string
  icon?: React.ReactNode
  group?: string
  /**
   * Extra hidden strings the search matches against. Lets an option be found
   * under names that are not displayed — e.g. a subseries typed in French
   * ("Mickey à travers les siècles") while the UI shows its English name.
   */
  aliases?: string[]
}

interface SearchableMultiSelectProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  maxDisplay?: number
  showClear?: boolean
}

export function SearchableMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Sélectionner...",
  searchPlaceholder = "Rechercher...",
  emptyMessage = "Aucun résultat",
  maxDisplay = 2,
  showClear = true,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  // Accent-insensitive ("a travers" finds "à travers") and alias-aware, so an
  // option is found under any of its language variants, not only its label.
  const normalize = (value: string) =>
    value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const needle = normalize(search);
    return options.filter(opt =>
      normalize(opt.label).includes(needle) ||
      (opt.group && normalize(opt.group).includes(needle)) ||
      opt.aliases?.some(alias => normalize(alias).includes(needle))
    );
  }, [options, search]);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const remove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selected.filter((v) => v !== value))
  }

  const selectedLabels = selected.map(
    (v) => options.find((o) => o.value === v)?.label ?? v
  )

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange([])
  }

  return (
    <Popover open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) setSearch("");
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-auto min-h-10 px-3 py-1.5 rounded-xl bg-surface border border-border-subtle shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/20 transition-all hover:bg-surface-2"
        >
          <div className="flex flex-wrap gap-1.5 flex-1 text-left">
            {selected.length === 0 ? (
              <span className="text-text-secondary text-sm">{placeholder}</span>
            ) : selected.length <= maxDisplay ? (
              selectedLabels.map((label, i) => (
                <Tag
                  key={selected[i]}
                  color="surface"
                  className="pr-1 font-medium bg-surface-2 border-border-subtle text-xs"
                >
                  <span className="leading-none">{label}</span>
                  <span
                    className="cursor-pointer text-text-secondary hover:text-destructive transition-colors ml-1 p-0.5"
                    onMouseDown={(e) => remove(selected[i], e)}
                  >
                    <X className="w-3 h-3" />
                  </span>
                </Tag>
              ))
            ) : (
              <>
                {selectedLabels.slice(0, maxDisplay).map((label, i) => (
                  <FilterChip
                    key={selected[i]}
                    label={label}
                    onRemove={(e) => remove(selected[i], e)}
                  />
                ))}
                <Tag color="surface" className="font-medium bg-surface-2 border-dashed border-border-subtle text-text-secondary h-6 px-2 text-xs">
                  +{selected.length - maxDisplay}
                </Tag>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {selected.length > 0 && showClear && (
               <span 
                 className="text-text-secondary hover:text-text-body transition-colors p-1 hover:bg-surface-2 rounded-md"
                 onMouseDown={clearAll}
               >
                 <X className="h-4 w-4" />
               </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {(() => {
              const groups: Record<string, MultiSelectOption[]> = {};
              const noGroup: MultiSelectOption[] = [];
              
              filteredOptions.forEach(opt => {
                if (opt.group) {
                  if (!groups[opt.group]) groups[opt.group] = [];
                  groups[opt.group].push(opt);
                } else {
                  noGroup.push(opt);
                }
              });

              return (
                <>
                  {Object.entries(groups).map(([groupName, groupOptions]) => (
                    <CommandGroup key={groupName} heading={groupName}>
                      {groupOptions.map((option, idx) => (
                        <CommandItem
                          key={`${option.value}-${idx}`}
                          value={option.label}
                          onSelect={() => toggle(option.value)}
                          disabled={false}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              selected.includes(option.value) ? "opacity-100 text-primary" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col items-start overflow-hidden">
                            <div className="flex items-center gap-2">
                              {option.icon && <span className="shrink-0">{option.icon}</span>}
                              <span className="truncate">{option.label}</span>
                            </div>
                            {option.description && (
                              <span className="text-[10px] text-text-secondary line-clamp-1 mt-0.5">
                                {option.description}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                  {noGroup.length > 0 && (
                    <CommandGroup>
                      {noGroup.map((option, idx) => (
                        <CommandItem
                          key={`${option.value}-${idx}`}
                          value={option.label}
                          onSelect={() => toggle(option.value)}
                          disabled={false}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              selected.includes(option.value) ? "opacity-100 text-primary" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col items-start overflow-hidden">
                            <div className="flex items-center gap-2">
                              {option.icon && <span className="shrink-0">{option.icon}</span>}
                              <span className="truncate">{option.label}</span>
                            </div>
                            {option.description && (
                              <span className="text-[10px] text-text-secondary line-clamp-1 mt-0.5">
                                {option.description}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              );
            })()}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

