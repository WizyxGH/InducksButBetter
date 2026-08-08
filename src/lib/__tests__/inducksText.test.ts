import { describe, it, expect } from 'vitest'
import { parseInducksText, hasInducksLinks, inducksEntityRoute } from '../inducksText'

describe('parseInducksText', () => {
  it('returns nothing for empty input', () => {
    expect(parseInducksText(undefined)).toEqual([])
    expect(parseInducksText('')).toEqual([])
  })

  it('keeps tag-free text as a single segment', () => {
    expect(parseInducksText('Simple comment')).toEqual([
      { type: 'text', text: 'Simple comment' },
    ])
  })

  it('splits the fr/MPHS comment into text and publication links', () => {
    const segments = parseInducksText(
      'Remplace <publication fr/MPHS>Mickey Parade Géant Hors-Série</publication> ' +
        "depuis l'arrêt du titre <publication fr/MP>Mickey Parade Géant</publication>"
    )
    expect(segments).toEqual([
      { type: 'text', text: 'Remplace ' },
      { type: 'link', entity: 'publication', code: 'fr/MPHS', label: 'Mickey Parade Géant Hors-Série' },
      { type: 'text', text: " depuis l'arrêt du titre " },
      { type: 'link', entity: 'publication', code: 'fr/MP', label: 'Mickey Parade Géant' },
    ])
  })

  it('handles every entity Inducks links to', () => {
    const segments = parseInducksText(
      '<creator Carl Barks>Barks</creator><hero Donald Duck>Donald</hero>' +
        '<universe Ducks>Ducks</universe><issue fr/MP 272>272</issue>' +
        '<story W WDC 31-01>WDC 31</story><studio Disney Studio>Studio</studio>'
    )
    expect(segments.map((s) => (s.type === 'link' ? s.entity : s.text))).toEqual([
      'creator',
      'hero',
      'universe',
      'issue',
      'story',
      'studio',
    ])
  })

  it('falls back to the code when the label is empty', () => {
    expect(parseInducksText('<publication fr/MP></publication>')).toEqual([
      { type: 'link', entity: 'publication', code: 'fr/MP', label: 'fr/MP' },
    ])
  })

  it('leaves a codeless tag as plain text', () => {
    expect(parseInducksText('<publication >Mickey</publication>')).toEqual([
      { type: 'text', text: 'Mickey' },
    ])
  })

  it('ignores unknown and unbalanced tags', () => {
    expect(parseInducksText('<foo bar>baz</foo>')).toEqual([
      { type: 'text', text: '<foo bar>baz</foo>' },
    ])
    expect(parseInducksText('<publication fr/MP>Mickey</story>')).toEqual([
      { type: 'text', text: '<publication fr/MP>Mickey</story>' },
    ])
  })

  it('is not affected by the shared regex state across calls', () => {
    const text = 'a <publication fr/MP>MP</publication> b'
    expect(parseInducksText(text)).toEqual(parseInducksText(text))
  })
})

describe('hasInducksLinks', () => {
  it('detects cross references', () => {
    expect(hasInducksLinks('<publication fr/MP>MP</publication>')).toBe(true)
    expect(hasInducksLinks('plain text')).toBe(false)
    expect(hasInducksLinks(undefined)).toBe(false)
  })
})

describe('inducksEntityRoute', () => {
  it('maps each entity onto its page', () => {
    expect(inducksEntityRoute('publication', 'fr/MPHS')).toBe('/countries/fr/MPHS')
    expect(inducksEntityRoute('issue', 'fr/MP 272')).toBe('/countries/fr/MP/272')
    expect(inducksEntityRoute('hero', 'Donald Duck')).toBe('/characters/Donald+Duck')
    expect(inducksEntityRoute('universe', 'Ducks')).toBe('/universes/Ducks')
  })

  it('sends studios to the creator page, like the reference site', () => {
    expect(inducksEntityRoute('studio', 'Disney')).toBe(inducksEntityRoute('creator', 'Disney'))
  })
})
