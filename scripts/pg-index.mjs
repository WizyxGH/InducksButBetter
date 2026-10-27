// Detects, completes and reports the `[pg;N-M]` page numbering of the Inducks
// entries, and builds the alphabetical character index of the issues that carry
// one. Fully deterministic: no AI, no OCR.
//
// The `[pg;…]` tag lives in `inducks_entry.entrycomment`, one range per entry. It
// is present on only 7.6 % of the 2 025 902 entries, spread over 11 459 of the
// 251 279 issues, so most issues have nothing to do here. The point of this script
// is to say exactly which issues are recoverable, and to leave the rest alone.
//
//   node pg-index.mjs detect     -> report only (writes data/pg-report.json)
//   node pg-index.mjs complete   -> report + data/pg-completed.json (every recovered range)
//   node pg-index.mjs index      -> report + data/pg-charindex.json (per issue, grouped by letter)
//   node pg-index.mjs all        -> the three above
//
// Options: --issue CODE (one issue), --limit N (issues), --json (raw report on stdout).
//
// A range is recovered in this order, and never beyond it:
//   1. `tagged`     — already in entrycomment, copied verbatim
//   2. `cumulative` — sum of `storyversion.entirepages`, accepted only when it agrees
//                     with every range already tagged in the issue (exact on 2 249 of
//                     the 3 821 fully tagged issues)
//   3. `bracketed`  — a gap whose two neighbouring tagged ranges bracket it exactly
// Anything else stays `unresolved`: a wrong page range in a published index is worse
// than a missing one, so this script never guesses.

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const ISV = process.env.ISV_DIR || path.resolve(here, '../inducks_extracted')
const OUT = path.resolve(here, '../data')

const argv = process.argv.slice(2)
const command = argv.find((a) => !a.startsWith('--')) || 'detect'
const flag = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? dflt : argv[i + 1]
}
const has = (name) => argv.includes(`--${name}`)

/**
 * Streams one `.isv` file as objects. Columns are looked up by name in the header,
 * so a dump that reorders its columns cannot silently shift every field here. Rows
 * whose arity does not match the header are skipped rather than reinterpreted.
 */
async function* readIsv(name, pick) {
  const file = path.join(ISV, name)
  if (!fs.existsSync(file)) throw new Error(`missing ${file} — run \`pnpm db:build\` first`)
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'latin1' }), crlfDelay: Infinity })
  let header = null
  let index = null
  for await (const line of rl) {
    if (header === null) {
      header = line.split('^')
      index = {}
      for (const [field, column] of Object.entries(pick)) {
        const i = header.indexOf(column)
        if (i === -1) throw new Error(`${column}: column not found in ${name}`)
        index[field] = i
      }
      continue
    }
    if (!line) continue
    const parts = line.split('^')
    if (parts.length !== header.length) continue
    const row = {}
    for (const field of Object.keys(pick)) row[field] = parts[index[field]]
    yield row
  }
}

// `[pg;12-21]`, `[pg;5]` and the legacy `[pg. 12-21]`. `[pg;cover]` and
// `[pg;9(1st half page)]` are deliberately not ranges — they carry no number.
const TAG = /\[pg[;.]\s*(\d+)\s*(?:-\s*(\d+)\s*)?\]/i

/** The first range in a comment. A comment may hold two tags (`[pg;55-89] [pg;57-89]`): first wins. */
function parseRange(comment) {
  const m = TAG.exec(comment || '')
  if (!m) return null
  const from = Number(m[1])
  const to = m[2] ? Number(m[2]) : from
  // `de/LTB 96n [pg;2247-254]` — a reversed pair is a typo in the source, not a range.
  return to < from ? null : [from, to]
}

/**
 * Reads an integer field, tolerating the free text Inducks puts in some of them:
 * `pages` can be `36 (32 numérotées + 4 couvertures)` and `entirepages` is `-1` for
 * "unknown". A leading integer is taken; anything else is `null`, and `null` never
 * becomes a page count — guessing 0 there would silently shift every later range.
 */
function readInt(value) {
  const m = /(-?\d+)/.exec(value || '')
  if (!m) return null
  const n = Number(m[1])
  return n >= 0 ? n : null // -1 means "unknown", not "minus one page"
}

const fmt = ([a, b]) => (a === b ? String(a) : `${a}-${b}`)

/**
 * Sort key for `position`. It is not lexicographic: `p9` must come before `p10`, and
 * `qa`/`qb` (two entries printed on the same page) must stay adjacent and in that order.
 * So digits compare as numbers and letters rank after them, `a` < `b`.
 */
const positionKey = (pos) => [(Number((pos.match(/\d+/) || ['0'])[0])), (pos.match(/[a-z]+/i) || [''])[0].toLowerCase()]
const cmpPos = (a, b) => {
  const A = positionKey(a), B = positionKey(b)
  if (A[0] !== B[0]) return A[0] - B[0]
  if (A[1] !== B[1]) return A[1] < B[1] ? -1 : 1
  return 0
}
/** Natural order for a page range: "2" < "2-3" < "14". */
const cmpRange = (a, b) => {
  const A = a.split('-').map(Number), B = b.split('-').map(Number)
  return A[0] - B[0] || (A[1] || A[0]) - (B[1] || B[0])
}

// ─────────────────────────────────────────────────────────────── load

const only = flag('issue')
const limit = Number(flag('limit', 0)) || Infinity

console.error('reading issues…')
/** issuecode -> printed page count, or null when Inducks does not state it. */
const issues = new Map()
for await (const r of readIsv('inducks_issue.isv', { code: 'issuecode', pages: 'pages' })) {
  if (only && r.code !== only) continue
  issues.set(r.code, readInt(r.pages))
}

console.error(`reading storyversion (${issues.size} issues in scope)…`)
/** storyversioncode -> page count, or null when unknown (`entirepages` = -1). */
const entirepages = new Map()
for await (const r of readIsv('inducks_storyversion.isv', { code: 'storyversioncode', pages: 'entirepages' })) {
  entirepages.set(r.code, readInt(r.pages))
}

console.error('reading entries…')
/** issuecode -> entries, in reading order once sorted. */
const byIssue = new Map()
for await (const r of readIsv('inducks_entry.isv', {
  code: 'entrycode', issue: 'issuecode', pos: 'position', comment: 'entrycomment', sv: 'storyversioncode',
})) {
  if (!issues.has(r.issue)) continue
  let list = byIssue.get(r.issue)
  if (!list) byIssue.set(r.issue, (list = []))
  list.push(r)
}
for (const list of byIssue.values()) {
  list.sort((a, b) => {
    // An entry with no position goes last rather than in the middle of the reading order.
    if (!a.pos !== !b.pos) return a.pos ? -1 : 1
    return cmpPos(a.pos || '', b.pos || '') || (a.code < b.code ? -1 : 1)
  })
}

// ───────────────────────────────────────────── detection + completion

const report = []

for (const [issuecode, entries] of byIssue) {
  if (report.length >= limit) break
  const iss = { issuecode, pages: issues.get(issuecode) ?? null, entries: entries.length }
  // `entirepages` is -1 for "unknown" on 3 003 story versions; a null here disables the
  // cumulative method rather than silently counting the entry as a zero-page one.
  const ep = entries.map((e) => entirepages.get(e.sv) ?? null)
  const epKnown = ep.every((n) => n !== null)
  if (!epKnown) iss.unknownPageCounts = ep.filter((n) => n === null).length
  const ranges = entries.map((e) => parseRange(e.comment))
  const from = ranges.map((r) => (r ? 'tagged' : null))
  iss.tagged = ranges.filter(Boolean).length

  if (iss.tagged === 0) { iss.status = 'untagged'; report.push(iss); continue }

  // (2) cumulative sum of entirepages, offered only if it reproduces every tagged range.
  const sum = ep.reduce((a, b) => a + (b ?? 0), 0)
  let cursor = 0
  const cumulative = ep.map((n) => [cursor + 1, (cursor += n ?? 0)])
  const cumulativeAgrees = epKnown && ranges.every((r, i) => !r || (r[0] === cumulative[i][0] && r[1] === cumulative[i][1]))
  if (cumulativeAgrees && iss.tagged >= 2) {
    for (let i = 0; i < entries.length; i++) if (!ranges[i]) { ranges[i] = cumulative[i]; from[i] = 'cumulative' }
    iss.status = 'complete'
  } else {
    // (3) fill a gap only when its two tagged neighbours bracket it exactly.
    const fillGap = (i) => {
      let lo = i - 1
      while (lo >= 0 && !ranges[lo]) lo--
      let hi = i + 1
      while (hi < entries.length && !ranges[hi]) hi++
      if (lo < 0 || hi >= entries.length) return // unbracketed at either end
      if (ep.slice(lo + 1, hi).some((n) => n === null)) return // an unknown count would fake the width
      const width = ep.slice(lo + 1, hi).reduce((a, b) => a + b, 0)
      if (ranges[hi][0] - ranges[lo][1] - 1 !== width) return // the anchors disagree with entirepages
      // Every entry but the last takes its entirepages; the last absorbs the remainder,
      // which is what an entry with `entirepages` = 0 printed on a shared page needs.
      let at = ranges[lo][1]
      for (let k = lo + 1; k < hi; k++) {
        const take = k === hi - 1 ? ranges[hi][0] - 1 - at : ep[k]
        ranges[k] = [at + 1, at + take]
        from[k] = 'bracketed'
        at += take
      }
    }
    for (let i = 0; i < entries.length; i++) if (!ranges[i]) fillGap(i)
    iss.status = ranges.every(Boolean) ? 'complete' : 'partial'
  }

  iss.method = [...new Set(from.filter(Boolean))].join('+')
  if (iss.status === 'complete') {
    iss.ranges = entries.map((e, i) => ({ code: e.code, pos: e.pos || null, pg: fmt(ranges[i]), from: from[i] }))
  } else {
    iss.unresolved = entries.filter((_, i) => !ranges[i]).map((e) => e.code)
  }

  // Inconsistencies with the source, reported and never acted on: the real fix belongs
  // in the dump, and guessing here would only launder it.
  const lastTagged = Math.max(...ranges.filter(Boolean).map((r) => r[1]))
  if (iss.pages !== null && sum !== iss.pages) iss.sumMismatch = `entirepages ${sum} != pages ${iss.pages}`
  if (iss.pages !== null && lastTagged > iss.pages) iss.overflow = `last tagged page ${lastTagged} > pages ${iss.pages}`
  if (iss.pages === null) iss.pagesUnknown = true
  if (entries.some((e) => /\[part[;\]]/.test(e.comment || ''))) iss.hasPart = true
  // Ranges that run backwards into the previous entry. On the current dump this only ever
  // happens on `tagged` ranges (277 issues, e.g. `fi/AA2024-14` where `d 13-22` is followed by
  // `e 14-28`), i.e. the tag itself is wrong upstream — worth surfacing, not fixing here.
  if (iss.status === 'complete') {
    let previousEnd = 0
    for (const r of iss.ranges) {
      const [a, b] = r.pg.split('-').map(Number)
      if (a < previousEnd + 1 && a !== previousEnd) {
        iss.overlappingPages = `${r.pos} starts on ${a}, page ${previousEnd} already used`
        break
      }
      previousEnd = b
    }
  }

  report.push(iss)
}

// ─────────────────────────────────────── alphabetical character index

let charIndex = null
if (command === 'index' || command === 'all') {
  console.error('building the alphabetical index…')
  // Only the issues whose ranges are all known: an index citing a wrong page is the
  // exact failure this script exists to avoid.
  const usable = report.filter((r) => r.status === 'complete')
  const wantedSv = new Set() // story versions appearing in a usable issue
  const svOfEntry = new Map() // entrycode -> storyversioncode
  for (const iss of usable) {
    for (const e of byIssue.get(iss.issuecode)) { svOfEntry.set(e.code, e.sv); wantedSv.add(e.sv) }
  }

  const charName = new Map()
  for await (const r of readIsv('inducks_character.isv', { code: 'charactercode', name: 'charactername' })) charName.set(r.code, r.name)

  console.error(`reading appearances (${wantedSv.size} story versions in scope)…`)
  const appear = new Map() // storyversioncode -> Set(charactercode)
  for await (const r of readIsv('inducks_appearance.isv', { sv: 'storyversioncode', ch: 'charactercode' })) {
    if (!wantedSv.has(r.sv)) continue // millions of appearances, almost all out of scope
    if (!appear.has(r.sv)) appear.set(r.sv, new Set())
    appear.get(r.sv).add(r.ch)
  }

  charIndex = usable.map((iss) => {
    const pgOfEntry = new Map(iss.ranges.map((r) => [r.code, r.pg]))
    const byLetter = new Map() // letter -> Map(name -> Set(pg))
    for (const e of byIssue.get(iss.issuecode)) {
      const pg = pgOfEntry.get(e.code)
      if (!pg) continue
      for (const ch of appear.get(e.sv) || []) {
        const name = charName.get(ch)
        if (!name) continue
        const letter = name[0].toUpperCase()
        if (!byLetter.has(letter)) byLetter.set(letter, new Map())
        const names = byLetter.get(letter)
        if (!names.has(name)) names.set(name, new Set())
        names.get(name).add(pg)
      }
    }
    const letters = {}
    for (const letter of [...byLetter.keys()].sort()) {
      const names = byLetter.get(letter)
      letters[letter] = Object.fromEntries([...names.keys()].sort().map((n) => [n, [...names.get(n)].sort(cmpRange)]))
    }
    return {
      issuecode: iss.issuecode,
      entries: iss.entries,
      characters: Object.values(letters).reduce((a, g) => a + Object.keys(g).length, 0),
      letters,
    }
  })
}

// ─────────────────────────────────────────────────────────────── output

const tally = (rows, key) => rows.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] || 0) + 1), acc), {})
const counts = tally(report, 'status')
const methods = tally(report.filter((r) => r.method), 'method')
const taggedIssues = report.filter((r) => r.tagged > 0)
const complete = report.filter((r) => r.status === 'complete')

if (has('json')) {
  console.log(JSON.stringify({ counts, methods, report }, null, 2))
} else {
  console.log(`issues in scope                  : ${report.length}`)
  console.log(`issues with a [pg;] tag          : ${taggedIssues.length}`)
  console.log(`  untagged — nothing to do       : ${counts.untagged || 0}`)
  console.log(`  complete — every range known   : ${complete.length}`)
  console.log(`  partial  — some unresolved     : ${counts.partial || 0}`)
  console.log('\nhow the complete ones were filled:')
  for (const [k, v] of Object.entries(methods).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(6)}  ${k}`)

  const flagged = report.filter((r) => r.sumMismatch || r.overflow || r.hasPart || r.overlappingPages)
  if (flagged.length) {
    console.log(`\n${flagged.length} issues carry a data inconsistency (reported, not fixed):`)
    for (const r of flagged.slice(0, 10)) {
      console.log(`  ${r.issuecode.padEnd(20)} ${[r.sumMismatch, r.overflow, r.overlappingPages, r.hasPart && 'part entries'].filter(Boolean).join('; ')}`)
    }
    if (flagged.length > 10) console.log(`  … and ${flagged.length - 10} more`)
  }
}

const write = (name, data) => {
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 1))
  console.error(`-> ${path.relative(process.cwd(), path.join(OUT, name))}`)
}

if (command === 'complete' || command === 'all') write('pg-completed.json', complete)
if (charIndex) write('pg-charindex.json', charIndex)
// Every command reports the tagged issues, so `all` leaves the three files consistent.
write('pg-report.json', taggedIssues)
