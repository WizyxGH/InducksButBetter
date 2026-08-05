import { describe, it, expect } from 'vitest';
import { parseCredits } from '../credits';

describe('parseCredits', () => {
  it('splits writers and artists of a real story', () => {
    // I TL 3000-1
    const { writers, artists } = parseCredits(
      'p:TFa|Tito Faraci;w:TFa|Tito Faraci;a:GCa|Giorgio Cavazzano;i:GCa|Giorgio Cavazzano'
    );

    expect(writers).toEqual([{ code: 'TFa', name: 'Tito Faraci' }]);
    expect(artists).toEqual([{ code: 'GCa', name: 'Giorgio Cavazzano' }]);
  });

  it('keeps a person credited under two roles only once per role', () => {
    const { writers } = parseCredits('p:TFa|Tito Faraci;w:TFa|Tito Faraci');
    expect(writers).toHaveLength(1);
  });

  it('lists several different artists', () => {
    const { artists } = parseCredits('a:GCa|Giorgio Cavazzano;i:LGi|Luca Giorgi');
    expect(artists.map((a) => a.name)).toEqual(['Giorgio Cavazzano', 'Luca Giorgi']);
  });

  it('never leaks the next entry into a name', () => {
    // The comma-separated form produced by GROUP_CONCAT(DISTINCT ...) used to
    // yield names like "Roberto Moscato,w".
    const { writers } = parseCredits('w:Roberto Moscato|Roberto Moscato;a:SZa|Stefano Zanchi');
    expect(writers[0].name).toBe('Roberto Moscato');
    expect(writers[0].name).not.toContain(',');
  });

  it('finds the artist that a comma separator used to hide', () => {
    const { artists } = parseCredits(
      'p:Roberto Moscato|Roberto Moscato;w:Roberto Moscato|Roberto Moscato;a:Stefano Zanchi|Stefano Zanchi;i:Stefano Zanchi|Stefano Zanchi'
    );
    expect(artists).toEqual([{ code: 'Stefano Zanchi', name: 'Stefano Zanchi' }]);
  });

  it.each([
    ['pa', 'both'],
    ['wa', 'both'],
  ])('counts the combined role %s as writer and artist', (role) => {
    const { writers, artists } = parseCredits(`${role}:XX|Someone`);
    expect(writers).toHaveLength(1);
    expect(artists).toHaveLength(1);
  });

  it('drops the Inducks placeholders for unknown and nobody', () => {
    const { writers, artists } = parseCredits('w:?|?;i:-|(no one);a:GCa|Giorgio Cavazzano');
    expect(writers).toEqual([]);
    expect(artists).toEqual([{ code: 'GCa', name: 'Giorgio Cavazzano' }]);
  });

  it('falls back to the code when no name is given', () => {
    expect(parseCredits('w:CB').writers).toEqual([{ code: 'CB', name: 'CB' }]);
  });

  it('keeps a person code that contains spaces', () => {
    expect(parseCredits('a:Stefano Zanchi|Stefano Zanchi').artists[0].code).toBe('Stefano Zanchi');
  });

  it.each([[''], [null], [undefined]])('returns empty lists for %s', (value) => {
    expect(parseCredits(value as any)).toEqual({ writers: [], artists: [] });
  });

  it('ignores malformed entries instead of throwing', () => {
    expect(() => parseCredits(';;garbage;:;w:CB|Carl Barks')).not.toThrow();
    expect(parseCredits(';;garbage;:;w:CB|Carl Barks').writers).toEqual([
      { code: 'CB', name: 'Carl Barks' },
    ]);
  });

  it('is not confused by a comma inside a name', () => {
    const { writers } = parseCredits('w:XX|Doe, John');
    expect(writers).toEqual([{ code: 'XX', name: 'Doe, John' }]);
  });
});

describe('duplicate credits in an issue index', () => {
  // fr/DBG 16 showed "Fabrizio Petrossi, Fabrizio Petrossi": two plain
  // GROUP_CONCATs listed a person once per role, and 'a' and 'i' both land in
  // the artist bucket.
  it('lists an artist credited as both penciller and inker once', () => {
    const { artists } = parseCredits('a:FPe|Fabrizio Petrossi;i:FPe|Fabrizio Petrossi');
    expect(artists).toEqual([{ code: 'FPe', name: 'Fabrizio Petrossi' }]);
  });

  it('lists a writer credited for both plot and script once', () => {
    const { writers } = parseCredits('p:JCh|Joris Chamblain;w:JCh|Joris Chamblain');
    expect(writers).toEqual([{ code: 'JCh', name: 'Joris Chamblain' }]);
  });

  it('still lists two different people in the same bucket', () => {
    const { artists } = parseCredits('a:FPe|Fabrizio Petrossi;i:GCa|Giorgio Cavazzano');
    expect(artists).toHaveLength(2);
  });

  it('keeps a person appearing in both buckets in each of them', () => {
    const { writers, artists } = parseCredits('w:CB|Carl Barks;a:CB|Carl Barks');
    expect(writers).toHaveLength(1);
    expect(artists).toHaveLength(1);
  });
});
