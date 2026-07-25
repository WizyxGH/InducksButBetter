import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { parseISO, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Autocomplete } from "@/components/Autocomplete";
import { MultiAutocomplete } from "@/components/MultiAutocomplete";
import { SearchableMultiSelect } from "@/components/SearchableMultiSelect";
import { DateRangePicker } from "@/components/DateRangePicker";
import { AvatarWithFallback } from "@/components/AvatarWithFallback";
import { SearchFilters } from "@/lib/searchService";
import { MetaData, COUNTRY_CONTINENTS } from "@/lib/types";
import { AUTHOR_NATIONALITIES, KIND_LABELS } from "@/lib/constants";
import { autocompleteStorycode, autocompletePublisher, autocompletePerson, autocompleteCharacter } from "@/lib/turso";
import { getFlagUrl } from "@/lib/utils";
import { useSearchDisabled } from "@/hooks/useSearchDisabled";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Numeric options shared by both strips-per-page and panels-per-strip selects. */
const LAYOUT_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Display filter options for the "Affichage" (image presence) select. */
const IMAGE_OPTIONS = [
  { value: "all", labelKey: "search.all_stories" },
  { value: "yes", labelKey: "search.with_image_only" },
  { value: "no", labelKey: "search.without_image" },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

type CharacterKey = "charactercode" | "herocode" | "excludeCharactercode";

interface SearchFormProps {
  filters: SearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  pagesSliderMoved: boolean;
  setPagesSliderMoved: React.Dispatch<React.SetStateAction<boolean>>;
  selectedLabels: Record<string, string>;
  setSelectedLabels: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  cookieValue: string;
  setCookieValue: (value: string) => void;
  isSavingCookie: boolean;
  saveCookie: () => Promise<void>;
  addSelection: (key: CharacterKey, value: string, label: string) => void;
  removeSelection: (key: CharacterKey, value: string) => void;
  handleClearFilters: () => void;
  handleSearch: (e?: React.FormEvent | null, overrideFilters?: SearchFilters) => Promise<void>;
  loading: boolean;
  meta: MetaData;
  setResults: React.Dispatch<React.SetStateAction<any[]>>;
  setTotalCount: React.Dispatch<React.SetStateAction<number>>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchForm({
  filters,
  setFilters,
  pagesSliderMoved,
  setPagesSliderMoved,
  selectedLabels,
  setSelectedLabels,
  isSettingsOpen,
  setIsSettingsOpen,
  cookieValue,
  setCookieValue,
  isSavingCookie,
  saveCookie,
  addSelection,
  removeSelection,
  handleClearFilters,
  handleSearch,
  loading,
  meta,
  setResults,
  setTotalCount,
}: SearchFormProps) {
  const { t, i18n } = useTranslation();
  const isSearchDisabled = useSearchDisabled();

  // ── Stable filter updater (functional form avoids stale closure issues) ────

  /**
   * Merges a partial update into the current filters without capturing a
   * stale `filters` snapshot in a closure.
   */
  const updateFilters = useCallback(
    (patch: Partial<SearchFilters>) => setFilters((prev) => ({ ...prev, ...patch })),
    [setFilters]
  );

  // ── Memoised option arrays (prevent recomputation on every render) ─────────

  /** Options for the content-type (kind) multi-select. */
  const kindOptions = useMemo(
    () => Object.entries(KIND_LABELS).map(([code, fallbackLabel]) => ({ value: code, label: t(`kinds.${code}`, { defaultValue: fallbackLabel as string }) as string })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language]
  );

  /** Options for the publication country multi-select, grouped by continent. */
  const countryOptions = useMemo(
    () =>
      meta.countries.map((c: any) => ({
        value: c.countrycode,
        label:
          t(`nationalities.${c.countrycode.toLowerCase()}`) !==
            `nationalities.${c.countrycode.toLowerCase()}`
            ? t(`nationalities.${c.countrycode.toLowerCase()}`)
            : c.countryname,
        group: t(`continents.${COUNTRY_CONTINENTS[c.countrycode.toLowerCase()] || "other"}`),
        icon: <img src={getFlagUrl(c.countrycode)} className="w-4 h-3 rounded-xs" alt="" />,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta.countries, i18n.language] // re-derive when language changes (translated labels)
  );

  /** Options for the publication language multi-select. */
  const languageOptions = useMemo(
    () => meta.languages.map((l: any) => ({ value: l.languagecode, label: t(`languages.${l.languagecode}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta.languages, i18n.language]
  );

  /** Options for the author nationality multi-select, grouped by continent. */
  const nationalityOptions = useMemo(
    () =>
      AUTHOR_NATIONALITIES.filter((n) => n.code !== "any").map((n) => ({
        value: n.code,
        label: t(`nationalities.${n.code}`),
        group: t(`continents.${COUNTRY_CONTINENTS[n.code] || "other"}`),
        icon: (
          <img
            src={getFlagUrl(n.code)}
            className="w-4 h-3 rounded-xs object-cover"
            alt=""
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language]
  );

  /** Options for the universe multi-select. */
  const universeOptions = useMemo(
    () => meta.universes.map((u) => ({ value: u.universecode, label: u.universename })),
    [meta.universes]
  );

  // ── Stable collection-checkbox handler ────────────────────────────────────

  const handleCollectionChange = useCallback(
    (checked: boolean | "indeterminate") => {
      const isChecked = checked === true;
      updateFilters({ onlyCollection: isChecked });
      if (isChecked) {
        try {
          const saved = localStorage.getItem("inducks_collection_issues");
          const parsed = saved ? JSON.parse(saved) : [];
          if (!Array.isArray(parsed) || parsed.length === 0) {
            toast.error(t("collection.alert_unavailable"));
          }
        } catch {
          toast.error(t("collection.alert_unavailable"));
        }
      }
    },
    [updateFilters, t]
  );

  // ── Stable person-role handlers ────────────────────────────────────────────

  const handleRoleCodeChange = useCallback(
    (idx: number, val: string, label?: string) => {
      setFilters((prev) => {
        const roles = [...(prev.personRoles ?? [])];
        roles[idx] = { ...roles[idx], code: val };
        return { ...prev, personRoles: roles };
      });
      if (label) setSelectedLabels((prev) => ({ ...prev, [val]: label }));
    },
    [setFilters, setSelectedLabels]
  );

  const handleRoleClear = useCallback(
    (idx: number) => handleRoleCodeChange(idx, ""),
    [handleRoleCodeChange]
  );

  const handleRoleTypeChange = useCallback(
    (idx: number, val: string) => {
      setFilters((prev) => {
        const roles = [...(prev.personRoles ?? [])];
        roles[idx] = { ...roles[idx], role: val };
        return { ...prev, personRoles: roles };
      });
    },
    [setFilters]
  );

  const handleRemoveRole = useCallback(
    (idx: number) => {
      setFilters((prev) => ({
        ...prev,
        personRoles: (prev.personRoles ?? []).filter((_, i) => i !== idx),
      }));
    },
    [setFilters]
  );

  const handleAddRole = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      personRoles: [
        ...(prev.personRoles ?? []),
        { id: Date.now().toString(), code: "", role: "any" },
      ],
    }));
  }, [setFilters]);

  // ── Reset handler ─────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    handleClearFilters();
    setResults([]);
    setTotalCount(0);
  }, [handleClearFilters, setResults, setTotalCount]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-none lg:flex-1 flex flex-col border-border-subtle/60 dark:border-border-subtle/60 shadow-2xl shadow-blue-900/5 rounded-3xl lg:overflow-hidden overflow-visible bg-surface">
      <div className="px-8 py-5 border-b border-border-subtle bg-surface flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-3">
          {t("search.title")}
        </h2>
      </div>

      <ScrollArea className="flex-1 mobile-no-scroll">
        <div className="p-4 sm:p-8">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-4 md:gap-y-7">

            {/* ── Inducks code & Keywords ───────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.inducks_code")}</Label>
              <Autocomplete
                value={filters.storycode}
                placeholder={t("search.inducks_code_placeholder")}
                emptyMessage={t("common.no_data")}
                fetchOptions={(q) => autocompleteStorycode(q, i18n.language)}
                onSelect={(val) => updateFilters({ storycode: val })}
                onInputChange={(val) => updateFilters({ storycode: val })}
                onClear={() => updateFilters({ storycode: "" })}
                type="stories"
                hideSearchIcon={true}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.keywords")}</Label>
              <Input
                variant="search"
                placeholder={t("search.keywords_placeholder")}
                value={filters.title}
                onChange={(e) => updateFilters({ title: e.target.value })}
              />
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-2 transition-opacity hover:opacity-100 opacity-80">
                  <Checkbox
                    id="comments"
                    checked={filters.includeComments === true}
                    onCheckedChange={(checked) => updateFilters({ includeComments: checked === true })}
                  />
                  <label htmlFor="comments" className="text-xs text-text-secondary cursor-pointer leading-snug">
                    {t("search.include_comments")}
                  </label>
                </div>
                <div className="flex items-center gap-2 transition-opacity hover:opacity-100 opacity-80">
                  <Checkbox
                    id="multiple-parts"
                    checked={filters.multipleParts === true}
                    onCheckedChange={(checked) => updateFilters({ multipleParts: checked === true })}
                  />
                  <label htmlFor="multiple-parts" className="text-xs text-text-secondary cursor-pointer leading-snug">
                    {t("search.multiple_parts")}
                  </label>
                </div>
              </div>
            </div>

            {/* ── Content type & Image presence ─────────────────────────────── */}
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.content_type")}</Label>
                <SearchableMultiSelect
                  options={kindOptions}
                  selected={(filters.kind || []) as string[]}
                  onChange={(val) => updateFilters({ kind: val })}
                  placeholder={t("search.all_types")}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.display")}</Label>
                <Select
                  value={filters.hasImage || "all"}
                  onValueChange={(val) => updateFilters({ hasImage: val as any })}
                >
                  <SelectTrigger className="h-10 border-border-subtle rounded-xl bg-surface shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all hover:bg-surface-2">
                    <SelectValue placeholder={t("search.all_stories")} />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Date range ────────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.publication_period")}</Label>
              <DateRangePicker
                date={{
                  from: filters.dateAfter ? parseISO(filters.dateAfter) : undefined,
                  to: filters.dateBefore ? parseISO(filters.dateBefore) : undefined,
                }}
                setDate={(range) =>
                  updateFilters({
                    dateAfter: range?.from ? format(range.from, "yyyy-MM-dd") : "",
                    dateBefore: range?.to ? format(range.to, "yyyy-MM-dd") : "",
                  })
                }
              />
            </div>

            {/* ── Publisher & Country ───────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.publisher")}</Label>
              <Autocomplete
                value={filters.publisherid}
                placeholder={t("search.publisher_placeholder")}
                emptyMessage={t("common.no_data")}
                fetchOptions={autocompletePublisher}
                onSelect={(val) => updateFilters({ publisherid: val })}
                onInputChange={(val) => updateFilters({ publisherid: val })}
                onClear={() => updateFilters({ publisherid: "" })}
                type="publishers"
                hideIcon={true}
                hideSearchIcon={true}
              />
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="collection"
                  checked={filters.onlyCollection === true}
                  onCheckedChange={handleCollectionChange}
                />
                <label htmlFor="collection" className="text-[12px] text-text-secondary cursor-pointer flex-1">
                  {t("search.only_collection")}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.publication_country")}</Label>
              <SearchableMultiSelect
                options={countryOptions}
                selected={(filters.country || []) as string[]}
                onChange={(vals) => updateFilters({ country: vals })}
                placeholder={t("search.any_country")}
                searchPlaceholder={t("search.search_country")}
                emptyMessage={t("common.no_data")}
              />
            </div>

            {/* ── Language ──────────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.publication_language")}</Label>
              <SearchableMultiSelect
                options={languageOptions}
                selected={(filters.language || []) as string[]}
                onChange={(vals) => updateFilters({ language: vals })}
                placeholder={t("search.all_languages")}
                searchPlaceholder={t("search.search_language")}
                emptyMessage={t("common.no_data")}
              />
            </div>

            {/* ── Authors (dynamic list) ────────────────────────────────────── */}
            <div className="col-span-1 md:col-span-2 space-y-3 pt-2">
              <Label className="text-sm font-medium text-foreground">{t("search.authors")}</Label>
              <div className="flex flex-col gap-3">
                {filters.personRoles?.map((pr, idx) => (
                  <div key={pr.id} className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="flex-1 w-full relative">
                      {pr.code ? (
                        <div className="h-10 border border-border-subtle rounded-xl bg-surface-2 flex items-center justify-between pl-2 pr-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <AvatarWithFallback
                              src={`/api/proxy-image?url=${encodeURIComponent(`https://inducks.org/creators/photos/${pr.code.replace(/ /g, "_")}.jpg`)}`}
                              name={selectedLabels[pr.code] || pr.code}
                              sizeClasses="w-6 h-6"
                            />
                            <span className="text-sm font-medium truncate">{selectedLabels[pr.code] || pr.code}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full shrink-0"
                            onClick={() => handleRoleClear(idx)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Autocomplete
                          value={pr.code}
                          placeholder={t("search.author_placeholder")}
                          emptyMessage={t("common.no_data")}
                          fetchOptions={autocompletePerson}
                          onSelect={(val, label) => handleRoleCodeChange(idx, val, label)}
                          type="authors"
                        />
                      )}
                    </div>
                    <div className="w-full sm:w-auto flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <Select
                        value={pr.role}
                        onValueChange={(val) => handleRoleTypeChange(idx, val)}
                      >
                        <SelectTrigger className="flex-1 sm:w-[140px] h-10 border-border-subtle rounded-xl bg-surface shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all hover:bg-surface-2">
                          <SelectValue placeholder={t("search.role")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">{t("roles.any")}</SelectItem>
                          <SelectItem value="p">{t("roles.p")}</SelectItem>
                          <SelectItem value="w">{t("roles.w")}</SelectItem>
                          <SelectItem value="a">{t("roles.a")}</SelectItem>
                          <SelectItem value="i">{t("roles.i")}</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="flex items-center gap-1">
                        {filters.personRoles!.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-text-secondary hover:text-red-500 shrink-0"
                            onClick={() => handleRemoveRole(idx)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                        {idx === filters.personRoles!.length - 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-xl shrink-0"
                            onClick={handleAddRole}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Excluded Author & Nationality ─────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.not_author")}</Label>
              <Autocomplete
                value={filters.excludePersoncode?.[0] || ""}
                placeholder={t("search.exclude_author_placeholder")}
                emptyMessage={t("common.no_data")}
                fetchOptions={autocompletePerson}
                onSelect={(val) => updateFilters({ excludePersoncode: [val] })}
                onClear={() => updateFilters({ excludePersoncode: [] })}
                hideIcon={true}
                hideSearchIcon={true}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">{t("search.author_nationality")}</Label>
              <SearchableMultiSelect
                options={nationalityOptions}
                selected={Array.isArray(filters.nationality) ? filters.nationality : []}
                onChange={(vals) => updateFilters({ nationality: vals })}
                placeholder={t("search.any_country")}
                searchPlaceholder={t("search.search_country")}
                emptyMessage={t("common.no_data")}
              />
            </div>

            {/* ── Heroes, Universe & Series ─────────────────────────────────── */}
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 pt-4 border-t border-border-subtle">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.heroes")}</Label>
                <MultiAutocomplete
                  placeholder={t("search.heroes_placeholder")}
                  emptyMessage={t("common.no_data")}
                  fetchOptions={(q) => autocompleteCharacter(q, i18n.language)}
                  selected={(filters.herocode || []) as string[]}
                  selectedLabels={selectedLabels}
                  onSelect={(val, label) => addSelection("herocode", val, label)}
                  onRemove={(val) => removeSelection("herocode", val)}
                  onClear={() => updateFilters({ herocode: [] })}
                  type="characters"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.universe")}</Label>
                <SearchableMultiSelect
                  options={universeOptions}
                  selected={Array.isArray(filters.universes) ? filters.universes : []}
                  onChange={(vals) => updateFilters({ universes: vals })}
                  placeholder={t("search.all_universes")}
                  searchPlaceholder={t("search.search_universe")}
                  emptyMessage={t("common.no_data")}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.series")}</Label>
                <SearchableMultiSelect
                  options={meta.subseries || []}
                  selected={(filters.subseriescode || []) as string[]}
                  onChange={(vals) => updateFilters({ subseriescode: vals })}
                  placeholder={t("search.all_series")}
                  searchPlaceholder={t("search.search_series")}
                  emptyMessage={t("common.no_data")}
                />
              </div>
            </div>

            {/* ── Characters (include / exclude) ────────────────────────────── */}
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 py-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.characters")}</Label>
                <MultiAutocomplete
                  placeholder={t("search.search_character_placeholder")}
                  emptyMessage={t("common.no_data")}
                  fetchOptions={(q) => autocompleteCharacter(q, i18n.language)}
                  selected={(filters.charactercode || []) as string[]}
                  selectedLabels={selectedLabels}
                  onSelect={(val, label) => addSelection("charactercode", val, label)}
                  onRemove={(val) => removeSelection("charactercode", val)}
                  onClear={() => updateFilters({ charactercode: [] })}
                  type="characters"
                />
                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex items-center gap-2 transition-opacity hover:opacity-100 opacity-80">
                    <Checkbox
                      id="no-others"
                      checked={filters.noOtherCharacters === true}
                      onCheckedChange={(checked) => updateFilters({ noOtherCharacters: checked === true })}
                    />
                    <label htmlFor="no-others" className="text-xs text-text-secondary cursor-pointer leading-snug">
                      {t("search.no_other_characters")}
                    </label>
                  </div>
                  <div className="flex items-center gap-2 transition-opacity hover:opacity-100 opacity-80">
                    <Checkbox
                      id="incomplete-indexing"
                      checked={filters.indexingIncomplete === true}
                      onCheckedChange={(checked) => updateFilters({ indexingIncomplete: checked === true })}
                    />
                    <label htmlFor="incomplete-indexing" className="text-xs text-text-secondary cursor-pointer">
                      {t("search.indexing_incomplete")}
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground text-red-600">
                  {t("search.exclude_character")}
                </Label>
                <MultiAutocomplete
                  placeholder={t("search.exclude_character_placeholder")}
                  emptyMessage={t("common.no_data")}
                  fetchOptions={(q) => autocompleteCharacter(q, i18n.language)}
                  selected={(filters.excludeCharactercode || []) as string[]}
                  selectedLabels={selectedLabels}
                  onSelect={(val, label) => addSelection("excludeCharactercode", val, label)}
                  onRemove={(val) => removeSelection("excludeCharactercode", val)}
                  onClear={() => updateFilters({ excludeCharactercode: [] })}
                  type="characters"
                />
              </div>
            </div>

            {/* ── Layout: strips & panels per page ─────────────────────────── */}
            <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border-subtle">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.strips_per_page")}</Label>
                <Select
                  value={filters.stripsperpage || "all"}
                  onValueChange={(val) => updateFilters({ stripsperpage: val })}
                >
                  <SelectTrigger className="h-10 border-border-subtle rounded-xl bg-surface shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all hover:bg-surface-2">
                    <SelectValue placeholder={t("search.any")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("search.any")}</SelectItem>
                    {LAYOUT_VALUES.map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {v} {t("search.strips_per_page").toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">{t("search.panels_per_strip")}</Label>
                <Select
                  value={filters.panelsperstrip || "all"}
                  onValueChange={(val) => updateFilters({ panelsperstrip: val })}
                >
                  <SelectTrigger className="h-10 border-border-subtle rounded-xl bg-surface shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all hover:bg-surface-2">
                    <SelectValue placeholder={t("search.any")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("search.any")}</SelectItem>
                    {LAYOUT_VALUES.map((v) => (
                      <SelectItem key={v} value={String(v)}>
                        {v} {t("search.panels_per_strip").toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Pages slider ─────────────────────────────────────────────── */}
            <div className="col-span-1 md:col-span-2 space-y-3 pt-4">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <Label className="text-sm font-medium text-foreground">{t("search.pages")}</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      variant="search"
                      placeholder={t("search.pages_exact")}
                      value={filters.pagesExact}
                      onChange={(e) => updateFilters({ pagesExact: e.target.value })}
                      className="w-24"
                    />
                    <span className="text-[10px] font-medium text-muted-foreground tracking-tight">
                      {t("search.pages_exact")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={filters.pagesMin ?? 0}
                    onChange={(e) => {
                      setPagesSliderMoved(true);
                      updateFilters({ pagesMin: parseInt(e.target.value) || 0 });
                    }}
                    className="w-16 h-7 text-xs text-center bg-surface-2 border-border-subtle font-mono px-1"
                  />
                  <span className="text-xs text-muted-foreground font-mono font-medium">—</span>
                  <Input
                    type="number"
                    value={filters.pagesMax ?? 100}
                    onChange={(e) => {
                      setPagesSliderMoved(true);
                      updateFilters({ pagesMax: parseInt(e.target.value) || 0 });
                    }}
                    className="w-16 h-7 text-xs text-center bg-surface-2 border-border-subtle font-mono px-1 mb-1"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 py-3 pb-8">
                <span className="text-xs font-medium text-muted-foreground w-4">0</span>
                <Slider
                  value={[filters.pagesMin ?? 0, filters.pagesMax ?? 100]}
                  max={Math.max(500, filters.pagesMax ?? 100)}
                  step={1}
                  className="flex-1"
                  onValueChange={([min, max]) => {
                    setPagesSliderMoved(true);
                    updateFilters({ pagesMin: min, pagesMax: max });
                  }}
                />
                <span className="text-xs font-medium text-muted-foreground w-6">
                  {Math.max(500, filters.pagesMax ?? 100)}
                </span>
              </div>
            </div>
          </form>
        </div>
      </ScrollArea>

      {/* ── Action buttons ─────────────────────────────────────────────────── */}
      <div className="p-6 border-t border-border-subtle bg-surface-2/30 flex flex-col-reverse sm:flex-row gap-3 shrink-0">
        <Button
          variant="outline"
          className="flex-1 rounded-xl h-11"
          onClick={handleReset}
        >
          {t("search.reset")}
        </Button>
        <Button
          className="flex-[1.5] rounded-xl h-11"
          onClick={() => handleSearch()}
          disabled={loading || isSearchDisabled}
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {t("search.submit")}
        </Button>
      </div>
    </div>
  );
}
