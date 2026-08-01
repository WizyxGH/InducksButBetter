import * as React from "react"
import { Search, Loader2, User, Cat, BookOpen, LibraryBig, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { routes } from "@/lib/routes"
import { unifiedAutocomplete, UnifiedSearchResult } from "@/lib/turso"
import { handleDbError } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { MicButton } from "@/components/MicButton"
import { useSpeechToText } from "@/hooks/useSpeechToText"
import { navigate } from "@/lib/navigation";
import { Link } from "@/components/ui/link";

export function UnifiedSearchBar() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [items, setItems] = React.useState<UnifiedSearchResult[]>([])
  const [loading, setLoading] = React.useState(false)
  const { isRecording, transcript, toggleRecording } = useSpeechToText()
  
  // Custom Modal State
  const [modalOpen, setModalOpen] = React.useState(false)
  const [modalContent, setModalContent] = React.useState({ title: "", desc: "" })

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setItems([])
      setLoading(false)
      return
    }

    let isActive = true
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const lang = i18n.language === "en" ? "en" : "fr"
        const combined = await unifiedAutocomplete(query, lang)

        if (isActive) {
          setItems(combined)
        }
      } catch (err) {
        handleDbError(err, t("common.autocomplete_error", "Erreur lors de l'autocomplétion."))
      } finally {
        if (isActive) setLoading(false)
      }
    }, 300)

    return () => {
      isActive = false
      clearTimeout(timer)
    }
  }, [query, i18n.language, t])

  const handleClear = () => {
    setQuery("")
    setItems([])
    setOpen(false)
  }
  
  React.useEffect(() => {
    if (transcript && isRecording) {
      setQuery(transcript)
      if (transcript.trim().length >= 2) {
        setOpen(true)
      }
    }
  }, [transcript, isRecording])

  const getHashForItem = (item: UnifiedSearchResult) => {
    const { id, type } = item
    switch (type) {
      case "author": return routes.author(id)
      case "character": return routes.character(id)
      case "publication": return routes.publication(id)
      case "issue": return routes.issue(id)
      case "story": return routes.story(id)
      default: return "#"
    }
  }

  const handleSelect = (item: UnifiedSearchResult) => {
    navigate(getHashForItem(item))
    setOpen(false)
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "author":
        return <User className="w-4 h-4 text-muted-foreground" />
      case "character":
        return <Cat className="w-4 h-4 text-muted-foreground" />
      case "publication":
        return <BookOpen className="w-4 h-4 text-muted-foreground" />
      case "issue":
        return <LibraryBig className="w-4 h-4 text-muted-foreground" />
      case "story":
        return <BookOpen className="w-4 h-4 text-muted-foreground" />
      default:
        return <Search className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case "author":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
      case "character":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      case "publication":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
      case "issue":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
      case "story":
        return "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20"
      default:
        return "bg-zinc-500/10 text-zinc-600 border-zinc-500/20"
    }
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto z-50">
      <Popover open={open && (items.length > 0 || loading)} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex items-center w-full shadow-md rounded-2xl">
            <Search className="absolute left-4 h-5 w-5 text-muted-foreground opacity-70" />
            <Input
              placeholder={t("home.search_placeholder", "Rechercher...")}
              value={query}
              onChange={(e) => {
                const val = e.target.value
                setQuery(val)
                if (val.trim().length >= 2) setOpen(true)
                else setOpen(false)
              }}
              onFocus={() => {
                if (query.trim().length >= 2) setOpen(true)
              }}
              className={cn(
                "w-full h-12 pl-12 pr-24 text-base rounded-2xl border border-border-subtle bg-surface text-text-body",
                "focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary transition-all duration-200 placeholder:text-text-hint/80"
              )}
            />
            <div className="absolute right-2 flex items-center gap-1.5">
              {query && (
                <button
                  type="button"
                  className="text-text-secondary hover:text-text-body transition-colors p-1 rounded-full hover:bg-muted"
                  onClick={handleClear}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              <div className="scale-75 origin-right">
                <MicButton 
                  isRecording={isRecording} 
                  onClick={() => {
                    toggleRecording();
                  }} 
                  title={t("home.voice_search", "Recherche vocale")} 
                />
              </div>
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)] z-50 max-h-[380px] overflow-hidden rounded-2xl shadow-xl border border-border-subtle bg-surface"
          onOpenAutoFocus={(e) => e.preventDefault()}
          side="bottom"
          align="start"
          sideOffset={8}
        >
          <Command shouldFilter={false}>
            <CommandList className="max-h-[380px] overflow-y-auto">
              <CommandGroup className="p-2">
                {items.map((item) => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    value={`${item.type}-${item.id}`}
                    onSelect={() => handleSelect(item)}
                    className={cn(
                      "p-0 rounded-xl cursor-pointer transition-colors duration-150",
                      "hover:bg-primary/5 active:bg-primary/10 focus:bg-primary/5 aria-selected:bg-primary/5 select-none"
                    )}
                  >
                    <Link to={getHashForItem(item)}
                      onClick={(e) => {
                        if (!e.ctrlKey && !e.metaKey && e.button !== 1) {
                          e.preventDefault();
                          handleSelect(item);
                        }
                      }}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 w-full h-full"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          {getIcon(item.type)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-sm font-medium text-text-body">
                            {item.name}
                          </span>
                          {item.subtitle && (
                            <span className="text-[11px] text-text-secondary truncate italic">
                              {item.subtitle}
                            </span>
                          )}
                          <span className="text-[10px] text-text-hint font-mono uppercase tracking-wider truncate">
                            {item.id}
                          </span>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0",
                        getBadgeStyle(item.type)
                      )}>
                        {t(`home.type_${item.type}`, item.type)}
                      </span>
                    </Link>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{modalContent.title}</DialogTitle>
            <DialogDescription className="pt-2 text-base leading-relaxed">
              {modalContent.desc}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  )
}
