/**
 * localCache.ts
 * IndexedDB-based local cache for offline-first data loading.
 * Stores all collection data locally so the app loads instantly,
 * then syncs with the cloud in the background.
 *
 * Also stores the Supabase auth session so the app works
 * offline after first login — no network needed on cold start.
 *
 * Data stored here persists across app restarts AND app updates. Every write
 * is also mirrored to native SharedPreferences (durableStore.ts) and restored
 * automatically if the WebView storage is ever missing after an update.
 * Uninstalling removes app data; Android Auto Backup (Google account) and the
 * Google Drive backup feature cover that case.
 */
import { mirrorWrite, mirrorClear, reconcile, seedMirror, installLifecycleFlush } from "./durableStore";

const DB_NAME = "livesync-cache";
const DB_VERSION = 1;
const STORE_NAME = "collections";
const AUTH_SESSION_KEY = "__auth_session__";
const CACHED_USER_ID_KEY = "__cached_user_id__";

let dbPromise: Promise<IDBDatabase> | null = null;
let readyPromise: Promise<IDBDatabase> | null = null;

/**
 * Data-format version stored on the device. When a future app version changes
 * how something is stored, add a step to MIGRATIONS — it runs once on the
 * user's existing data during the update, so nothing is ever lost or reset.
 */
export const SCHEMA_VERSION = 1;
const SCHEMA_KEY = "__schema_version__";
const MIGRATIONS: Record<number, (get: (k: string) => Promise<any>, put: (k: string, v: any) => Promise<void>) => Promise<void>> = {
  // 1: baseline — on-device storage introduced in v2.4.0. Nothing to transform.
  1: async () => {},
};

/**
 * Open IndexedDB and, once per launch, make the data update-proof:
 *  1. restore anything missing from the native SharedPreferences mirror,
 *  2. run pending data migrations for this app version,
 *  3. make sure the mirror holds a full copy.
 * Every read and write waits for this, so the app never sees a half-restored state.
 */
function openDB(): Promise<IDBDatabase> {
  if (readyPromise) return readyPromise;
  readyPromise = rawOpen().then(async (db) => {
    const get = (k: string) => rawGet(db, k);
    const put = (k: string, v: any) => rawPut(db, k, v);
    try {
      await reconcile(get, put);
      const stored = await get(SCHEMA_KEY);
      const from = Array.isArray(stored) ? Number(stored[0]) || 0 : 0;
      for (let v = from + 1; v <= SCHEMA_VERSION; v++) {
        await MIGRATIONS[v]?.(get, put);
      }
      if (from !== SCHEMA_VERSION) await put(SCHEMA_KEY, [SCHEMA_VERSION]);
      const keys = await rawKeys(db);
      const entries: Array<[string, unknown]> = [];
      for (const k of keys) entries.push([String(k), await get(String(k))]);
      void seedMirror(entries);
      installLifecycleFlush();
    } catch (e) {
      console.warn("[localCache] startup reconcile failed (non-fatal)", e);
    }
    return db;
  });
  return readyPromise;
}

function rawGet(db: IDBDatabase, key: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => reject(r.error);
  });
}
function rawPut(db: IDBDatabase, key: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function rawKeys(db: IDBDatabase): Promise<IDBValidKey[]> {
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAllKeys();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function rawOpen(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn("IndexedDB open failed:", request.error);
      reject(request.error);
    };
  });
  return dbPromise;
}

/**
 * Save an array of items for a collection to the local cache.
 */
export async function saveToCache<T>(collection: string, items: T[]): Promise<void> {
  mirrorWrite(collection, items); // native copy that survives app updates
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(items, collection);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn(`Cache write failed for ${collection}:`, e);
  }
}

/**
 * Load cached items for a collection from IndexedDB.
 * Returns null if no cache exists (first launch).
 */
export async function loadFromCache<T>(collection: string): Promise<T[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(collection);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn(`Cache read failed for ${collection}:`, e);
    return null;
  }
}

/**
 * Clear all cached data. Called on sign-out to prevent data leakage.
 */
export async function clearCache(): Promise<void> {
  await mirrorClear();
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("Cache clear failed:", e);
  }
}

// ── Auth session persistence ─────────────────────────────────────────────────

/**
 * Persist the Supabase session object to IndexedDB so the app can skip
 * the network call on every cold start and work fully offline.
 */
export async function saveAuthSession(session: unknown): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(session, AUTH_SESSION_KEY);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  } catch (e) {
    console.warn("saveAuthSession failed:", e);
  }
}

/** Read the cached session back (returns null if nothing stored). */
export async function loadAuthSession(): Promise<any | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(AUTH_SESSION_KEY);
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror  = () => rej(req.error);
    });
  } catch (e) {
    console.warn("loadAuthSession failed:", e);
    return null;
  }
}

/** Remove the stored session (called on sign-out). */
export async function clearAuthSession(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(AUTH_SESSION_KEY);
    tx.objectStore(STORE_NAME).delete(CACHED_USER_ID_KEY);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  } catch (e) {
    console.warn("clearAuthSession failed:", e);
  }
}

/** Cache the userId string for offline encryption key derivation. */
export async function saveCachedUserId(userId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(userId, CACHED_USER_ID_KEY);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  } catch (e) {
    console.warn("saveCachedUserId failed:", e);
  }
}

/** Read the cached userId (for offline encryption). */
export async function loadCachedUserId(): Promise<string | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(CACHED_USER_ID_KEY);
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result ?? null);
      req.onerror  = () => rej(req.error);
    });
  } catch (e) {
    console.warn("loadCachedUserId failed:", e);
    return null;
  }
}

/**
 * Export all cached data as a single JSON object.
 * Used by the Google Drive backup feature.
 */
export async function exportAllCacheData(): Promise<Record<string, any[]>> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const result: Record<string, any[]> = {};
    for (const key of keys) {
      const data = await new Promise<any>((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (Array.isArray(data)) {
        result[String(key)] = data;
      }
    }
    return result;
  } catch (e) {
    console.warn("Export cache failed:", e);
    return {};
  }
}

/**
 * Import data into the local cache (from a backup restore).
 */
export async function importToCacheData(data: Record<string, any[]>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const [key, items] of Object.entries(data)) {
      if (Array.isArray(items)) {
        store.put(items, key);
        mirrorWrite(key, items);
      }
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("Import to cache failed:", e);
  }
}
