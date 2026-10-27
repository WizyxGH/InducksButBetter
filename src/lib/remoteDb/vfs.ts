/**
 * Read-only SQLite VFS fed by a ChunkReader.
 *
 * Adapted from Jonathan8520/InducksButBetter (src/db/vfs.ts). Plugs into the VFS layer
 * of @sqlite.org/sqlite-wasm. Worker-only, since reads go through synchronous
 * XMLHttpRequest. The database is immutable: any write returns SQLITE_READONLY rather
 * than failing silently.
 */
import type { ChunkReader } from "./chunkReader";

// The sqlite3 module is not finely typed by the package; handled as-is.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sqlite3 = any;

export const VFS_NAME = "ibb-http";

let installed = false;
let current: ChunkReader | null = null;

/** Points the VFS at a reader; installs it on first call. */
export function installVfs(sqlite3: Sqlite3, reader: ChunkReader): void {
  current = reader;
  if (installed) return;

  const { capi, wasm } = sqlite3;
  const io = new capi.sqlite3_io_methods();
  const vfs = new capi.sqlite3_vfs();

  const ioMethods = {
    xClose: () => 0,
    xRead: (_file: number, dest: number, n: number, offset: number | bigint) => {
      try {
        const bytes = current!.read(Number(offset), n);
        const heap = wasm.heap8u();
        if (bytes.length < n) {
          heap.fill(0, dest, dest + n);
          heap.set(bytes, dest);
          return capi.SQLITE_IOERR_SHORT_READ;
        }
        heap.set(bytes, dest);
        return 0;
      } catch (err) {
        console.error("[vfs] read", err);
        return capi.SQLITE_IOERR_READ;
      }
    },
    xWrite: () => capi.SQLITE_READONLY,
    xTruncate: () => capi.SQLITE_READONLY,
    xSync: () => 0,
    xFileSize: (_file: number, out: number) => {
      wasm.poke64(out, BigInt(current!.size));
      return 0;
    },
    xLock: () => 0,
    xUnlock: () => 0,
    xCheckReservedLock: (_file: number, out: number) => {
      wasm.poke32(out, 0);
      return 0;
    },
    xFileControl: () => capi.SQLITE_NOTFOUND,
    xSectorSize: () => 4096,
    // IMMUTABLE: SQLite need not re-read the header nor look for a journal.
    xDeviceCharacteristics: () =>
      capi.SQLITE_IOCAP_IMMUTABLE | capi.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN,
  };

  const vfsMethods = {
    xOpen: (_vfs: number, _name: number, file: number, flags: number, outFlags: number) => {
      if (!current) return capi.SQLITE_CANTOPEN;
      if (flags & (capi.SQLITE_OPEN_MAIN_JOURNAL | capi.SQLITE_OPEN_WAL)) {
        return capi.SQLITE_CANTOPEN;
      }
      wasm.poke32(file, io.pointer);
      if (outFlags) wasm.poke32(outFlags, capi.SQLITE_OPEN_READONLY);
      return 0;
    },
    xDelete: () => capi.SQLITE_READONLY,
    xAccess: (_vfs: number, _name: number, _flags: number, out: number) => {
      wasm.poke32(out, 0);
      return 0;
    },
    xFullPathname: (_vfs: number, name: number, nOut: number, out: number) => {
      const str = (wasm.cstrToJs(name) as string) || "";
      const bytes = new TextEncoder().encode(str.slice(0, Math.max(0, nOut - 1)));
      const heap = wasm.heap8u();
      heap.set(bytes, out);
      heap[out + bytes.length] = 0;
      return 0;
    },
    xRandomness: (_vfs: number, n: number, out: number) => {
      const heap = wasm.heap8u();
      for (let i = 0; i < n; i++) heap[out + i] = (Math.random() * 256) | 0;
      return n;
    },
    xSleep: () => 0,
    xCurrentTimeInt64: (_vfs: number, out: number) => {
      wasm.poke64(out, BigInt(Date.now()) + 210866760000000n);
      return 0;
    },
    xCurrentTime: (_vfs: number, out: number) => {
      wasm.poke(out, Date.now() / 86400000 + 2440587.5, "double");
      return 0;
    },
  };

  vfs.$iVersion = 2;
  vfs.$szOsFile = capi.sqlite3_file.structInfo.sizeof;
  vfs.$mxPathname = 1024;
  vfs.$zName = wasm.allocCString(VFS_NAME);

  sqlite3.vfs.installVfs({
    io: { struct: io, methods: ioMethods },
    vfs: { struct: vfs, methods: vfsMethods, asDefault: false },
  });
  installed = true;
}
