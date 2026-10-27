/**
 * Argus-style quotations for issues, produced by apps/cotation
 * (`node scripts/export-quotations-json.cjs`) into public/datas/quotations.json.
 *
 * Keys are issuecodes with every space removed - Inducks pads issue numbers per
 * publication ("fr/JM   36", "de/DD 141"), so callers never need to know the
 * padding. Loaded once, lazily, on the first issue page that asks.
 */
export interface Quotation {
  min: number
  max: number
  /** bdm | bedetheque | pricecharting | comicguide | comicsmania | seriesam */
  source: string
  date: string | null
}

type Raw = Record<string, [number, number, string, string | null]>

let table: Promise<Raw> | null = null

function load(): Promise<Raw> {
  if (!table) {
    const url = `${import.meta.env.BASE_URL}datas/quotations.json`
    table = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<Raw>) : {}))
      .catch(() => ({}))
  }
  return table
}

export const normalizeIssuecode = (code: string) => code.replace(/\s+/g, "")

export async function getQuotation(issuecode: string): Promise<Quotation | null> {
  const raw = (await load())[normalizeIssuecode(issuecode)]
  return raw ? { min: raw[0], max: raw[1], source: raw[2], date: raw[3] } : null
}

export const QUOTATION_SOURCE_LABEL: Record<string, string> = {
  bdm: "BDM (argus)",
  bedetheque: "Bedetheque",
  pricecharting: "PriceCharting",
  comicguide: "ComicGuide.de",
  comicsmania: "Comicsmania",
  seriesam: "Seriesams Guide",
}

/** Where each source lives, so the issue page can link to it. */
export const QUOTATION_SOURCE_URL: Record<string, string> = {
  bdm: "https://www.ducksmanager.net",
  bedetheque: "https://www.bedetheque.com",
  pricecharting: "https://www.pricecharting.com",
  comicguide: "https://www.comicguide.de",
  comicsmania: "http://comicsmania.gr",
  seriesam: "https://www.seriesam.com",
}
