import { describe, it, expect } from 'vitest';
import { groupCreditsByRole } from '../credits';

const row = (role: string, personcode: string, fullname = personcode) => ({ role, personcode, fullname });

describe('groupCreditsByRole', () => {
  it('produces ONE Art line for two artists instead of two lines', () => {
    const groups = groupCreditsByRole([
      row('a', 'GCa', 'Giorgio Cavazzano'),
      row('i', 'SIn', 'Sandro Zemolin'),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].role).toBe('art');
    expect(groups[0].people.map((p) => p.name)).toEqual(['Giorgio Cavazzano', 'Sandro Zemolin']);
  });

  it('lists a person credited p+w once on the script line', () => {
    const groups = groupCreditsByRole([
      row('p', 'TFa', 'Tito Faraci'),
      row('w', 'TFa', 'Tito Faraci'),
    ]);
    expect(groups).toEqual([
      { role: 'script', people: [{ code: 'TFa', name: 'Tito Faraci' }] },
    ]);
  });

  it('orders the lines script, art, refers-to-creator', () => {
    const groups = groupCreditsByRole([
      row('r', 'CB', 'Carl Barks'),
      row('i', 'DR', 'Don Rosa'),
      row('w', 'DR', 'Don Rosa'),
    ]);
    expect(groups.map((g) => g.role)).toEqual(['script', 'art', 'refers_to_creator']);
  });

  it("maps 'r' to the refers_to_creator bucket (Inducks legend), never a raw code", () => {
    const groups = groupCreditsByRole([row('r', 'CB', 'Carl Barks')]);
    expect(groups).toEqual([
      { role: 'refers_to_creator', people: [{ code: 'CB', name: 'Carl Barks' }] },
    ]);
  });

  it('drops unknown role codes so no raw database code reaches the screen', () => {
    const groups = groupCreditsByRole([row('x', 'ZZ', 'Someone'), row('a', 'GCa', 'Giorgio Cavazzano')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].role).toBe('art');
  });

  it('counts combined pa/wa codes as both writer and artist', () => {
    const groups = groupCreditsByRole([row('pa', 'CB', 'Carl Barks')]);
    expect(groups.map((g) => g.role)).toEqual(['script', 'art']);
  });

  it('drops the Inducks placeholders for unknown and nobody', () => {
    expect(groupCreditsByRole([row('w', '?', '?'), row('a', '-', '(no one)')])).toEqual([]);
  });

  it('keeps the same person on two different lines', () => {
    const groups = groupCreditsByRole([row('w', 'CB', 'Carl Barks'), row('a', 'CB', 'Carl Barks')]);
    expect(groups.map((g) => g.role)).toEqual(['script', 'art']);
    expect(groups[0].people).toHaveLength(1);
    expect(groups[1].people).toHaveLength(1);
  });

  it('falls back to the person code when the name is empty', () => {
    const groups = groupCreditsByRole([{ role: 'w', personcode: 'CB', fullname: '' }]);
    expect(groups[0].people[0].name).toBe('CB');
  });

  it.each([[null], [undefined], [[]]])('returns an empty list for %s', (value) => {
    expect(groupCreditsByRole(value as any)).toEqual([]);
  });
});
