/**
 * Reads bytes out of an SQLite database published as static, fixed-size chunks.
 *
 * Adapted from Jonathan8520/InducksButBetter (src/db/chunkReader.ts). The database
 * (~1.2 GB) is never downloaded whole: it is published as fixed-size chunks, each
 * compressed on its own, and SQLite only asks for the pages a query touches.
 *
 *  - one whole chunk per HTTP request, no Range header. Static hosts disagree on Range
 *    support, and a plain GET is a "simple" CORS request the browser's HTTP cache can
 *    share between workers.
 *  - each chunk is raw-deflate compressed: SQLite text pages shrink about 3x.
 *  - reads are SYNCHRONOUS (the SQLite VFS demands it), hence synchronous
 *    XMLHttpRequest, which is only allowed inside a worker.
 *
 * The chunk layout is written by scripts/split-db.mjs.
 */
import { inflateSync } from "fflate";

export interface Manifest {
  format: "sqlite-chunked-v2";
  /** Fingerprint of the database: the chunk folder, new on every rebuild. */
  version: string;
  /** Chunk folder, relative to the manifest. */
  path: string;
  totalBytes: number;
  chunkBytes: number;
  chunkCount: number;
  pageSize: number;
  compression: "deflate-raw" | "none";
  built?: string;
}

export interface IoStats {
  /** HTTP requests actually sent (memory-cache misses). */
  requests: number;
  /** Bytes received (compressed). */
  bytes: number;
  /** Reads served from the worker's memory cache. */
  hits: number;
}

/** Agreed error message: the database was republished during the visit. */
export const STALE = "DB_STALE";

/** Default memory cap of the decompressed-chunk cache. */
const CACHE_BUDGET = 64 * 1024 * 1024;

export class ChunkReader {
  readonly manifest: Manifest;
  private base: string;
  private cache = new Map<number, Uint8Array>();
  private cachedBytes = 0;
  budget = CACHE_BUDGET;
  stats: IoStats = { requests: 0, bytes: 0, hits: 0 };
  /**
   * True once a chunk has gone missing: the site was republished with a new database
   * and this version is no longer served. The caller must reload the manifest.
   */
  stale = false;

  constructor(manifestUrl: string, manifest: Manifest) {
    const dir = manifestUrl.slice(0, manifestUrl.lastIndexOf("/") + 1);
    this.base = new URL(manifest.path.replace(/\/?$/, "/"), new URL(dir, self.location.href)).href;
    this.manifest = manifest;
  }

  get size(): number {
    return this.manifest.totalBytes;
  }

  /** Null when no chunked database is published (404, or the host's SPA fallback page). */
  static async load(manifestUrl: string): Promise<ChunkReader | null> {
    // The manifest is the only thing to revalidate: chunks live in a per-version
    // folder and never change.
    const res = await fetch(manifestUrl, { cache: "no-cache" });
    if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) return null;
    const manifest = (await res.json()) as Manifest;
    if (manifest.format !== "sqlite-chunked-v2") {
      throw new Error(`unknown manifest format ${manifest.format}`);
    }
    return new ChunkReader(manifestUrl, manifest);
  }

  read(offset: number, length: number): Uint8Array {
    const { chunkBytes, totalBytes } = this.manifest;
    const end = Math.min(offset + length, totalBytes);
    const out = new Uint8Array(length);
    let pos = offset;
    while (pos < end) {
      const index = Math.floor(pos / chunkBytes);
      const chunk = this.chunk(index);
      const inChunk = pos - index * chunkBytes;
      const take = Math.min(end - pos, chunk.length - inChunk);
      if (take <= 0) break;
      out.set(chunk.subarray(inChunk, inChunk + take), pos - offset);
      pos += take;
    }
    return pos - offset === length ? out : out.subarray(0, pos - offset);
  }

  private chunk(index: number): Uint8Array {
    const hit = this.cache.get(index);
    if (hit) {
      this.stats.hits++;
      // Map keeps insertion order: re-inserting makes it an LRU.
      this.cache.delete(index);
      this.cache.set(index, hit);
      return hit;
    }
    const data = this.fetchChunk(index);
    this.cache.set(index, data);
    this.cachedBytes += data.length;
    while (this.cachedBytes > this.budget && this.cache.size > 1) {
      const [oldest, bytes] = this.cache.entries().next().value as [number, Uint8Array];
      this.cache.delete(oldest);
      this.cachedBytes -= bytes.length;
    }
    return data;
  }

  private fetchChunk(index: number): Uint8Array {
    const name = String(index).padStart(5, "0") + ".bin";
    let lastError: unknown;
    // A missed chunk is a failed SQL query: retry before giving up.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", this.base + name, false);
        xhr.responseType = "arraybuffer";
        xhr.send();
        // A missing chunk comes back as a 404, or as the host's SPA fallback page:
        // either way this version of the database no longer exists.
        const type = xhr.getResponseHeader("content-type") ?? "";
        if (xhr.status === 404 || (xhr.status === 200 && type.includes("text/html"))) {
          this.stale = true;
          throw new Error(STALE);
        }
        if (xhr.status !== 200) throw new Error(`HTTP ${xhr.status} ${name}`);
        const raw = new Uint8Array(xhr.response as ArrayBuffer);
        this.stats.requests++;
        this.stats.bytes += raw.length;
        return this.manifest.compression === "deflate-raw" ? inflateSync(raw) : raw;
      } catch (err) {
        lastError = err;
        if (this.stale) break;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  takeStats(): IoStats {
    const s = this.stats;
    this.stats = { requests: 0, bytes: 0, hits: 0 };
    return s;
  }
}
