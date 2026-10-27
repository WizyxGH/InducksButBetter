/**
 * Splits the Inducks database into fixed-size, individually compressed chunks that the
 * browser reads remotely (src/lib/remoteDb/). Port of split_db.py from
 * Jonathan8520/InducksButBetter, reading the .gz we already build so the 1.2 GB
 * uncompressed file never has to exist on disk.
 *
 *   pnpm db:split                                  # public/datas/inducks.sqlite.gz → public/db
 *   pnpm db:split -- --in some.sqlite[.gz] --out dist/db --chunk-kib 256
 *
 * Output:
 *   <out>/manifest.json         a few hundred bytes, revalidated on every visit
 *   <out>/<version>/00000.bin   fixed-size chunks, raw deflate
 *
 * <version> is a fingerprint of the database bytes: a rebuild writes a new folder, so a
 * published chunk never changes and can be cached forever, and a visitor never mixes two
 * versions of the database.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : fallback;
};

const input = path.resolve(opt("--in", path.join(ROOT, "public/datas/inducks.sqlite.gz")));
const outDir = path.resolve(opt("--out", path.join(ROOT, "public/db")));
const chunkBytes = Number(opt("--chunk-kib", 256)) * 1024;
const level = Number(opt("--level", 6));

const human = (n) => {
  for (const unit of ["o", "Ko", "Mo", "Go"]) {
    if (n < 1024) return `${n.toFixed(1)} ${unit}`;
    n /= 1024;
  }
  return `${n.toFixed(1)} To`;
};

if (!fs.existsSync(input)) {
  console.error(`database not found: ${input}\nBuild it first: pnpm db:build`);
  process.exit(1);
}

const source = fs.createReadStream(input, { highWaterMark: 1 << 20 });
const stream = input.endsWith(".gz") ? source.pipe(zlib.createGunzip({ chunkSize: 1 << 20 })) : source;

// Chunks go to a staging folder first: the version is the hash of all the bytes, only
// known at the end, and a half-written folder must never look like a publishable one.
fs.mkdirSync(outDir, { recursive: true });
const staging = fs.mkdtempSync(path.join(outDir, ".staging-"));

const hash = crypto.createHash("sha256");
let pending = Buffer.alloc(0);
let count = 0;
let total = 0;
let written = 0;
let pageSize = 0;
const t0 = Date.now();

function flush(buf) {
  if (count === 0) {
    if (buf.subarray(0, 16).toString("latin1") !== "SQLite format 3\0") {
      throw new Error(`${input} is not an SQLite database`);
    }
    const raw = buf.readUInt16BE(16);
    pageSize = raw === 1 ? 65536 : raw;
    if (chunkBytes % pageSize) throw new Error(`chunk (${chunkBytes}) must be a multiple of the page size (${pageSize})`);
  }
  const payload = zlib.deflateRawSync(buf, { level });
  fs.writeFileSync(path.join(staging, `${String(count).padStart(5, "0")}.bin`), payload);
  written += payload.length;
  count++;
}

try {
  for await (const data of stream) {
    hash.update(data);
    total += data.length;
    pending = pending.length ? Buffer.concat([pending, data]) : data;
    while (pending.length >= chunkBytes) {
      flush(pending.subarray(0, chunkBytes));
      pending = pending.subarray(chunkBytes);
    }
  }
  if (pending.length) flush(pending);
} catch (err) {
  fs.rmSync(staging, { recursive: true, force: true });
  console.error(`split failed: ${err.message}`);
  process.exit(1);
}

const version = hash.digest("hex").slice(0, 12);

// Only the new version and the manifest survive: older chunk folders are what a
// republish deletes, and pages still holding them detect it and reload (DB_STALE).
for (const name of fs.readdirSync(outDir)) {
  const p = path.join(outDir, name);
  if (p !== staging && name !== "manifest.json") fs.rmSync(p, { recursive: true, force: true });
}
fs.renameSync(staging, path.join(outDir, version));

const manifest = {
  format: "sqlite-chunked-v2",
  version,
  path: version,
  totalBytes: total,
  chunkBytes,
  chunkCount: count,
  pageSize,
  compression: "deflate-raw",
  built: new Date().toISOString(),
};
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(`${count} chunks of ${chunkBytes / 1024} Kio, ${human(total)} → ${human(written)} compressed, in ${secs}s`);
console.log(`${path.relative(process.cwd(), outDir)}/manifest.json → version ${version}`);
