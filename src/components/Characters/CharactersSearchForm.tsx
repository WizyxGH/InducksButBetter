import React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableMultiSelect } from "@/components/SearchableMultiSelect";
import { Autocomplete } from "@/components/Autocomplete";
import { autocompleteCharacter } from "@/lib/turso";
import { CharactersSearchFilters } from "@/lib/queries/characters";

interface CharactersSearchFormProps {
  filters: CharactersSearchFilters;
  setFilters: (filters: CharactersSearchFilters) => void;
  meta: any;
  loading: boolean;
  onSearch: (e?: React.FormEvent | null) => void;
  onReset: () => void;
}

export function CharactersSearchForm({
  filters,
  setFilters,
  meta,
  loading,
  onSearch,
  onReset,
}: CharactersSearchFormProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex-1 flex flex-col border border-border-subtle/60 shadow-2xl shadow-blue-900/5 rounded-3xl overflow-hidden bg-surface min-h-[600px] lg:min-h-0">
      <div className="px-6 py-4 border-b border-border-subtle bg-surface flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          {t("characters.title") || "Recherche Personnages"}
        </h2>
      </div>

      <ScrollArea className="flex-1">
        <form onSubmit={onSearch} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-4 md:gap-y-7">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t("characters.name") || "Nom"}</Label>
            <Autocomplete
              placeholder={t("characters.name_placeholder") || "Ex: Mickey, Donald..."}
              value={filters.characterName}
              onInputChange={(val) => setFilters({ ...filters, characterName: val })}
              onSelect={(id, name) => setFilters({ ...filters, characterName: name })}
              onClear={() => setFilters({ ...filters, characterName: "" })}
              fetchOptions={(q) => autocompleteCharacter(q, i18n.language)}
              emptyMessage={t("common.no_data") || "Aucun résultat"}
              type="characters"
              hideSearchIcon
              hideIcon
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t("characters.code") || "Code personnage"}</Label>
            <Input
              placeholder={t("characters.code_placeholder") || "Ex: MM, DD..."}
              value={filters.characterCode}
              onChange={(e) => setFilters({ ...filters, characterCode: e.target.value })}
              className="h-10 rounded-xl bg-surface"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t("characters.min_appearances") || "Apparitions minimum"}</Label>
            <Input
              type="number"
              placeholder="Ex: 5"
              value={filters.minAppearances}
              onChange={(e) => setFilters({ ...filters, minAppearances: e.target.value })}
              className="h-10 rounded-xl bg-surface"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t("search.universe") || "Univers"}</Label>
            <SearchableMultiSelect
              options={meta.universes?.map((u: any) => ({
                value: u.universecode,
                label: u.universename,
              })) || []}
              selected={filters.universes}
              onChange={(vals) => setFilters({ ...filters, universes: vals })}
              placeholder={t("search.all_universes") || "Tous les univers"}
              searchPlaceholder={t("search.search_universe") || "Rechercher..."}
              emptyMessage={t("common.no_data") || "Aucun résultat"}
            />
          </div>

          <div className="space-y-3 pt-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="heroOnly"
                checked={filters.heroOnly}
                onCheckedChange={(checked) => setFilters({ ...filters, heroOnly: checked === true })}
              />
              <Label htmlFor="heroOnly" className="text-xs font-medium cursor-pointer">
                {t("characters.hero_only") || "Héros uniquement"}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="official"
                checked={filters.official}
                onCheckedChange={(checked) => setFilters({ ...filters, official: checked === true })}
              />
              <Label htmlFor="official" className="text-xs font-medium cursor-pointer">
                {t("characters.official") || "Personnage officiel"}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="oneTime"
                checked={filters.oneTime}
                onCheckedChange={(checked) => setFilters({ ...filters, oneTime: checked === true })}
              />
              <Label htmlFor="oneTime" className="text-xs font-medium cursor-pointer">
                {t("characters.onetime") || "Apparition unique"}
              </Label>
            </div>
          </div>
        </form>
      </ScrollArea>

      <div className="p-6 border-t border-border-subtle bg-surface-2/30 flex gap-3 shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          className="flex-1 rounded-xl h-11"
        >
          {t("characters.reset") || "Réinitialiser"}
        </Button>
        <Button
          onClick={() => onSearch()}
          disabled={loading}
          className="flex-[1.5] rounded-xl h-11"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {t("characters.submit") || "Rechercher"}
        </Button>
      </div>
    </div>
  );
}
