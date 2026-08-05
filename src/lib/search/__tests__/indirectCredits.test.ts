import { describe, it, expect } from 'vitest';
import { buildAdvancedSearchQuery } from '../queryBuilder';

/**
 * Inducks marks with `indirect = 'Y'` the items that reuse someone's work
 * without having been made for it — a cover assembled from an existing panel,
 * a painting derived from a comic page. Counting them credited Carl Barks
 * with 4521 items instead of the 2012 he actually worked on, so the reference
 * site offers an opt-in exclusion and so do we.
 */
describe('indirect creator credits', () => {
  const withCreator = (extra: Record<string, unknown> = {}) =>
    buildAdvancedSearchQuery({
      personRoles: [{ id: '1', code: 'CB', role: 'any' }],
      ...extra,
    });

  it('keeps indirect credits by default, like the reference site', () => {
    expect(withCreator().countQuery).not.toContain('indirect');
  });

  it('excludes them when the option is enabled', () => {
    expect(withCreator({ excludeIndirectCreators: true }).countQuery).toContain(
      "sj_p.indirect = 'N'"
    );
  });

  it('accepts the option as the string a URL would carry', () => {
    expect(withCreator({ excludeIndirectCreators: 'true' }).countQuery).toContain("indirect = 'N'");
  });

  it('treats any other value as disabled', () => {
    for (const value of [false, 'false', undefined, null, '']) {
      expect(withCreator({ excludeIndirectCreators: value }).countQuery).not.toContain('indirect');
    }
  });

  it('combines with a specific role rather than replacing it', () => {
    const { countQuery } = buildAdvancedSearchQuery({
      personRoles: [{ id: '1', code: 'CB', role: 'a' }],
      excludeIndirectCreators: true,
    });
    expect(countQuery).toContain('sj_p.plotwritartink LIKE ?');
    expect(countQuery).toContain("sj_p.indirect = 'N'");
  });

  it('applies to every creator of the list', () => {
    const { countQuery } = buildAdvancedSearchQuery({
      personRoles: [
        { id: '1', code: 'CB', role: 'any' },
        { id: '2', code: 'GCa', role: 'w' },
      ],
      excludeIndirectCreators: true,
    });
    expect(countQuery.match(/sj_p\.indirect = 'N'/g)).toHaveLength(2);
  });

  it('adds no clause when no creator is searched', () => {
    expect(buildAdvancedSearchQuery({ excludeIndirectCreators: true }).countQuery).not.toContain(
      'indirect'
    );
  });

  it('binds one parameter per placeholder', () => {
    const { countQuery, countParams } = withCreator({ excludeIndirectCreators: true });
    const placeholders = (countQuery.replace(/'(?:[^']|'')*'/g, "''").match(/\?/g) || []).length;
    expect(countParams).toHaveLength(placeholders);
  });

  it('never binds the flag itself as a parameter', () => {
    // It is a fixed literal, so it must not consume a placeholder.
    expect(withCreator({ excludeIndirectCreators: true }).countParams).toEqual(['CB']);
  });
});
