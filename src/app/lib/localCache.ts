/**
 * localCache.ts
 * IndexedDB-based local cache for offline-first data loading.
 * Stores all collection data locally so the app loads instantly,
 * then syncs with the cloud in the background.
 * 
 * Data stored here persists across app restarts but NOT across
 * app uninstall on Android. For uninstall-proof backup, use
 * the Google Drive Cloud Backup feature.
 */

const DB_NAME = "livesync-cache";
const DB_VERSION = 1;
const STORE_NAME = "collections";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
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
