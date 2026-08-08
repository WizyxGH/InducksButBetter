// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildSuggestionIssueUrl, SUGGESTION_ISSUES_URL } from '../suggestionIssue';

/** Parses the generated URL back into its query parameters. */
function params(url: string) {
  const parsed = new URL(url);
  return {
    base: `${parsed.origin}${parsed.pathname}`,
    title: parsed.searchParams.get('title'),
    body: parsed.searchParams.get('body'),
    labels: parsed.searchParams.get('labels'),
  };
}

describe('buildSuggestionIssueUrl', () => {
  it('targets the repository new-issue page', () => {
    const url = buildSuggestionIssueUrl({ type: 'idea', message: 'Add a dark mode toggle' });
    expect(params(url).base).toBe(SUGGESTION_ISSUES_URL);
  });

  it('derives the title from the first line, tagged with the type', () => {
    const url = buildSuggestionIssueUrl({
      type: 'bug',
      message: 'Search crashes\nSteps: open the app…',
    });
    expect(params(url).title).toBe('[bug] Search crashes');
  });

  it('keeps the full message in the body', () => {
    const message = 'Line one\nLine two';
    const url = buildSuggestionIssueUrl({ type: 'idea', message });
    expect(params(url).body).toContain(message);
  });

  it('maps each suggestion type to its repository label', () => {
    expect(params(buildSuggestionIssueUrl({ type: 'idea', message: 'x' })).labels).toBe('enhancement');
    expect(params(buildSuggestionIssueUrl({ type: 'bug', message: 'x' })).labels).toBe('bug');
    expect(params(buildSuggestionIssueUrl({ type: 'db', message: 'x' })).labels).toBe('data');
    expect(params(buildSuggestionIssueUrl({ type: 'other', message: 'x' })).labels).toBe('question');
  });

  it('falls back to "other" for an unknown type', () => {
    const url = buildSuggestionIssueUrl({ type: 'wat', message: 'hello there' });
    expect(params(url).labels).toBe('question');
    expect(params(url).title).toBe('[other] hello there');
  });

  it('credits the optional name in the body', () => {
    const url = buildSuggestionIssueUrl({ type: 'idea', name: 'Donald', message: 'quack' });
    expect(params(url).body).toContain('Submitted by Donald');
  });

  it('stays anonymous when no name is given', () => {
    const url = buildSuggestionIssueUrl({ type: 'idea', message: 'quack' });
    const body = params(url).body!;
    expect(body).toContain('Submitted via the in-app suggestion form');
    expect(body).not.toContain('Submitted by');
  });

  it('percent-encodes accents and special characters', () => {
    const message = "L'écran d'accueil & les données ??";
    const url = buildSuggestionIssueUrl({ type: 'db', message });
    // The raw URL must not leak unencoded reserved characters…
    expect(url).not.toContain('& les');
    // …and must round-trip back to the original text.
    expect(params(url).body).toContain(message);
    expect(params(url).title).toContain("L'écran d'accueil");
  });

  it('truncates an over-long first line in the title', () => {
    const message = 'a'.repeat(300);
    const { title } = params(buildSuggestionIssueUrl({ type: 'idea', message }));
    expect(title!.length).toBeLessThanOrEqual(80);
    expect(title!.startsWith('[idea] ')).toBe(true);
  });
});
