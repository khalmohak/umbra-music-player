export type ScrobbleEntry = {
  id?: number;
  trackId: string;
  title: string;
  artist?: string;
  album?: string;
  albumId?: string;
  coverArt?: string;
  startedAt: number;
  endedAt?: number;
  positionMs: number;
  trackDurationMs?: number;
  skipped: boolean;
  naturalEnd: boolean;
};

const DB_NAME = "umbra";
const STORE = "scrobbles";
const VERSION = 1;

let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const d = (e.target as IDBOpenDBRequest).result;
      if (!d.objectStoreNames.contains(STORE)) {
        const store = d.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("startedAt", "startedAt");
        store.createIndex("trackId", "trackId");
      }
    };
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function addScrobble(entry: Omit<ScrobbleEntry, "id">): Promise<number> {
  const d = await openDb();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).add(entry);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function updateScrobble(id: number, updates: Partial<Omit<ScrobbleEntry, "id">>): Promise<void> {
  const d = await openDb();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const current = getReq.result as ScrobbleEntry;
      if (!current) { resolve(); return; }
      const putReq = store.put({ ...current, ...updates });
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getScrobbles(opts?: { limit?: number; offset?: number }): Promise<ScrobbleEntry[]> {
  const d = await openDb();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, "readonly");
    const index = tx.objectStore(STORE).index("startedAt");
    const results: ScrobbleEntry[] = [];
    const limit = opts?.limit ?? 500;
    let skip = opts?.offset ?? 0;
    const req = index.openCursor(null, "prev");
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (!cursor || results.length >= limit) { resolve(results); return; }
      if (skip > 0) { skip--; cursor.continue(); return; }
      results.push(cursor.value as ScrobbleEntry);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getScrobbleStats(): Promise<{
  totalTracks: number;
  totalListenMs: number;
  todayTracks: number;
  todayListenMs: number;
}> {
  const all = await getScrobbles();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayTs = dayStart.getTime();
  let totalTracks = 0, totalListenMs = 0, todayTracks = 0, todayListenMs = 0;
  for (const s of all) {
    if (s.naturalEnd || !s.skipped) {
      totalTracks++;
      totalListenMs += s.positionMs;
      if (s.startedAt >= dayTs) {
        todayTracks++;
        todayListenMs += s.positionMs;
      }
    }
  }
  return { totalTracks, totalListenMs, todayTracks, todayListenMs };
}

export async function clearScrobbles(): Promise<void> {
  const d = await openDb();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE, "readwrite").objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
