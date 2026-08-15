import { describe, it, expect } from 'vitest'
import { parseCollection } from '../collection'

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
