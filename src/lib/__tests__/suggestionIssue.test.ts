// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildSuggestionMailto, SUGGESTION_EMAIL } from '../suggestionIssue';

/** Parses the generated mailto: link back into its parts. */
function parts(url: string) {
  const [scheme, query = ''] = url.split('?');
  const search = new URLSearchParams(query);
  return {
    recipient: scheme.replace(/^mailto:/, ''),
    subject: search.get('subject'),
    body: search.get('body'),
  };
}

describe('buildSuggestionMailto', () => {
  it('addresses the maintainer', () => {
    const url = buildSuggestionMailto('Add a dark mode toggle');
    expect(url.startsWith('mailto:')).toBe(true);
    expect(parts(url).recipient).toBe(SUGGESTION_EMAIL);
  });

  it('derives the subject from the first line', () => {
    const url = buildSuggestionMailto('Search crashes\nSteps: open the app…');
    expect(parts(url).subject).toBe('[InducksButBetter] Search crashes');
  });

  it('keeps the whole message in the body, first line included', () => {
    const message = 'Line one\nLine two';
    expect(parts(buildSuggestionMailto(message)).body).toBe(message);
  });

  it('trims surrounding whitespace', () => {
    const { body, subject } = parts(buildSuggestionMailto('  hello there  '));
    expect(body).toBe('hello there');
    expect(subject).toBe('[InducksButBetter] hello there');
  });

  it('percent-encodes accents, newlines and reserved characters', () => {
    const message = "L'écran d'accueil & les données ??";
    const url = buildSuggestionMailto(message);
    // A raw '&' would truncate the body at the next parameter.
    expect(url).not.toContain('& les');
    expect(parts(url).body).toBe(message);
  });

  it('encodes spaces as %20, never as +', () => {
    // mailto: is not a form payload: a '+' would reach the mail client
    // literally instead of becoming a space.
    const url = buildSuggestionMailto('two words');
    expect(url).toContain('two%20words');
    expect(url).not.toContain('two+words');
  });

  it('truncates an over-long first line in the subject only', () => {
    const message = 'a'.repeat(300);
    const { subject, body } = parts(buildSuggestionMailto(message));
    expect(subject!.length).toBeLessThanOrEqual(80);
    expect(subject!.startsWith('[InducksButBetter] ')).toBe(true);
    expect(body).toHaveLength(300);
  });

  it('survives an empty message without throwing', () => {
    const { subject, body } = parts(buildSuggestionMailto(''));
    expect(subject).toBe('[InducksButBetter] ');
    expect(body).toBe('');
  });
});
