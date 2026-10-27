import { describe, it, expect } from 'vitest'
import {
  parseCollection,
  formatCollectionExport,
  isIssueInCollection,
  normalizeIssuecode,
} from '../collection'

describe('parseCollection', () => {
  it('joins country and entrycode into an issuecode', () => {
    expect(parseCollection('be^MMN   8^digital^')).toEqual(['be/MMN   8'])
  })

  it('keeps the interior padding that issuecodes depend on', () => {
    // inducks_entry.issuecode stores "fr/JM    1", not "fr/JM 1".
    expect(parseCollection('fr^JM    1^^')).toEqual(['fr/JM    1'])
  })

  it('drops the export header row', () => {
    const text = 'country^entrycode^collectiontype^comment\nbe^ALMM 16^^'
    expect(parseCollection(text)).toEqual(['be/ALMM 16'])
  })

  it('collapses the paper and digital rows of the same issue', () => {
    const text = 'de^LTB  34^^\nde^LTB  34^digital^'
    expect(parseCollection(text)).toEqual(['de/LTB  34'])
  })

  it('keeps comments out of the issuecode', () => {
    const text = 'fr^ALJM  37^^Some pages are missing + fr/JM 741'
    expect(parseCollection(text)).toEqual(['fr/ALJM  37'])
  })

  it('accepts entrycodes that are not plain numbers', () => {
    const text = 'bg^MM1991-00^digital^\nfr^DM 89-37^^\ncz^MM 1995-13-14^^'
    expect(parseCollection(text)).toEqual(['bg/MM1991-00', 'fr/DM 89-37', 'cz/MM 1995-13-14'])
  })

  it('round-trips its own output, so save → reload → save is stable', () => {
    const once = parseCollection('be^MMN   8^digital^\nfr^JM    1^^')
    expect(parseCollection(once.join('\n'))).toEqual(once)
  })

  it('ignores blank lines and stray whitespace', () => {
    expect(parseCollection('\n\nbe^MMN   1^digital^\n  \n')).toEqual(['be/MMN   1'])
  })

  it('returns nothing for an empty textarea', () => {
    expect(parseCollection('')).toEqual([])
    expect(parseCollection('   \n  ')).toEqual([])
  })

  it('never emits the bare country codes the old parser produced', () => {
    const codes = parseCollection('be^ALMM 16^^\nfr^JM    1^^\nde^LTB   1^digital^')
    expect(codes).not.toContain('be')
    expect(codes).not.toContain('fr')
    expect(codes).not.toContain('de')
  })
})

describe('formatCollectionExport', () => {
  it('formats issuecodes into standard Inducks export lines', () => {
    const issues = ['fr/JM  272', 'be/MMN   8']
    expect(formatCollectionExport(issues)).toEqual('fr^JM  272^^\nbe^MMN   8^^')
  })

  it('handles empty collection', () => {
    expect(formatCollectionExport([])).toEqual('')
  })
})

describe('isIssueInCollection', () => {
  it('matches exact and space-normalized issuecodes', () => {
    const collection = ['fr/PM  272', 'it/TL 1']
    expect(isIssueInCollection('fr/PM  272', collection)).toBe(true)
    expect(isIssueInCollection('fr/PM 272', collection)).toBe(true)
    expect(isIssueInCollection('it/TL 1', collection)).toBe(true)
    expect(isIssueInCollection('it/TL 2', collection)).toBe(false)
  })

  it('works with a Set', () => {
    const set = new Set(['fr/PM  272', 'it/TL 1'])
    expect(isIssueInCollection('fr/PM  272', set)).toBe(true)
    expect(isIssueInCollection('fr/PM 272', set)).toBe(true)
    expect(isIssueInCollection('fr/OTHER 1', set)).toBe(false)
  })
})
