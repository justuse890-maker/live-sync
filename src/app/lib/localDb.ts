/**
 * localDb.ts — the single source of truth for every piece of user data.
 *
 * PRIVACY CONTRACT
 * ────────────────
 * All financial data (transactions, budgets, loans, notes, reminders, documents,
 * family, accounts…) is written ONLY to IndexedDB on this device. Nothing in this
 * file performs a network request. The cloud is used for exactly three things:
 *   1. Sign-in (email / Google identity — no financial data)
 *   2. Optional, user-triggered AI requests (minimised + anonymised, see aiPrivacy.ts)
 *   3. Optional, user-triggered Google Drive backup into the user's own Drive
 *
 * Storage shape: the existing "livesync-cache/collections" object store,
 * one key per collection → array of items. The React store mirrors the same
 * keys, so screens that use `api.list()` and the store always agree.
 */
import { loadFromCache, saveToCache, clearCache } from "./localCache";

/** Legacy server collection names that map to a different local key. */
const ALIASES: Record<string, string> = {
  reminders: "householdReminders",
};

export const localKey = (col: string) => ALIASES[col] ?? col;

/** Serialise writes per collection so two quick writes never clobber each other. */
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(col: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(col) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(col, next);
  return next;
}

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export async function localList<T>(col: string): Promise<T[]> {
  const key = localKey(col);
  // Wait for any in-flight write on this collection so reads are consistent.
  await (locks.get(key) ?? Promise.resolve()).catch(() => {});
  return ((await loadFromCache<T>(key)) ?? []) as T[];
}

export async function localUpsert<T extends { id?: string }>(col: string, item: Partial<T>): Promise<T> {
  const key = localKey(col);
  return withLock(key, async () => {
    const items = ((await loadFromCache<any>(key)) ?? []) as any[];
    const now = new Date().toISOString();
    const id = (item as any).id || newId();
    const idx = items.findIndex((x) => x && x.id === id);
    let saved: any;
    if (idx >= 0) {
      saved = { ...items[idx], ...item, id, updatedAt: now };
      items[idx] = saved;
    } else {
      saved = { createdAt: now, ...item, id, updatedAt: now };
      items.unshift(saved);
    }
    await saveToCache(key, items);
    return saved as T;
  });
}

export async function localRemove(col: string, id: string): Promise<void> {
  const key = localKey(col);
  await withLock(key, async () => {
    const items = ((await loadFromCache<any>(key)) ?? []) as any[];
    await saveToCache(key, items.filter((x) => x && x.id !== id));
  });
}

export async function localReplace<T>(col: string, items: T[]): Promise<void> {
  const key = localKey(col);
  await withLock(key, () => saveToCache(key, items));
}

// ── Device ownership ─────────────────────────────────────────────────────────
// Data is never wiped on a normal sign-out (it only lives here — wiping would
// destroy it). Instead we remember which account owns this device's data and
// clear it only when a *different* account signs in on the same device.
const OWNER_KEY = "__device_owner__";

export async function claimDeviceFor(userId: string | null): Promise<void> {
  if (!userId) return;
  const owner = (await loadFromCache<string>(OWNER_KEY)) as unknown as string | null;
  const ownerId = Array.isArray(owner) ? owner[0] : owner;
  if (ownerId && ownerId !== userId) {
    await clearCache();
  }
  if (ownerId !== userId) {
    await saveToCache(OWNER_KEY, [userId] as any);
  }
}

/** Every collection the app persists. Used for export, erase and migration. */
export const ALL_COLLECTIONS = [
  "transactions", "loans", "categories", "assets", "liabilities", "lifeEvents",
  "sips", "insurance", "investments", "gold", "properties", "creditScore", "fraudAlerts",
  "goals", "budgets", "subscriptions", "buckets", "bucketContributions",
  "structuredLoans", "creditCards", "householdStaff", "societyNotices", "reminders",
  "settings", "accounts", "family", "cashLedger", "cashPockets", "documents",
  "notes", "inbox",
] as const;

/**
 * Erase every piece of user data on this device (all collections, stored
 * document files, inbox) but keep the sign-in session so the app stays usable.
 */
export async function eraseAllUserData(): Promise<void> {
  const keep = ["__auth_session__", "__cached_user_id__", OWNER_KEY, "__migrated_to_device_v1__"];
  const kept: Record<string, unknown> = {};
  for (const k of keep) kept[k] = await loadFromCache<any>(k);
  await clearCache();
  for (const k of keep) if (kept[k] != null) await saveToCache(k, kept[k] as any);
}
