/**
 * Exposes the quotations (public/datas/quotations.json, produced by apps/cotation)
 * as a real SQL table inside the local SQLite database, so the SQL tab and the
 * AI assistant can query them:
 *
 *   inducks_quotation(issuecode, estimationmin, estimationmax, source, scrapedate)
 *
 * `issuecode` is the canonical Inducks code (same padding as inducks_issue, so a
 * plain join works); rows whose code is unknown to the installed database are
 * dropped. The table is (re)built after every database load when the JSON
 * changed, which takes about a second for ~12 000 rows.
 */
import { executeLocal, getLocalDbStats } from "./localDb"

const META_TABLE = "inducks_quotation_meta"
const BATCH = 400 // 400 rows x 5 params stays far below SQLite's 32 766 bound-parameter limit

let building: Promise<void> | null = null

export function ensureQuotationTable(): Promise<void> {
  if (!building) building = build().catch((e) => { console.warn("quotation table:", e); building = null })
  return building
}

async function build() {
  const url = `${import.meta.env.BASE_URL}datas/quotations.json`
  const res = await fetch(url)
  if (!res.ok) return
  const text = await res.text()
  const version = `${text.length}:${hash(text)}`

  // A remotely read database is immutable, so the table goes in the connection's temp
  // schema instead. Unqualified names resolve to temp first, so `FROM inducks_quotation`
  // in the SQL tab works the same either way. An installed database keeps it in main,
  // where it survives reloads and is only rebuilt when the JSON changes.
  const s = getLocalDbStats()?.storage === "remote" ? "temp" : "main"

  await executeLocal(`CREATE TABLE IF NOT EXISTS ${s}.${META_TABLE} (version TEXT)`)
  const meta = await executeLocal(`SELECT version FROM ${s}.${META_TABLE} LIMIT 1`)
  const tableExists = (await executeLocal(`SELECT name FROM ${s}.sqlite_master WHERE type='table' AND name='inducks_quotation'`)).rows?.length > 0
  if (tableExists && meta.rows?.[0]?.version === version) return

  const raw = JSON.parse(text) as Record<string, [number, number, string, string | null]>
  const entries = Object.entries(raw)

  await executeLocal("DROP TABLE IF EXISTS temp.inducks_quotation_tmp")
  await executeLocal("CREATE TEMP TABLE inducks_quotation_tmp (key TEXT, estimationmin REAL, estimationmax REAL, source TEXT, scrapedate TEXT)")
  for (let i = 0; i < entries.length; i += BATCH) {
    const chunk = entries.slice(i, i + BATCH)
    const placeholders = chunk.map(() => "(?,?,?,?,?)").join(",")
    const args = chunk.flatMap(([key, [min, max, source, date]]) => [key, min, max, source, date])
    await executeLocal({ sql: `INSERT INTO temp.inducks_quotation_tmp VALUES ${placeholders}`, args })
  }

  await executeLocal(`DROP TABLE IF EXISTS ${s}.inducks_quotation`)
  await executeLocal(`CREATE TABLE ${s}.inducks_quotation (
    issuecode TEXT PRIMARY KEY,
    estimationmin REAL,
    estimationmax REAL,
    source TEXT,
    scrapedate TEXT
  )`)
  // Resolve the space-free key to the padded Inducks issuecode in SQL.
  await executeLocal(`INSERT OR IGNORE INTO ${s}.inducks_quotation
    SELECT i.issuecode, t.estimationmin, t.estimationmax, t.source, t.scrapedate
    FROM temp.inducks_quotation_tmp t JOIN main.inducks_issue i ON REPLACE(i.issuecode, ' ', '') = t.key`)
  await executeLocal("DROP TABLE temp.inducks_quotation_tmp")
  await executeLocal(`DELETE FROM ${s}.${META_TABLE}`)
  await executeLocal({ sql: `INSERT INTO ${s}.${META_TABLE} VALUES (?)`, args: [version] })
}

function hash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i += 97) h = (h * 31 + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
