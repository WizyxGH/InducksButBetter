/**
 * Prompt construction for the SQL assistant.
 *
 * Written in English on purpose. The instruction-following of a 1B model is
 * markedly better in English, and the language of the *question* is handled by
 * an explicit rule rather than by writing the prompt in that language — which
 * is what previously made the model reply in French prose instead of SQL.
 *
 * The prompt stays deliberately small: only the tables the question needs, and
 * only the joins between them. Fewer tokens means both fewer invented columns
 * and a faster first token.
 */

import { DEFAULT_DB_SCHEMA } from "@/lib/defaultSchema";
import { relationsWithin, selectRelevantTables } from "./schemaGraph";
import type { GuardResult } from "./sqlGuard";

/** Columns worth showing first when a table has many. */
const MAX_COLUMNS_PER_TABLE = 14;

export function formatSchema(tables: string[]): string {
  return tables
    .map((table) => {
      const columns = DEFAULT_DB_SCHEMA[table] ?? [];
      const shown = columns.slice(0, MAX_COLUMNS_PER_TABLE);
      const suffix = columns.length > shown.length ? ", ..." : "";
      return `${table}(${shown.join(", ")}${suffix})`;
    })
    .join("\n");
}

export function formatRelations(tables: string[]): string {
  return relationsWithin(tables)
    .map((r) => `${r.from}.${r.fromColumn} = ${r.to}.${r.toColumn}`)
    .join("\n");
}

/**
 * Two worked examples, kept short.
 *
 * They exist to demonstrate the *shape* of a good answer — bare SQL, real
 * column names, a LIMIT — rather than to cover the query space.
 */
const EXAMPLES = `Question: Stories written or drawn by Carl Barks
SELECT st.title, s.storycode
FROM inducks_story s
JOIN inducks_storyheader st ON s.storyheadercode = st.storyheadercode
JOIN inducks_storyversion sv ON sv.storycode = s.storycode
JOIN inducks_storyjob sj ON sj.storyversioncode = sv.storyversioncode
JOIN inducks_person p ON p.personcode = sj.personcode
WHERE p.fullname LIKE '%Barks%'
LIMIT 100

Question: Combien d'histoires avec Picsou ?
SELECT COUNT(DISTINCT s.storycode) AS total
FROM inducks_story s
JOIN inducks_storyversion sv ON sv.storycode = s.storycode
JOIN inducks_appearance a ON a.storyversioncode = sv.storyversioncode
JOIN inducks_character c ON c.charactercode = a.charactercode
WHERE c.charactername LIKE '%Scrooge%'`;

export function buildSystemPrompt(question: string): string {
  const tables = selectRelevantTables(question);

  return `You translate questions about the Inducks Disney comics database into SQLite queries.

TABLES (these are the only ones that exist):
${formatSchema(tables)}

JOINS:
${formatRelations(tables)}

${EXAMPLES}

RULES:
1. The question may be in any language. Understand it, but never answer in words.
2. Output ONE SQLite SELECT statement and nothing else. No prose, no explanation, no markdown fence, no trailing semicolon.
3. Use only the tables and columns listed above. If a column is not listed, it does not exist — never invent one.
4. Story titles live in inducks_storyheader.title, not in inducks_story.
5. Match names with LIKE '%...%' — the data is not normalised.
6. Always end with LIMIT 100 unless the question asks for a single count.`;
}

/** The user turn: the question, restated so the model cannot drift into chat. */
export function buildUserPrompt(question: string): string {
  return `${question}\n\nSQL:`;
}

/**
 * Follow-up sent when the guard rejected an answer.
 *
 * Names the exact fault: a small model corrects "column X does not exist on Y"
 * far more reliably than a generic "that was wrong".
 */
export function buildRepairPrompt(previousSql: string, result: GuardResult): string {
  const faults = result.problems.map((p) => `- ${p.message}`).join("\n");
  return `That query is invalid:

${previousSql}

Problems:
${faults}

Rewrite it using only the tables and columns from the list. Output the corrected SQL statement and nothing else.

SQL:`;
}
