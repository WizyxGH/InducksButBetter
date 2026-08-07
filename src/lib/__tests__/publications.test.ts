import { describe, it, expect } from 'vitest';
import {
  buildIssueSections,
  groupIssuesByRange,
  groupIssuesByYear,
  issueDisplayNumber,
  type IssueRange,
} from '../publications';

/**
 * Fixtures are real rows from the Inducks dump, kept verbatim (padding
 * included) because the padding is what makes issue-code ordering work.
 */
const SPGHS_RANGES: IssueRange[] = [
  { issuerangecode: 'fr/SPGHS H', title: "L'histoire de la dynastie Picsou" },
];

const SPGHS_ISSUES = [
  { issuecode: 'fr/SPGHS  1', issuenumber: '1', issuerangecode: '', oldestdate: '2018-11-00' },
  { issuecode: 'fr/SPGHS  2', issuenumber: '2', issuerangecode: '', oldestdate: '2019-11-00' },
  { issuecode: 'fr/SPGHS H1', issuenumber: 'H1', issuerangecode: 'fr/SPGHS H', oldestdate: '2024-03-30' },
  { issuecode: 'fr/SPGHS H2', issuenumber: 'H2', issuerangecode: 'fr/SPGHS H', oldestdate: '2024-07-09' },
];

describe('issueDisplayNumber', () => {
  it('keeps the issue number when the publication has no range', () => {
    expect(issueDisplayNumber('fr/SPGHS  1', '', '1')).toBe('1');
  });

  it('strips the range code from the issue code', () => {
    expect(issueDisplayNumber('fr/SPGHS H1', 'fr/SPGHS H', 'H1')).toBe('1');
  });

  it('strips the padding the ISV files leave in the number', () => {
    // nl/AD195011 + 19501101 -> the reference site prints "01"
    expect(issueDisplayNumber('nl/AD19501101', 'nl/AD195011', '19501101')).toBe('01');
  });

  it('drops the separators between the range and the number', () => {
    expect(issueDisplayNumber('pl/DD 1991-02', 'pl/DD 1991', '1991-02')).toBe('02');
  });

  it('falls back to the number when the range is not a prefix', () => {
    // it/TL    0 groups it/TL    1: the range code is a marker, not a prefix.
    expect(issueDisplayNumber('it/TL    1', 'it/TL    0', '1')).toBe('1');
  });

  it('falls back to the number when stripping leaves nothing', () => {
    expect(issueDisplayNumber('fr/X 1', 'fr/X 1', '1')).toBe('1');
  });

  it('falls back to the issue code when the number is missing', () => {
    expect(issueDisplayNumber('fr/SPGHS  1', '', '')).toBe('fr/SPGHS  1');
    expect(issueDisplayNumber('fr/SPGHS  1', null, null)).toBe('fr/SPGHS  1');
  });
});

describe('groupIssuesByRange', () => {
  it('puts the unranged issues in a leading headerless section', () => {
    const sections = groupIssuesByRange(SPGHS_ISSUES, SPGHS_RANGES);

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBeNull();
    expect(sections[0].issues.map((i) => i.issuecode)).toEqual(['fr/SPGHS  1', 'fr/SPGHS  2']);
  });

  it('titles a section with the range name, like the h2 header', () => {
    const sections = groupIssuesByRange(SPGHS_ISSUES, SPGHS_RANGES);

    expect(sections[1].key).toBe('fr/SPGHS H');
    expect(sections[1].title).toBe("L'histoire de la dynastie Picsou");
    expect(sections[1].titleIsCode).toBe(false);
    expect(sections[1].issues.map((i) => i.issuecode)).toEqual(['fr/SPGHS H1', 'fr/SPGHS H2']);
  });

  it('falls back to the range code when the range has no title', () => {
    const sections = groupIssuesByRange(
      [{ issuecode: 'xx/A 1', issuerangecode: 'xx/A' }],
      [{ issuerangecode: 'xx/A', title: '' }]
    );

    expect(sections[0].title).toBe('xx/A');
    expect(sections[0].titleIsCode).toBe(true);
  });

  it('skips ranges that hold no issue, as an empty h2 is skipped', () => {
    const sections = groupIssuesByRange(SPGHS_ISSUES, [
      ...SPGHS_RANGES,
      { issuerangecode: 'fr/SPGHS D', title: 'Super Donald Géant' },
    ]);

    expect(sections.map((s) => s.key)).toEqual(['', 'fr/SPGHS H']);
  });

  it('keeps an unranged issue inside the section it follows', () => {
    // publication.php only opens a new section on a non-empty range code.
    const sections = groupIssuesByRange(
      [
        { issuecode: 'xx/A 1', issuerangecode: 'xx/A' },
        { issuecode: 'xx/A 2', issuerangecode: '' },
      ],
      [{ issuerangecode: 'xx/A', title: 'First' }]
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].issues).toHaveLength(2);
  });

  it('carries the range comment and circulation', () => {
    const sections = groupIssuesByRange(
      [{ issuecode: 'xx/A 1', issuerangecode: 'xx/A' }],
      [{ issuerangecode: 'xx/A', title: 'T', issuerangecomment: 'note', circulation: '10,000' }]
    );

    expect(sections[0].comment).toBe('note');
    expect(sections[0].circulation).toBe('10,000');
  });

  it('leaves comment and circulation unset when they are empty strings', () => {
    const sections = groupIssuesByRange(
      [{ issuecode: 'xx/A 1', issuerangecode: 'xx/A' }],
      [{ issuerangecode: 'xx/A', title: 'T', issuerangecomment: '', circulation: '' }]
    );

    expect(sections[0].comment).toBeUndefined();
    expect(sections[0].circulation).toBeUndefined();
  });

  it('returns nothing for an empty publication', () => {
    expect(groupIssuesByRange([], SPGHS_RANGES)).toEqual([]);
  });
});

describe('groupIssuesByYear', () => {
  const unknown = 'Unknown';

  it('groups on the first four characters of the oldest date', () => {
    const sections = groupIssuesByYear(
      [
        { issuecode: 'a', oldestdate: '1980-06-00' },
        { issuecode: 'b', oldestdate: '1980-08-00' },
        { issuecode: 'c', oldestdate: '1981-02-00' },
      ],
      unknown
    );

    expect(sections.map((s) => s.title)).toEqual(['1980', '1981']);
    expect(sections[0].issues).toHaveLength(2);
  });

  it('sorts the years even when the rows are not date-ordered', () => {
    // Issues are fetched in issue-code order, which is not always by date.
    const sections = groupIssuesByYear(
      [
        { issuecode: 'a', oldestdate: '1990-01-01' },
        { issuecode: 'b', oldestdate: '1985-01-01' },
      ],
      unknown
    );

    expect(sections.map((s) => s.title)).toEqual(['1985', '1990']);
  });

  it('sends the undated issues to the end rather than under year 0000', () => {
    const sections = groupIssuesByYear(
      [
        { issuecode: 'a', oldestdate: '0000-00-00' },
        { issuecode: 'b', oldestdate: '1999-01-01' },
        { issuecode: 'c', oldestdate: '9999-99-99' },
        { issuecode: 'd', oldestdate: '' },
      ],
      unknown
    );

    expect(sections.map((s) => s.title)).toEqual(['1999', unknown]);
    expect(sections[1].issues).toHaveLength(3);
  });
});

describe('buildIssueSections', () => {
  it('groups by range when Inducks declares one', () => {
    const sections = buildIssueSections(SPGHS_ISSUES, SPGHS_RANGES, 'Unknown');
    expect(sections.map((s) => s.key)).toEqual(['', 'fr/SPGHS H']);
  });

  it('groups by year when the publication has no range', () => {
    const sections = buildIssueSections(
      [
        { issuecode: 'fr/PM   1', issuenumber: '1', issuerangecode: '', oldestdate: '1972-11-00' },
        { issuecode: 'fr/PM   2', issuenumber: '2', issuerangecode: '', oldestdate: '1973-01-00' },
      ],
      [],
      'Unknown'
    );

    expect(sections.map((s) => s.title)).toEqual(['1972', '1973']);
  });

  it('groups by year when the ranges exist but no issue references them', () => {
    // A dump can list a range whose issues have not been imported yet;
    // grouping by an empty range would collapse the whole page into one block.
    const sections = buildIssueSections(
      [{ issuecode: 'fr/PM   1', issuerangecode: '', oldestdate: '1972-11-00' }],
      SPGHS_RANGES,
      'Unknown'
    );

    expect(sections.map((s) => s.title)).toEqual(['1972']);
  });
});
