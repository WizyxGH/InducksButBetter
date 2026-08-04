// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Guards translation coverage.
 *
 * i18next returns the key itself when a translation is missing, which is how
 * raw keys such as `story.untitled` ended up on screen. These tests fail the
 * build instead, before a user ever sees one.
 */

const LOCALES_DIR = path.resolve(__dirname, '../../public/locales');
const SRC_DIR = path.resolve(__dirname, '..');
const REFERENCE = 'en';

/** i18next resolves `key` to `key_one` / `key_other` when a count is passed. */
const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'];

function flatten(value: unknown, prefix = '', out: Record<string, string> = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else if (prefix) {
    out[prefix] = String(value);
  }
  return out;
}

function walk(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.tsx?$/.test(entry.name) && !full.includes('__tests__')) files.push(full);
  }
  return files;
}

const locales = fs
  .readdirSync(LOCALES_DIR)
  .filter((d) => fs.existsSync(path.join(LOCALES_DIR, d, 'translation.json')));

const bundles = Object.fromEntries(
  locales.map((l) => [
    l,
    flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, l, 'translation.json'), 'utf8'))),
  ])
);

/** Keys referenced with a literal string in the source. */
const usedKeys = (() => {
  const used = new Set<string>();
  const re = /\bt\(\s*(["'])([^"'`]+)\1/g;
  for (const file of walk(SRC_DIR)) {
    const src = fs.readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) used.add(m[2]);
  }
  return [...used];
})();

const resolves = (bundle: Record<string, string>, key: string) =>
  key in bundle || PLURAL_SUFFIXES.some((s) => `${key}${s}` in bundle);

describe('translation bundles', () => {
  it('ships more than one locale', () => {
    expect(locales.length).toBeGreaterThan(1);
    expect(locales).toContain(REFERENCE);
  });

  it.each(locales.filter((l) => l !== REFERENCE))(
    '%s declares every key the reference locale declares',
    (locale) => {
      const missing = Object.keys(bundles[REFERENCE]).filter((k) => !(k in bundles[locale]));
      expect(missing).toEqual([]);
    }
  );

  it.each(locales.filter((l) => l !== REFERENCE))(
    '%s declares no key the reference locale lacks',
    (locale) => {
      const extra = Object.keys(bundles[locale]).filter((k) => !(k in bundles[REFERENCE]));
      expect(extra).toEqual([]);
    }
  );

  it.each(locales)('%s has no empty translation', (locale) => {
    const empty = Object.entries(bundles[locale])
      .filter(([, v]) => v.trim() === '')
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it('uses the same interpolation placeholders across locales', () => {
    const placeholders = (s: string) => (s.match(/\{\{\s*([\w]+)/g) || []).map((p) => p.replace(/\{\{\s*/, '')).sort();

    const mismatches: string[] = [];
    for (const [key, reference] of Object.entries(bundles[REFERENCE])) {
      const expected = placeholders(reference).join(',');
      for (const locale of locales) {
        if (locale === REFERENCE) continue;
        const value = bundles[locale][key];
        if (value !== undefined && placeholders(value).join(',') !== expected) {
          mismatches.push(`${locale}:${key}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('keys used by the code', () => {
  it('finds translation keys in the source', () => {
    expect(usedKeys.length).toBeGreaterThan(100);
  });

  it('resolves every literal key against the reference locale', () => {
    const missing = usedKeys.filter((k) => !resolves(bundles[REFERENCE], k)).sort();
    expect(missing).toEqual([]);
  });

  it('resolves every literal key in every locale', () => {
    const missing: string[] = [];
    for (const locale of locales) {
      for (const key of usedKeys) {
        if (!resolves(bundles[locale], key)) missing.push(`${locale}:${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('source hygiene', () => {
  const sources = walk(SRC_DIR).map((f) => [f, fs.readFileSync(f, 'utf8')] as const);

  it('has no `t("key") || "literal"` fallbacks', () => {
    // These never fire: t() returns the key when a translation is missing, and
    // a key is truthy — so the literal only hid the missing translation.
    const offenders = sources
      .filter(([, src]) => /\bt\((["'])[^"']+\1(?:\s*,\s*\{[^{}]*\})?\)\s*\|\|\s*["'`]/.test(src))
      .map(([f]) => path.relative(SRC_DIR, f));
    expect(offenders).toEqual([]);
  });

  it('has no literal defaultValue on a literal key', () => {
    const offenders = sources
      .filter(([, src]) => /\bt\((["'])[^"']+\1\s*,\s*\{[^{}]*defaultValue:\s*["']/.test(src))
      .map(([f]) => path.relative(SRC_DIR, f));
    expect(offenders).toEqual([]);
  });
});
