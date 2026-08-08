/**
 * What the SQL assistant knows about the Inducks schema.
 *
 * `DEFAULT_DB_SCHEMA` lists 73 tables and 395 columns — far more than a 1B
 * model can hold in context without inventing joins. So the assistant never
 * sees the whole thing: it gets the handful of tables a question actually
 * needs, plus the join paths between them, both taken from here.
 *
 * The join graph is curated rather than inferred. Inducks reuses column names
 * across unrelated tables (`number`, `charactername`, `title`), so matching on
 * names alone would suggest joins that produce nonsense.
 */

import { DEFAULT_DB_SCHEMA } from "@/lib/defaultSchema";

export interface Relation {
  from: string;
  fromColumn: string;
  to: string;
  toColumn: string;
}

/** Joins worth showing the model, in dependency order. */
export const RELATIONS: Relation[] = [
  // Stories and their versions
  { from: "inducks_storyversion", fromColumn: "storycode", to: "inducks_story", toColumn: "storycode" },
  { from: "inducks_story", fromColumn: "storyheadercode", to: "inducks_storyheader", toColumn: "storyheadercode" },
  { from: "inducks_storydescription", fromColumn: "storyversioncode", to: "inducks_storyversion", toColumn: "storyversioncode" },
  { from: "inducks_storycodes", fromColumn: "storycode", to: "inducks_story", toColumn: "storycode" },
  { from: "inducks_substory", fromColumn: "storyversioncode", to: "inducks_storyversion", toColumn: "storyversioncode" },

  // Credits
  { from: "inducks_storyjob", fromColumn: "storyversioncode", to: "inducks_storyversion", toColumn: "storyversioncode" },
  { from: "inducks_storyjob", fromColumn: "personcode", to: "inducks_person", toColumn: "personcode" },
  { from: "inducks_personalias", fromColumn: "personcode", to: "inducks_person", toColumn: "personcode" },
  { from: "inducks_studiowork", fromColumn: "storyversioncode", to: "inducks_storyversion", toColumn: "storyversioncode" },

  // Characters
  { from: "inducks_appearance", fromColumn: "storyversioncode", to: "inducks_storyversion", toColumn: "storyversioncode" },
  { from: "inducks_appearance", fromColumn: "charactercode", to: "inducks_character", toColumn: "charactercode" },
  { from: "inducks_herocharacter", fromColumn: "storycode", to: "inducks_story", toColumn: "storycode" },
  { from: "inducks_herocharacter", fromColumn: "charactercode", to: "inducks_character", toColumn: "charactercode" },
  { from: "inducks_charactername", fromColumn: "charactercode", to: "inducks_character", toColumn: "charactercode" },
  { from: "inducks_characteralias", fromColumn: "charactercode", to: "inducks_character", toColumn: "charactercode" },
  { from: "inducks_ucrelation", fromColumn: "charactercode", to: "inducks_character", toColumn: "charactercode" },
  { from: "inducks_ucrelation", fromColumn: "universecode", to: "inducks_universe", toColumn: "universecode" },
  { from: "inducks_universename", fromColumn: "universecode", to: "inducks_universe", toColumn: "universecode" },

  // Where a story was printed
  { from: "inducks_entry", fromColumn: "storyversioncode", to: "inducks_storyversion", toColumn: "storyversioncode" },
  { from: "inducks_entry", fromColumn: "issuecode", to: "inducks_issue", toColumn: "issuecode" },
  { from: "inducks_issue", fromColumn: "publicationcode", to: "inducks_publication", toColumn: "publicationcode" },
  { from: "inducks_issuerange", fromColumn: "publicationcode", to: "inducks_publication", toColumn: "publicationcode" },
  { from: "inducks_publication", fromColumn: "countrycode", to: "inducks_country", toColumn: "countrycode" },
  { from: "inducks_publication", fromColumn: "languagecode", to: "inducks_language", toColumn: "languagecode" },
  { from: "inducks_publicationname", fromColumn: "publicationcode", to: "inducks_publication", toColumn: "publicationcode" },
  { from: "inducks_publicationcategory", fromColumn: "publicationcode", to: "inducks_publication", toColumn: "publicationcode" },
  { from: "inducks_publishingjob", fromColumn: "issuecode", to: "inducks_issue", toColumn: "issuecode" },
  { from: "inducks_publishingjob", fromColumn: "publisherid", to: "inducks_publisher", toColumn: "publisherid" },
  { from: "inducks_issuejob", fromColumn: "issuecode", to: "inducks_issue", toColumn: "issuecode" },
  { from: "inducks_issueprice", fromColumn: "issuecode", to: "inducks_issue", toColumn: "issuecode" },

  // Subseries
  { from: "inducks_storysubseries", fromColumn: "storycode", to: "inducks_story", toColumn: "storycode" },
  { from: "inducks_storysubseries", fromColumn: "subseriescode", to: "inducks_subseries", toColumn: "subseriescode" },
  { from: "inducks_subseriesname", fromColumn: "subseriescode", to: "inducks_subseries", toColumn: "subseriescode" },

  // Localised names
  { from: "inducks_countryname", fromColumn: "countrycode", to: "inducks_country", toColumn: "countrycode" },
  { from: "inducks_languagename", fromColumn: "languagecode", to: "inducks_language", toColumn: "languagecode" },
];

/**
 * Concepts the assistant can recognise, with the words users reach for.
 *
 * Deliberately multilingual: the app ships 12 locales and the question may
 * arrive in any of them. Terms are lowercase and accent-free — `normalise()`
 * strips diacritics before matching, so "héros" finds "heros".
 */
export const CONCEPTS: Array<{ tables: string[]; terms: string[] }> = [
  {
    tables: ["inducks_story", "inducks_storyversion", "inducks_storyheader"],
    terms: [
      "story", "stories", "histoire", "histoires", "recit", "recits", "geschichte", "geschichten",
      "storia", "storie", "historia", "historias", "verhaal", "verhalen", "historie", "berattelse",
      "title", "titre", "titel", "titolo", "titulo", "comic", "comics", "bd", "tale", "tales",
    ],
  },
  {
    tables: ["inducks_person", "inducks_storyjob"],
    terms: [
      "author", "authors", "auteur", "auteurs", "artist", "artiste", "dessinateur", "scenariste",
      "writer", "writers", "ecrivain", "scriptwriter", "creator", "createur", "zeichner", "autor",
      "autore", "autori", "disegnatore", "sceneggiatore", "tekenaar", "schrijver", "forfattare",
      "drawn", "dessine", "written", "ecrit", "script", "scenario", "art", "ink", "pencil",
      "barks", "rosa", "scarpa", "person", "personne", "people",
    ],
  },
  {
    tables: ["inducks_character", "inducks_appearance", "inducks_charactername"],
    terms: [
      "character", "characters", "personnage", "personnages", "figur", "figuren", "personaggio",
      "personaggi", "personaje", "personajes", "personage", "karakter", "hero", "heros", "heroine",
      "donald", "mickey", "picsou", "scrooge", "riri", "fifi", "loulou", "daisy", "dingo", "goofy",
      "paperino", "paperone", "topolino", "appear", "apparait", "apparition", "appearance",
    ],
  },
  {
    tables: ["inducks_universe", "inducks_ucrelation", "inducks_universename"],
    terms: ["universe", "universes", "univers", "universo", "universum", "wereld"],
  },
  {
    tables: ["inducks_publication", "inducks_publicationname"],
    terms: [
      "publication", "publications", "magazine", "magazines", "revue", "revues", "journal",
      "series", "serie", "series", "tijdschrift", "zeitschrift", "rivista", "revista",
      "title", "periodique", "album", "albums",
    ],
  },
  {
    tables: ["inducks_issue", "inducks_entry"],
    terms: [
      "issue", "issues", "numero", "numeros", "number", "nummer", "numero", "numeri",
      "parution", "parutions", "printed", "publie", "published", "pubblicato", "publicado",
      "uitgave", "heft", "hefte", "cover", "couverture", "page", "pages",
    ],
  },
  {
    tables: ["inducks_publisher", "inducks_publishingjob"],
    terms: [
      "publisher", "publishers", "editeur", "editeurs", "verlag", "editore", "editorial",
      "uitgever", "forlag", "hachette", "disney italia", "egmont",
    ],
  },
  {
    tables: ["inducks_country", "inducks_countryname"],
    terms: [
      "country", "countries", "pays", "land", "lander", "paese", "paesi", "pais", "paises",
      "france", "italy", "italie", "usa", "america", "germany", "allemagne", "brazil", "bresil",
      "denmark", "danemark", "netherlands", "sweden", "suede",
    ],
  },
  {
    tables: ["inducks_language", "inducks_languagename"],
    terms: ["language", "languages", "langue", "langues", "sprache", "lingua", "idioma", "taal"],
  },
  {
    tables: ["inducks_subseries", "inducks_storysubseries", "inducks_subseriesname"],
    terms: ["subseries", "sous-serie", "sous serie", "saga", "cycle", "reihe", "collana"],
  },
];

/** Always available: the spine every question tends to hang off. */
export const CORE_TABLES = ["inducks_story", "inducks_storyversion"];

/** Lowercases and strips diacritics so "héros" and "heros" match. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp('\\p{Diacritic}', 'gu'), "");
}

/** Relations whose two ends are both in `tables`. */
export function relationsWithin(tables: Iterable<string>): Relation[] {
  const set = new Set(tables);
  return RELATIONS.filter((r) => set.has(r.from) && set.has(r.to));
}

/** Shortest join path between two tables, or null when they are unrelated. */
export function joinPath(from: string, to: string): Relation[] | null {
  if (from === to) return [];

  const queue: Array<{ table: string; path: Relation[] }> = [{ table: from, path: [] }];
  const seen = new Set([from]);

  while (queue.length > 0) {
    const { table, path } = queue.shift()!;
    for (const relation of RELATIONS) {
      let next: string | null = null;
      if (relation.from === table) next = relation.to;
      else if (relation.to === table) next = relation.from;
      if (!next || seen.has(next)) continue;

      const extended = [...path, relation];
      if (next === to) return extended;
      seen.add(next);
      queue.push({ table: next, path: extended });
    }
  }

  return null;
}

/**
 * Picks the tables a question needs.
 *
 * Concept hits come first, then any table named outright, then the tables the
 * join paths have to pass through — without those the model has to guess how
 * two ends meet, which is where invented columns come from. Capped, because
 * every extra table costs accuracy on a small model.
 */
export function selectRelevantTables(question: string, limit = 10): string[] {
  const text = normalise(question);
  const scores = new Map<string, number>();
  const bump = (table: string, by: number) => {
    if (!(table in DEFAULT_DB_SCHEMA)) return;
    scores.set(table, (scores.get(table) ?? 0) + by);
  };

  for (const concept of CONCEPTS) {
    const hits = concept.terms.filter((term) => text.includes(term)).length;
    if (hits === 0) continue;
    // First table of a concept is its primary one; the others support it.
    concept.tables.forEach((table, index) => bump(table, hits * (index === 0 ? 3 : 2)));
  }

  // An explicit table name is the strongest possible signal.
  for (const table of Object.keys(DEFAULT_DB_SCHEMA)) {
    if (text.includes(table) || text.includes(table.replace("inducks_", ""))) bump(table, 10);
  }

  CORE_TABLES.forEach((table) => bump(table, 1));

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([table]) => table);

  const chosen = new Set(ranked.slice(0, limit));

  // Re-add the tables the joins travel through, so no path is left implicit.
  for (const from of [...chosen]) {
    for (const to of [...chosen]) {
      const path = joinPath(from, to);
      if (!path) continue;
      for (const relation of path) {
        chosen.add(relation.from);
        chosen.add(relation.to);
      }
    }
  }

  return [...chosen].sort();
}
