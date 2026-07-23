import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { executeQuery } from "@/lib/db";
import { handleDbError } from "@/lib/utils";
import CharacterDetail from "./CharacterDetail";
import { useMetadata } from "@/hooks/useMetadata";
import { SearchResults } from "@/components/Search/SearchResults";
import { buildCharactersSearchQuery, CharactersSearchFilters } from "@/lib/queries/characters";
import { CharactersSearchForm } from "./CharactersSearchForm";
import { Character, CharacterResultCard } from "./CharacterResultCard";

const initialFilters: CharactersSearchFilters = {
  characterName: "",
  characterCode: "",
  heroOnly: false,
  oneTime: false,
  official: false,
  minAppearances: "",
  universes: [],
  sort: "appearances_desc",
  page: 1,
  rowsperpage: "24",
};

interface CharactersSearchProps {
  selectedCharactercode?: string | null;
  setSelectedCharactercode?: (code: string | null) => void;
}

export function CharactersSearch({ selectedCharactercode, setSelectedCharactercode }: CharactersSearchProps) {
  const { t } = useTranslation();
  const { meta } = useMetadata();
  const [filters, setFilters] = useState<CharactersSearchFilters>(initialFilters);
  const [results, setResults] = useState<Character[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastFilters, setLastFilters] = useState<CharactersSearchFilters | null>(null);

  const performSearch = async (searchFilters: CharactersSearchFilters) => {
    setLoading(true);
    try {
      const { query, countQuery, params, countParams } = buildCharactersSearchQuery(searchFilters);
      
      setResults([]);
      
      const countResult = await executeQuery({ sql: countQuery, args: countParams });
      setTotalCount(Number(countResult.rows[0]?.total || countResult.rows[0]?.COUNT || 0));

      const mainResult = await executeQuery({ sql: query, args: params });
      setResults(mainResult.rows as Character[]);
    } catch (err) {
      handleDbError(err, t("search.error_fetch", { defaultValue: "Erreur: impossible de récupérer les données." }));
      setResults([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent | null, overrideFilters?: CharactersSearchFilters) => {
    if (e) e.preventDefault();
    const currentFilters = overrideFilters || filters;
    setLastFilters(currentFilters);
    await performSearch(currentFilters);
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
    setResults([]);
    setTotalCount(0);
    setLastFilters(null);
  };

  const sortOptions = [
    { value: "appearances_desc", labelKey: "sort.appearances_desc" },
    { value: "appearances_asc", labelKey: "sort.appearances_asc" },
    { value: "name_asc", labelKey: "sort.name_asc" },
    { value: "name_desc", labelKey: "sort.name_desc" },
  ];

  if (selectedCharactercode) {
    return (
      <div className="flex-1 flex flex-col border-border-subtle/60 shadow-2xl shadow-blue-900/5 rounded-3xl overflow-hidden bg-surface h-full">
        <div className="px-8 py-5 border-b border-border-subtle bg-surface flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedCharactercode?.(null)}
            className="h-8 w-8 rounded-lg"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-sm font-semibold text-foreground">
            {t("characters.detail_title") || "Détails du personnage"}
          </h2>
        </div>
        <ScrollArea className="flex-1 h-full">
          <CharacterDetail charactercode={selectedCharactercode} />
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-auto lg:overflow-hidden bg-background">
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 p-4 lg:p-8 gap-8 px-4 lg:px-12">
        {/* Left Side: Filters form */}
        <CharactersSearchForm
          filters={filters}
          setFilters={setFilters}
          meta={meta}
          loading={loading}
          onSearch={handleSearch}
          onReset={handleClearFilters}
        />

        {/* Right Side: Reusable SearchResults */}
        <SearchResults
          results={results}
          totalCount={totalCount}
          loading={loading}
          filters={filters}
          setFilters={setFilters}
          handleSearch={handleSearch}
          isInitialState={lastFilters === null}
          sortOptions={sortOptions}
          renderResultCard={(char: Character) => (
            <CharacterResultCard
              key={char.charactercode}
              char={char}
              onSelect={(code) => setSelectedCharactercode?.(code)}
            />
          )}
          renderSkeleton={(i) => (
            <div key={i} className="h-[120px] rounded-2xl border border-border-subtle bg-surface-2/20 animate-shimmer" />
          )}
          foundLabel={t("characters.characters_found", { count: totalCount, defaultValue: `${totalCount} personnages trouvés` })}
          onSelect={(code) => setSelectedCharactercode?.(code)}
        />
      </div>
    </div>
  );
}

export default CharactersSearch;
