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

  it('publication() returns /countries/{publicationcode}', () => {
    // publicationcode is "de/LTB" — encode replaces spaces with +, '/' stays encoded
    expect(routes.publication('de/LTB')).toBe('/countries/de%2FLTB')
  })

  // ── issue ─────────────────────────────────────────────────────────────

  it('issue() converts first space to slash to build /countries/{cc}/{pub}/{num}', () => {
    // "de/LTB 613" → first space becomes "/" → "de/LTB/613"
    expect(routes.issue('de/LTB 613')).toBe('/countries/de%2FLTB%2F613')
  })

  it('issue() handles issue numbers with additional spaces', () => {
    // "fr/PM 123 456" → first space → slash, remaining → +
    expect(routes.issue('fr/PM 123 456')).toBe('/countries/fr%2FPM%2F123+456')
  })
})
