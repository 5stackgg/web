/**
 * Packed prep cores (mapPrepPack.ts) kept in IndexedDB, so opening a map a
 * second time skips the second or two of prep. Keyed by the core's
 * fingerprint; the least recently opened go once the store passes
 * MAX_BYTES. Every failure (private mode, a full disk, no IndexedDB) is
 * quietly a miss: the map is prepped as if nothing were cached.
 */
const DB_NAME = "replay-stage";
/** Buffers by key; the small rows in META decide what to evict. */
const STORE = "prep";
const META = "prep-meta";
const MAX_BYTES = 200 * 1024 * 1024;

type Meta = { key: string; bytes: number; used: number };

let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (!opening) {
    opening = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore(STORE);
          request.result.createObjectStore(META, { keyPath: "key" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return opening;
}

function done(request: IDBRequest | IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    if ("oncomplete" in request) {
      request.oncomplete = () => resolve();
      request.onerror = () => reject(request.error);
      request.onabort = () => reject(request.error);
    } else {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }
  });
}

export async function loadCachedPrep(key: string): Promise<ArrayBuffer | null> {
  try {
    const db = await open();
    if (!db) {
      return null;
    }
    const tx = db.transaction([STORE, META], "readwrite");
    const request = tx.objectStore(STORE).get(key);
    await done(request);
    const buffer = request.result as ArrayBuffer | undefined;
    if (!buffer) {
      return null;
    }
    tx.objectStore(META).put({
      key,
      bytes: buffer.byteLength,
      used: Date.now(),
    } satisfies Meta);
    await done(tx);
    return buffer;
  } catch {
    return null;
  }
}

export async function storeCachedPrep(
  key: string,
  buffer: ArrayBuffer,
): Promise<void> {
  try {
    const db = await open();
    if (!db) {
      return;
    }
    const tx = db.transaction([STORE, META], "readwrite");
    const store = tx.objectStore(STORE);
    const meta = tx.objectStore(META);
    store.put(buffer, key);
    meta.put({
      key,
      bytes: buffer.byteLength,
      used: Date.now(),
    } satisfies Meta);
    // Least recently opened out until the store fits.
    const all = meta.getAll();
    await done(all);
    const rows = (all.result as Meta[]).sort((a, b) => b.used - a.used);
    let total = 0;
    for (const row of rows) {
      total += row.bytes;
      if (total > MAX_BYTES && row.key !== key) {
        store.delete(row.key);
        meta.delete(row.key);
      }
    }
    await done(tx);
  } catch {
    // A full disk or a closed database: the next open just preps again.
  }
}
