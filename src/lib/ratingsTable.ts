/**
 * Exposes the Inducks story ratings / Top rankings (public/datas/ratings.json)
 * as a real SQL table inside the local SQLite database, so the search engine,
 * SQL tab, and AI assistant can query them:
 *
 *   inducks_storyrating(storycode, rank, rating, votes)
 */
import { executeLocal, getLocalDbStats } from "./localDb"

const META_TABLE = "inducks_storyrating_meta"
const BATCH = 400

let building: Promise<void> | null = null

export function ensureRatingsTable(): Promise<void> {
  if (!building) building = build().catch((e) => { console.warn("ratings table:", e); building = null })
  return building
}

async function build() {
  const url = `${import.meta.env.BASE_URL}datas/ratings.json`
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    return
  }
  if (!res.ok) return
  const text = await res.text()
  const version = `${text.length}:${hash(text)}`

  const s = getLocalDbStats()?.storage === "remote" ? "temp" : "main"

  await executeLocal(`CREATE TABLE IF NOT EXISTS ${s}.${META_TABLE} (version TEXT)`)
  const meta = await executeLocal(`SELECT version FROM ${s}.${META_TABLE} LIMIT 1`)
  const tableExists = (await executeLocal(`SELECT name FROM ${s}.sqlite_master WHERE type='table' AND name='inducks_storyrating'`)).rows?.length > 0
  if (tableExists && meta.rows?.[0]?.version === version) return

  let raw: Array<{ storycode: string; rank: number; rating: number | null; votes: number | null }>
  try {
    raw = JSON.parse(text)
  } catch {
    return
  }
  if (!Array.isArray(raw)) return

  await executeLocal("DROP TABLE IF EXISTS temp.inducks_storyrating_tmp")
  await executeLocal("CREATE TEMP TABLE inducks_storyrating_tmp (storycode TEXT, rank INTEGER, rating REAL, votes INTEGER)")
  for (let i = 0; i < raw.length; i += BATCH) {
    const chunk = raw.slice(i, i + BATCH)
    const placeholders = chunk.map(() => "(?,?,?,?)").join(",")
    const args = chunk.flatMap(r => [r.storycode, r.rank, r.rating, r.votes])
    await executeLocal({ sql: `INSERT INTO temp.inducks_storyrating_tmp VALUES ${placeholders}`, args })
  }

  await executeLocal(`DROP TABLE IF EXISTS ${s}.inducks_storyrating`)
  await executeLocal(`CREATE TABLE ${s}.inducks_storyrating (
    storycode TEXT PRIMARY KEY,
    rank INTEGER,
    rating REAL,
    votes INTEGER
  )`)
  await executeLocal(`INSERT OR REPLACE INTO ${s}.inducks_storyrating SELECT DISTINCT storycode, rank, rating, votes FROM temp.inducks_storyrating_tmp`)
  await executeLocal(`CREATE INDEX IF NOT EXISTS ${s}.idx_inducks_storyrating_rank ON inducks_storyrating(rank)`)
  await executeLocal("DROP TABLE IF EXISTS temp.inducks_storyrating_tmp")

  await executeLocal(`DELETE FROM ${s}.${META_TABLE}`)
  await executeLocal({ sql: `INSERT INTO ${s}.${META_TABLE} VALUES (?)`, args: [version] })
}

function hash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i += 97) h = (h * 31 + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
