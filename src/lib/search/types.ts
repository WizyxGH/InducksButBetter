export interface SearchFilters {
  title?: string;
  description?: string;
  includeComments?: boolean | string;
  storycode?: string;
  charactercode?: string[] | string;
  excludeCharactercode?: string[] | string;
  personRoles?: { id: string; code: string; role: string }[];
  excludePersoncode?: string[] | string;
  publisherid?: string;
  kind?: string[] | string;
  pagesMin?: number;
  pagesMax?: number;
  pagesExact?: string | number;
  rowsperpage?: string;
  panelsperstrip?: string;
  stripsperpage?: string;
  language?: string[] | string;
  country?: string[] | string;
  herocode?: string[] | string;
  onlyCollection?: boolean;
  dateAfter?: string;
  dateBefore?: string;
  nationality?: string[] | string;
  universes?: string[] | string;
  subseriescode?: string[] | string;
  noOtherCharacters?: boolean | string;
  sort?: string;
  page?: number | string;
  indexingIncomplete?: boolean | string;
  multipleParts?: boolean | string;
  /** Exclude items merely derived from a creator's work (Inducks 'indirect'). */
  excludeIndirectCreators?: boolean | string;
  hasImage?: 'all' | 'yes' | 'no';
  lang?: string;
}

export interface PublicationsSearchFilters {
  country?: string;
  title?: string;
  issuenumber?: string;
  dateAfter?: string;
  dateBefore?: string;
  publisherid?: string;
  indexer?: string;
  collects?: boolean | string;
  specificTitle?: string;
  pages?: number;
  price?: string;
  attached?: string;
  size?: string;
  sort?: string;
  page?: number | string;
  rowsperpage?: string;
  lang?: string;
  category?: string;
}

export interface SearchQueryResponse {
  query: string;
  countQuery: string;
  params: any[];
  countParams: any[];
  pageSize: number;
  page: number;
}

export interface StorycodeCandidate {
  unpacked: string;
  packed: string;
}
