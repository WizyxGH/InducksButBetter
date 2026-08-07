import { describe, it, expect } from 'vitest';
import { DEFAULT_DB_SCHEMA } from '../defaultSchema';

/**
 * The app writes raw SQL against a database it does not own: a dump that
 * dropped a column would only fail at runtime, on the page that queries it.
 * These guards pin the tables and columns the feature code depends on, so a
 * schema drift breaks the suite instead of a user's page.
 */
const REQUIRED: Record<string, string[]> = {
  // Publication page: header, publisher chips and the issue grid.
  inducks_publication: ['publicationcode', 'countrycode', 'languagecode', 'title', 'publicationcomment'],
  inducks_publicationcategory: ['publicationcode', 'category'],
  inducks_publisher: ['publisherid', 'publishername'],
  inducks_publishingjob: ['publisherid', 'issuecode'],
  // `issuerangecode` is what ties an issue to its `h2` header.
  inducks_issue: ['issuecode', 'issuerangecode', 'publicationcode', 'issuenumber', 'title', 'oldestdate'],
  // The `h2` headers of the Inducks source files.
  inducks_issuerange: ['issuerangecode', 'publicationcode', 'title', 'circulation', 'issuerangecomment'],
  // Cover thumbnails shown next to the issues.
  inducks_entry: ['entrycode', 'issuecode'],
  inducks_entryurl: ['entrycode', 'sitecode', 'url'],
};

describe('database schema contract', () => {
  for (const [table, columns] of Object.entries(REQUIRED)) {
    it(`declares ${table}`, () => {
      expect(DEFAULT_DB_SCHEMA[table]).toBeDefined();
    });

    it.each(columns)(`declares ${table}.%s`, (column) => {
      expect(DEFAULT_DB_SCHEMA[table]).toContain(column);
    });
  }

  it('validates the database by a table the app actually queries', () => {
    // The worker accepts an import only if `inducks_story` is present; the
    // check is worthless if the table is not part of the schema.
    expect(DEFAULT_DB_SCHEMA.inducks_story).toBeDefined();
  });
});
