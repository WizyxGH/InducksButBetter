import { describe, it, expect } from 'vitest'
import { extractSql, validateSql, ensureLimit, guardSql } from '../sqlGuard'

describe('extractSql', () => {
  it('returns nothing when there is no query at all', () => {
    expect(extractSql('')).toBe('')
    expect(extractSql("I'm sorry, I cannot help with that.")).toBe('')
  })

  it('unwraps a fenced block', () => {
    expect(extractSql('```sql\nSELECT 1\n```')).toBe('SELECT 1')
    expect(extractSql('```\nSELECT 1\n```')).toBe('SELECT 1')
  })

  it('recovers a block the model never closed', () => {
    expect(extractSql('Here you go:\n```sql\nSELECT 1')).toBe('SELECT 1')
  })

  it('drops the prose a small model wraps around the query', () => {
    const raw = "Voici la requête :\n```sql\nSELECT title FROM inducks_storyheader\n```\nCette requête liste les titres."
    expect(extractSql(raw)).toBe('SELECT title FROM inducks_storyheader')
  })

  it('cuts trailing prose that follows an unfenced query', () => {
    const raw = 'SELECT title FROM inducks_storyheader\nThis returns every title.'
    expect(extractSql(raw)).toBe('SELECT title FROM inducks_storyheader')
  })

  it('keeps only the first statement', () => {
    expect(extractSql('SELECT 1; SELECT 2')).toBe('SELECT 1')
  })

  it('keeps a WITH clause', () => {
    expect(extractSql('WITH x AS (SELECT 1) SELECT * FROM x')).toBe('WITH x AS (SELECT 1) SELECT * FROM x')
  })
})

describe('validateSql', () => {
  const valid =
    'SELECT h.title FROM inducks_story s JOIN inducks_storyheader h ON s.storyheadercode = h.storyheadercode'

  it('accepts a query built from real tables and columns', () => {
    expect(validateSql(valid).ok).toBe(true)
  })

  it('rejects an invented table', () => {
    const result = validateSql('SELECT * FROM inducks_authors')
    expect(result.ok).toBe(false)
    expect(result.problems[0]).toMatchObject({ kind: 'unknown_table' })
    expect(result.problems[0].message).toContain('inducks_authors')
  })

  it('rejects a column the table does not have', () => {
    const result = validateSql('SELECT s.name FROM inducks_story s')
    expect(result.ok).toBe(false)
    expect(result.problems).toContainEqual(
      expect.objectContaining({ kind: 'unknown_column', message: expect.stringContaining('name') })
    )
  })

  it('accepts a column reached through its alias', () => {
    expect(validateSql('SELECT p.fullname FROM inducks_person p').ok).toBe(true)
  })

  it('refuses anything that writes', () => {
    for (const sql of ['DELETE FROM inducks_story', 'DROP TABLE inducks_story', 'ATTACH DATABASE x AS y']) {
      expect(validateSql(sql).ok).toBe(false)
    }
  })

  it('refuses a write smuggled after a SELECT', () => {
    const result = validateSql('SELECT 1 FROM inducks_story; DROP TABLE inducks_story')
    expect(result.problems.some((p) => p.kind === 'forbidden')).toBe(true)
  })

  it('does not mistake a keyword or function for a column', () => {
    const sql =
      "SELECT COUNT(DISTINCT s.storycode) AS total FROM inducks_story s WHERE s.title LIKE '%x%' ORDER BY total DESC LIMIT 10"
    const result = validateSql(sql)
    expect(result.problems.filter((p) => p.kind === 'unknown_column')).toEqual([])
  })

  it('does not read identifiers out of string literals', () => {
    const result = validateSql("SELECT h.title FROM inducks_storyheader h WHERE h.title LIKE '%inducks_nope%'")
    expect(result.ok).toBe(true)
  })

  it('reports a query with no table', () => {
    expect(validateSql('SELECT 1').problems[0]).toMatchObject({ kind: 'no_table' })
  })

  it('reports an empty answer', () => {
    expect(validateSql('').problems[0]).toMatchObject({ kind: 'empty' })
  })
})

describe('ensureLimit', () => {
  it('adds a LIMIT when there is none', () => {
    expect(ensureLimit('SELECT 1 FROM inducks_story')).toBe('SELECT 1 FROM inducks_story LIMIT 100')
  })

  it('leaves an existing LIMIT alone', () => {
    expect(ensureLimit('SELECT 1 FROM inducks_story LIMIT 5')).toBe('SELECT 1 FROM inducks_story LIMIT 5')
  })

  it('is not fooled by the word limit inside a string', () => {
    const sql = "SELECT 1 FROM inducks_story WHERE title = 'limit 5'"
    expect(ensureLimit(sql)).toBe(`${sql} LIMIT 100`)
  })
})

describe('guardSql', () => {
  it('turns a chatty answer into a runnable capped query', () => {
    const raw = 'Bien sûr !\n```sql\nSELECT p.fullname FROM inducks_person p\n```'
    const result = guardSql(raw)
    expect(result.ok).toBe(true)
    expect(result.sql).toBe('SELECT p.fullname FROM inducks_person p LIMIT 100')
  })

  it('does not cap a query it is rejecting', () => {
    const result = guardSql('SELECT * FROM inducks_nope')
    expect(result.ok).toBe(false)
    expect(result.sql).not.toContain('LIMIT')
  })
})
