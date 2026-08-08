/**
 * The gate between the model and the SQL editor.
 *
 * A 1B model asked for SQL will happily wrap it in prose, invent a
 * `inducks_authors` table, or select `s.name` from a table that has no `name`
 * column. None of that must reach the editor, so every answer is extracted down
 * to one statement and checked against the real schema before it is offered.
 *
 * Checks are static and instant — no database round-trip — so a rejected answer
 * can be sent straight back to the model for one repair attempt.
 */

import { DEFAULT_DB_SCHEMA } from "@/lib/defaultSchema";

/** Statements that must never reach a read-only database. */
const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|PRAGMA|VACUUM|REINDEX|GRANT|BEGIN|COMMIT)\b/i;

/**
 * Words that look like columns but are not.
 *
 * SQLite keywords and the functions the model reaches for; without this list
 * every `COUNT` or `DESC` would be reported as an unknown column.
 */
const SQL_WORDS = new Set([
  "select", "from", "where", "join", "inner", "left", "right", "full", "outer", "cross", "on",
  "group", "by", "order", "having", "limit", "offset", "as", "and", "or", "not", "in", "is",
  "null", "like", "glob", "between", "case", "when", "then", "else", "end", "distinct", "all",
  "union", "except", "intersect", "with", "recursive", "asc", "desc", "using", "exists",
  "count", "sum", "avg", "min", "max", "total", "group_concat", "coalesce", "ifnull", "nullif",
  "substr", "substring", "length", "lower", "upper", "trim", "ltrim", "rtrim", "replace",
  "instr", "abs", "round", "cast", "integer", "text", "real", "date", "strftime", "julianday",
  "printf", "format", "iif", "row_number", "rank", "dense_rank", "over", "partition", "true",
  "false", "collate", "nocase", "escape",
]);

export interface SqlProblem {
  kind: "empty" | "not_select" | "forbidden" | "unknown_table" | "unknown_column" | "no_table";
  message: string;
}

export interface GuardResult {
  /** The cleaned statement, present even when problems were found. */
  sql: string;
  problems: SqlProblem[];
  ok: boolean;
}

/** Removes string literals and comments so identifier scanning is not fooled. */
function stripLiteralsAndComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
}

/**
 * Offset of the first token that genuinely opens a statement, or -1.
 *
 * A line-anchored keyword wins outright. Otherwise `SELECT` counts only when a
 * `FROM` follows it, and `WITH` only when it reads as a CTE — enough to tell a
 * query apart from a sentence that happens to contain the word.
 */
function findStatementStart(text: string): number {
  const anchored = text.match(/(^|\n)[ \t]*(SELECT|WITH)\b/i);
  if (anchored) return anchored.index! + anchored[0].length - anchored[2].length;

  const select = text.search(/\bSELECT\b[\s\S]*?\bFROM\b/i);
  if (select !== -1) return select;

  const cte = text.search(/\bWITH\s+[A-Za-z_]\w*\s+AS\s*\(/i);
  return cte;
}

/**
 * Pulls one runnable statement out of whatever the model produced.
 *
 * Handles a fenced block, a fence with no language tag, and the common failure
 * where the model narrates before or after the query.
 */
export function extractSql(raw: string): string {
  if (!raw) return "";

  let text = raw.trim();

  const fenced = text.match(/```(?:sql|sqlite)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  // An unterminated fence: the model started a block and ran out of tokens.
  else if (text.includes("```")) text = text.slice(text.indexOf("```") + 3).replace(/^(sql|sqlite)\b/i, "").trim();

  // Drop any prose preceding the query. The keyword has to actually open a
  // statement: "I cannot help *with* that" is not a CTE, and a bare "select"
  // in a sentence is not a query.
  const start = findStatementStart(text);
  if (start === -1) return "";
  text = text.slice(start);

  // Keep the first statement only; anything after `;` is commentary or a
  // second query the editor would refuse to run anyway.
  const semicolon = text.indexOf(";");
  if (semicolon !== -1) text = text.slice(0, semicolon);

  // Trailing prose with no semicolon: cut at the first line that cannot be SQL.
  const lines = text.split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (kept.length > 0 && trimmed && /^(this|the|note|explanation|cette|la requete|voici|hier|questa)\b/i.test(trimmed)) break;
    kept.push(line);
  }

  return kept.join("\n").trim().replace(/;+$/, "");
}

/** Table names referenced in FROM / JOIN, with their aliases. */
function collectTables(sql: string): { tables: string[]; aliases: Map<string, string> } {
  const tables: string[] = [];
  const aliases = new Map<string, string>();

  const pattern = /\b(?:FROM|JOIN)\s+([A-Za-z_][\w]*)(?:\s+(?:AS\s+)?([A-Za-z_][\w]*))?/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(sql)) !== null) {
    const table = match[1];
    const alias = match[2];
    tables.push(table);
    aliases.set(table.toLowerCase(), table);
    // `FROM x JOIN` — the second capture may swallow a keyword.
    if (alias && !SQL_WORDS.has(alias.toLowerCase())) aliases.set(alias.toLowerCase(), table);
  }

  return { tables: [...new Set(tables)], aliases };
}

/** Result-column aliases (`... AS total`), which are not schema columns. */
function collectResultAliases(sql: string): Set<string> {
  const aliases = new Set<string>();
  const pattern = /\bAS\s+([A-Za-z_][\w]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql)) !== null) aliases.add(match[1].toLowerCase());
  return aliases;
}

/**
 * Checks a statement against the real schema.
 *
 * Unqualified columns are accepted when *any* referenced table has them: fully
 * resolving them would need a parser, and the goal here is catching invention,
 * not ambiguity.
 */
export function validateSql(rawSql: string): GuardResult {
  const sql = rawSql.trim();
  const problems: SqlProblem[] = [];

  if (!sql) {
    return { sql, ok: false, problems: [{ kind: "empty", message: "The model returned no SQL." }] };
  }

  if (!/^\s*(SELECT|WITH)\b/i.test(sql)) {
    problems.push({ kind: "not_select", message: "Only SELECT queries are allowed." });
  }

  const scannable = stripLiteralsAndComments(sql);

  const forbidden = scannable.match(FORBIDDEN);
  if (forbidden) {
    problems.push({
      kind: "forbidden",
      message: `\`${forbidden[0].toUpperCase()}\` is not allowed: the database is read-only.`,
    });
  }

  const { tables, aliases } = collectTables(scannable);
  if (tables.length === 0) {
    problems.push({ kind: "no_table", message: "The query references no table." });
    return { sql, ok: false, problems };
  }

  const knownTables = tables.filter((table) => table in DEFAULT_DB_SCHEMA);
  for (const table of tables) {
    if (!(table in DEFAULT_DB_SCHEMA)) {
      problems.push({ kind: "unknown_table", message: `Table \`${table}\` does not exist.` });
    }
  }

  const columnsOf = (table: string) => new Set(DEFAULT_DB_SCHEMA[table] ?? []);
  const allColumns = new Set(knownTables.flatMap((table) => DEFAULT_DB_SCHEMA[table] ?? []));
  const resultAliases = collectResultAliases(scannable);

  // Qualified references are the reliable signal: `p.fullname` names both the
  // table and the column, so an invented column is unambiguous.
  const qualified = /\b([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)\b/g;
  let match: RegExpExecArray | null;
  const reported = new Set<string>();

  while ((match = qualified.exec(scannable)) !== null) {
    const [, qualifier, column] = match;
    if (column === "*") continue;
    const table = aliases.get(qualifier.toLowerCase());
    if (!table || !(table in DEFAULT_DB_SCHEMA)) continue;

    if (!columnsOf(table).has(column)) {
      const key = `${table}.${column}`;
      if (reported.has(key)) continue;
      reported.add(key);
      problems.push({
        kind: "unknown_column",
        message: `Column \`${column}\` does not exist on \`${table}\`.`,
      });
    }
  }

  // Bare identifiers: flagged only when no referenced table has them at all.
  const bare = /(?<![.\w])([A-Za-z_][\w]*)(?!\s*\()(?![\w.])/g;
  while ((match = bare.exec(scannable)) !== null) {
    const word = match[1];
    const lower = word.toLowerCase();
    if (SQL_WORDS.has(lower) || resultAliases.has(lower)) continue;
    if (aliases.has(lower) || word in DEFAULT_DB_SCHEMA) continue;
    if (allColumns.has(word)) continue;
    if (reported.has(word)) continue;
    reported.add(word);
    problems.push({
      kind: "unknown_column",
      message: `\`${word}\` is not a column of any table in the query.`,
    });
  }

  return { sql, problems, ok: problems.length === 0 };
}

/** Appends a LIMIT when the query has none, so the editor cannot be flooded. */
export function ensureLimit(sql: string, limit = 100): string {
  if (!sql) return sql;
  const scannable = stripLiteralsAndComments(sql);
  if (/\bLIMIT\s+\d+/i.test(scannable)) return sql;
  return `${sql.replace(/;+\s*$/, "")} LIMIT ${limit}`;
}

/** Extract, check, and cap in one step. */
export function guardSql(raw: string): GuardResult {
  const extracted = extractSql(raw);
  const result = validateSql(extracted);
  return result.ok ? { ...result, sql: ensureLimit(result.sql) } : result;
}
