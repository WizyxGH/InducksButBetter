/**
 * Tests for src/lib/routes.ts
 *
 * Ensures every route generator produces a predictable,
 * correctly-encoded URL. These tests act as a contract:
 * if a URL format ever changes, these tests will catch regressions.
 */
import { describe, it, expect } from 'vitest'
import { routes } from '../routes'

describe('routes', () => {
  // ── Static routes ─────────────────────────────────────────────────────

  it('home() returns /home', () => {
    expect(routes.home()).toBe('/home')
  })

  it('settings() returns /settings', () => {
    expect(routes.settings()).toBe('/settings')
  })

  it('suggestions() returns /suggestions', () => {
    expect(routes.suggestions()).toBe('/suggestions')
  })

  it('sql() returns /sql', () => {
    expect(routes.sql()).toBe('/sql')
  })

  // ── story ──────────────────────────────────────────────────────────────

  it('story() encodes a simple storycode', () => {
    expect(routes.story('W WDC 1-01')).toBe('/stories/W+WDC+1-01')
  })

  it('story() encodes a code with + sign', () => {
    expect(routes.story('F+DBG+++1')).toBe('/stories/F%2BDBG%2B%2B%2B1')
  })

  it('story() handles codes without spaces', () => {
    expect(routes.story('D2019-011')).toBe('/stories/D2019-011')
  })

  // ── character ─────────────────────────────────────────────────────────

  it('character() encodes a simple charactercode', () => {
    expect(routes.character('Donald')).toBe('/characters/Donald')
  })

  it('character() encodes a charactercode with spaces', () => {
    expect(routes.character('Uncle Scrooge')).toBe('/characters/Uncle+Scrooge')
  })

  // ── author ────────────────────────────────────────────────────────────

  it('author() encodes a name with spaces', () => {
    expect(routes.author('Carl Barks')).toBe('/authors/Carl+Barks')
  })

  it('author() encodes a single-word name', () => {
    expect(routes.author('Rosa')).toBe('/authors/Rosa')
  })

  // ── publisher ─────────────────────────────────────────────────────────

  it('publisher() encodes a publisher id', () => {
    expect(routes.publisher('Disney Egmont')).toBe('/publishers/Disney+Egmont')
  })

  // ── country ───────────────────────────────────────────────────────────

  it('country() returns /countries/{code}', () => {
    expect(routes.country('fr')).toBe('/countries/fr')
    expect(routes.country('de')).toBe('/countries/de')
  })

  // ── publication ───────────────────────────────────────────────────────

  it('publication() keeps the country/publication hierarchy browsable', () => {
    // The slash is a real path separator, not an encoded character, so the URL
    // can be shortened by hand down to the country.
    expect(routes.publication('de/LTB')).toBe('/countries/de/LTB')
  })

  // ── issue ─────────────────────────────────────────────────────────────

  it('issue() builds /countries/{country}/{publication}/{number}', () => {
    expect(routes.issue('de/LTB 613')).toBe('/countries/de/LTB/613')
  })

  it('issue() drops the column-alignment padding of the issue code', () => {
    expect(routes.issue('de/LTB  10')).toBe('/countries/de/LTB/10')
    expect(routes.issue('fr/PM  272')).toBe('/countries/fr/PM/272')
  })

  it('issue() keeps a real space inside an issue number as +', () => {
    expect(routes.issue('fr/PM 123 456')).toBe('/countries/fr/PM/123+456')
  })
})
