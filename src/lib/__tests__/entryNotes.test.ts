import { describe, it, expect } from 'vitest';
import { getEntryAnnotations, hasEntryAnnotations } from '../entryNotes';

describe('getEntryAnnotations', () => {
  it('returns nothing for a plain entry', () => {
    const a = getEntryAnnotations({});
    expect(hasEntryAnnotations(a)).toBe(false);
    expect(a.notes).toEqual([]);
  });

  it('tolerates a missing row', () => {
    expect(() => getEntryAnnotations(null)).not.toThrow();
    expect(hasEntryAnnotations(getEntryAnnotations(undefined))).toBe(false);
  });

  describe('text fields', () => {
    it('exposes the editorial comment', () => {
      expect(getEntryAnnotations({ entrycomment: 'Sunday page' }).comment).toBe('Sunday page');
    });

    it('exposes changes and minor changes separately', () => {
      const a = getEntryAnnotations({ changes: 'Recoloured', minorchanges: 'New lettering' });
      expect(a.changes).toBe('Recoloured');
      expect(a.minorChanges).toBe('New lettering');
    });

    it('exposes the printed code', () => {
      expect(getEntryAnnotations({ printedcode: 'D 2000-001' }).printedCode).toBe('D 2000-001');
    });

    it('trims surrounding whitespace', () => {
      expect(getEntryAnnotations({ entrycomment: '  spaced  ' }).comment).toBe('spaced');
    });
  });

  describe('changes = "-" means an unaltered reprint', () => {
    // Inducks writes a lone dash rather than a sentence.
    it('becomes a note, not a text field', () => {
      const a = getEntryAnnotations({ changes: '-' });
      expect(a.changes).toBe('');
      expect(a.notes).toContainEqual({ key: 'entry.unaltered_reprint' });
    });
  });

  describe('cut pages', () => {
    it('reports the count when the original length is unknown', () => {
      expect(getEntryAnnotations({ cut: '4' }).notes).toContainEqual({
        key: 'entry.cut',
        params: { count: 4, comment: '' },
      });
    });

    it('reports it against the original length when known', () => {
      expect(getEntryAnnotations({ cut: '4' }, 30).notes).toContainEqual({
        key: 'entry.cut_of_total',
        params: { count: 4, total: 30, comment: '' },
      });
    });

    it('keeps the parenthetical remark', () => {
      expect(getEntryAnnotations({ cut: '2 (last page)' }, 10).notes).toContainEqual({
        key: 'entry.cut_of_total_comment',
        params: { count: 2, total: 10, comment: 'last page' },
      });
    });

    it('accepts a fractional page count', () => {
      const note = getEntryAnnotations({ cut: '1.5' }).notes[0];
      expect(note.params?.count).toBe(1.5);
    });

    it('ignores an unparsable value rather than showing nonsense', () => {
      expect(getEntryAnnotations({ cut: 'unknown' }).notes).toEqual([]);
      expect(getEntryAnnotations({ cut: '0' }).notes).toEqual([]);
    });
  });

  describe('missing panels', () => {
    it("reads 'r' as a whole row", () => {
      expect(getEntryAnnotations({ missingpanels: 'r' }).notes).toContainEqual({
        key: 'entry.missing_row',
      });
    });

    it('reads a number as a panel count', () => {
      expect(getEntryAnnotations({ missingpanels: '3' }).notes).toContainEqual({
        key: 'entry.missing_panels',
        params: { count: 3 },
      });
    });

    it('falls back to the raw value for anything else', () => {
      expect(getEntryAnnotations({ missingpanels: 'several' }).notes).toContainEqual({
        key: 'entry.missing_panels_other',
        params: { value: 'several' },
      });
    });
  });

  describe('boolean flags', () => {
    it.each([
      ['mirrored', 'entry.mirrored'],
      ['sideways', 'entry.sideways'],
    ])('turns %s = Y into a note', (field, key) => {
      expect(getEntryAnnotations({ [field]: 'Y' }).notes).toContainEqual({ key });
    });

    it.each(['N', '', null])('ignores %s', (value) => {
      expect(getEntryAnnotations({ mirrored: value as any }).notes).toEqual([]);
    });

    it('notes an entry included in the one above', () => {
      expect(getEntryAnnotations({ includedinentrycode: 'fr/PM 272a' }).notes).toContainEqual({
        key: 'entry.included_above',
      });
    });
  });

  it('collects several notes at once', () => {
    const a = getEntryAnnotations(
      { changes: '-', cut: '2', missingpanels: 'r', mirrored: 'Y', entrycomment: 'note' },
      20
    );
    expect(a.notes.map((n) => n.key)).toEqual([
      'entry.unaltered_reprint',
      'entry.cut_of_total',
      'entry.missing_row',
      'entry.mirrored',
    ]);
    expect(hasEntryAnnotations(a)).toBe(true);
  });
});
