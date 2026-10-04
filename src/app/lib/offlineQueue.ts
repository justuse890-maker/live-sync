/**
 * offlineQueue.ts
 * ---------------
 * IndexedDB-backed offline write queue.
 *
 * When the device is offline, any write operation (create / remove) is
 * stored here instead of being dropped.  When connectivity returns the
 * queue is drained in FIFO order against the real API.
 *
 * Each queued operation carries enough information to be replayed:
 *   - collection  : e.g. "transactions", "goals"
 *   - method      : "create" | "remove"
 *   - payload     : the item data  (for create)
 *   - itemId      : the server id  (for remove)
 *   - localId     : the temporary local UUID assigned optimistically
 *   - queuedAt    : ISO timestamp for ordering / debugging
 */

export type QueuedOp = {
  id: string;          // unique op id (local UUID)
  collection: string;
  method: "create" | "remove";
  payload?: Record<string, unknown>;
  itemId?: string;     // for remove ops: the id to delete
  localId?: string;    // optimistic local id (swapped with server id after drain)
  queuedAt: string;
};

const DB_NAME    = "livesync-queue";
const DB_VERSION = 1;
const STORE_NAME = "ops";

let dbPromise: Promise<IDBDatabase> | null = null;

function openQueueDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => { console.warn("OfflineQueue DB open failed:", req.error); reject(req.error); };
  });
  return dbPromise;
}

/** Add an operation to the queue. */
export async function enqueueOp(op: Omit<QueuedOp, "id" | "queuedAt">): Promise<QueuedOp> {
  const full: QueuedOp = { ...op, id: crypto.randomUUID(), queuedAt: new Date().toISOString() };
  try {
    const db = await openQueueDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(full);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  } catch (e) {
    console.warn("OfflineQueue enqueue failed:", e);
  }
  return full;
}

/** Read all pending ops in insertion order. */
export async function loadQueue(): Promise<QueuedOp[]> {
  try {
    const db = await openQueueDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    const items = await new Promise<QueuedOp[]>((res, rej) => {
      req.onsuccess = () => res(req.result ?? []);
      req.onerror   = () => rej(req.error);
    });
    return items.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  } catch (e) {
    console.warn("OfflineQueue load failed:", e);
    return [];
  }
}

/** Remove a single op after it has been successfully replayed. */
export async function dequeueOp(opId: string): Promise<void> {
  try {
    const db = await openQueueDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(opId);
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  } catch (e) {
    console.warn("OfflineQueue dequeue failed:", e);
  }
}

/** Clear all queued ops (e.g. on sign-out). */
export async function clearQueue(): Promise<void> {
  try {
    const db = await openQueueDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  } catch (e) {
    console.warn("OfflineQueue clear failed:", e);
  }
}

/** How many ops are pending (for UI badge). */
export async function pendingCount(): Promise<number> {
  try {
    const db = await openQueueDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).count();
    return new Promise<number>((res, rej) => {
      req.onsuccess = () => res(req.result ?? 0);
      req.onerror   = () => rej(req.error);
    });
  } catch {
    return 0;
  }
}
