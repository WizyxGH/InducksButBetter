// Facade kept so every existing `from "@/lib/dataService"` import keeps
// working; the queries themselves live under ./queries, one file per domain.
export {
  autocompleteCharacter,
  autocompletePerson,
  autocompleteIndexer,
  autocompleteStorycode,
  autocompletePublisher,
  autocompletePublicationTitle,
  getLocalizedCharacterNames,
  unifiedAutocomplete,
} from "./queries/autocomplete";
export type { UnifiedSearchResult } from "./queries/autocomplete";
export { getStoryDetail } from "./queries/stories";
export { resolveIssue, getIssueDetail } from "./queries/issues";
export { getSubseriesList, getSubseriesDetail } from "./queries/subseries";
export { getUniverseList, getUniverseDetail } from "./queries/universes";
