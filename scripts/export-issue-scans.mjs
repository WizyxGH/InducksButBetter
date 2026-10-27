// Exports, for the InducksScanUploader browser extension, the scan coverage of every issue:
// entries of at least one page (`entirepages >= 1`) vs those with a scan online
// (`inducks_entryurl`, sites other than thumbnails*). Only issues with something missing
// are listed: "<issuecode>\t<scanned>/<scannable>/<pages of the entries without scan>" with
// whitespace collapsed, e.g. "fr/DDD 22\t88/93/37". The extension uses it to flag the issues
// you own that lack scans, and how many pages that represents.
//
// Source: public/datas/inducks.sqlite.gz (built by `pnpm db:build`). Run: `pnpm issue-scans:export`.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const here = path.dirname(fileURLToPath(import.meta.url))
const extDir = ['InducksScansManager', 'InducksScanUploader'].map((d) => path.resolve(here, `../../${d}`)).find((d) => fs.existsSync(d)) || path.resolve(here, '../../InducksScansManager')
const OUT = path.resolve(extDir, 'data/issue-scans.txt.gz')
const collapse = (s) => s.replace(/\s+/g, ' ').trim()

// The database is decompressed to a temporary file (1.2 GB): INDUCKS_TMP picks the drive (C: is often short of space).
const tmp = path.join(process.env.INDUCKS_TMP || os.tmpdir(), `inducks-issue-scans-${process.pid}.sqlite`)
// Streamed: gunzipSync would hold the whole 1.2 GB database in memory and crash Node.
await new Promise((resolve, reject) => fs.createReadStream(SRC).pipe(zlib.createGunzip()).pipe(fs.createWriteStream(tmp)).on('finish', resolve).on('error', reject))
try {
  const db = new DatabaseSync(tmp)
  db.exec('PRAGMA cache_size = -64000; PRAGMA temp_store = MEMORY;')
  db.exec(`
    CREATE TEMP TABLE scanned_entries AS
    SELECT DISTINCT entrycode FROM inducks_entryurl WHERE sitecode NOT LIKE 'thumbnails%';
    CREATE UNIQUE INDEX idx_temp_scanned ON scanned_entries(entrycode);
  `)
  const rows = db.prepare(`
    SELECT
      e.issuecode,
      SUM(CASE WHEN s.entrycode IS NOT NULL THEN CAST(sv.entirepages AS INTEGER) ELSE 0 END) AS pages_online,
      SUM(CAST(sv.entirepages AS INTEGER)) AS total_pages,
      SUM(CASE WHEN s.entrycode IS NULL THEN CAST(sv.entirepages AS INTEGER) ELSE 0 END) AS pages_missing,
      COUNT(s.entrycode) AS scanned_entries,
      COUNT(*) AS entry_count
    FROM inducks_entry e
    JOIN inducks_storyversion sv ON sv.storyversioncode = e.storyversioncode
    LEFT JOIN scanned_entries s ON s.entrycode = e.entrycode
    WHERE CAST(sv.entirepages AS INTEGER) >= 1
    GROUP BY e.issuecode
    HAVING pages_missing > 0
    ORDER BY e.issuecode
  `).all()
  db.close()
  const text = rows.map((r) => `${collapse(r.issuecode)}\t${r.pages_online}/${r.total_pages}/${r.pages_missing}/${r.scanned_entries}/${r.entry_count}`).join('\n') + '\n'
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, zlib.gzipSync(Buffer.from(text, 'utf8'), { level: 9 }))
  console.log(`${rows.length} issues with missing scans -> ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB gz, ${(text.length / 1024).toFixed(0)} KB text)`)
} finally {
  fs.rmSync(tmp, { force: true })
}
