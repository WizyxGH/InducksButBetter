import { describe, it, expect } from 'vitest'
import { parseRoutePath } from '../routeParser'

describe('parseRoutePath', () => {
  it('defaults to home tab when path is empty', () => {
    expect(parseRoutePath('')).toEqual({ tab: 'home' })
  })

  it('parses /home tab correctly', () => {
    expect(parseRoutePath('home')).toEqual({ tab: 'home' })
  })

  it('parses /stories/AR+102 or /stories/AR 102 as a story code', () => {
    expect(parseRoutePath('stories/AR 102')).toEqual({
      tab: 'stories',
      storycode: 'AR 102',
    })
  })

  it('parses /stories/story/W+US+242-01 correctly', () => {
    expect(parseRoutePath('stories/story/W US 242-01')).toEqual({
      tab: 'stories',
      storycode: 'W US 242-01',
    })
  })

  it('parses /stories/issue/us/US/242 as an issue code in publications tab', () => {
    expect(parseRoutePath('stories/issue/us/US/242')).toEqual({
      tab: 'publications',
      issuecode: 'us/US 242',
    })
  })

  it('parses /countries/de/LTB/613 as an issue code', () => {
    expect(parseRoutePath('countries/de/LTB/613')).toEqual({
      tab: 'publications',
      issuecode: 'de/LTB 613',
    })
  })

  it('parses /countries/de/LTB as a publication code', () => {
    expect(parseRoutePath('countries/de/LTB')).toEqual({
      tab: 'publications',
      publicationcode: 'de/LTB',
    })
  })

  it('parses /countries/fr as a country code', () => {
    expect(parseRoutePath('countries/fr')).toEqual({
      tab: 'countries',
      countrycode: 'fr',
    })
  })

  it('parses /authors/Carl Barks as an author personcode', () => {
    expect(parseRoutePath('authors/Carl Barks')).toEqual({
      tab: 'authors',
      personcode: 'Carl Barks',
    })
  })

  it('parses /characters/Donald as a charactercode', () => {
    expect(parseRoutePath('characters/Donald')).toEqual({
      tab: 'characters',
      charactercode: 'Donald',
    })
  })

  it('parses /publishers/Disney as a publisherid', () => {
    expect(parseRoutePath('publishers/Disney')).toEqual({
      tab: 'publications',
      publisherid: 'Disney',
    })
  })

  it('parses /settings tab', () => {
    expect(parseRoutePath('settings')).toEqual({ tab: 'settings' })
  })
})
