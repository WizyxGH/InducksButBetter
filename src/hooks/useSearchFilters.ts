import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SearchFilters } from "@/lib/searchService";
import { getLocalizedCharacterNames } from "@/lib/dataService";

export const initialFilters: SearchFilters = {
  title: "",
  description: "",
  includeComments: false,
  storycode: "",
  charactercode: [],
  excludeCharactercode: [],
  personRoles: [{ id: "init", code: "", role: "any" }],
  excludePersoncode: [],
  publisherid: "",
  kind: [],
  pagesMin: 0,
  pagesMax: 500,
  pagesExact: "",
  rowsperpage: "24",
  panelsperstrip: "",
  stripsperpage: "",
  language: [],
  country: [],
  herocode: [],
  onlyCollection: false,
  dateAfter: "",
  dateBefore: "",
  nationality: [],
  universes: [],
  subseriescode: [],
  noOtherCharacters: false,
  sort: "pubdate_asc",
  page: 1,
  indexingIncomplete: false,
  multipleParts: false,
  hasImage: 'all',
  excludeIndirectCreators: false,
};

export function useSearchFilters() {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [pagesSliderMoved, setPagesSliderMoved] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<Record<string, string>>({});
  const [cookieValue, setCookieValue] = useState("");
  const [isSavingCookie, setIsSavingCookie] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { i18n } = useTranslation();

  useEffect(() => {
    const allCodes = [
      ...(filters.charactercode as string[] || []),
      ...(filters.excludeCharactercode as string[] || []),
      ...(filters.herocode as string[] || [])
    ];
    
    if (allCodes.length > 0) {
      getLocalizedCharacterNames(allCodes, i18n.language).then(map => {
        setSelectedLabels(prev => ({ ...prev, ...map }));
      }).catch(console.error);
    }
  }, [i18n.language, filters.charactercode, filters.excludeCharactercode, filters.herocode]);

  const addSelection = (key: "charactercode" | "herocode" | "excludeCharactercode", value: string, label: string) => {
    if (!(filters[key] as string[]).includes(value)) {
      setFilters({ ...filters, [key]: [...(filters[key] as string[]), value] });
      setSelectedLabels({ ...selectedLabels, [value]: label });
    }
  };

  const removeSelection = (key: "charactercode" | "herocode" | "excludeCharactercode", value: string) => {
    setFilters({ ...filters, [key]: (filters[key] as string[]).filter((v: string) => v !== value) });
  };

  const saveCookie = async () => {
    setIsSavingCookie(true);
    try {
      localStorage.setItem("inducks_cookie", cookieValue);
      setIsSettingsOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingCookie(false);
    }
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
    setSelectedLabels({});
    setPagesSliderMoved(false);
  };

  return {
    filters,
    setFilters,
    pagesSliderMoved,
    setPagesSliderMoved,
    selectedLabels,
    setSelectedLabels,
    cookieValue,
    setCookieValue,
    isSavingCookie,
    isSettingsOpen,
    setIsSettingsOpen,
    addSelection,
    removeSelection,
    saveCookie,
    handleClearFilters,
  };
}
