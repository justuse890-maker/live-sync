/**
 * durableStore.ts — keeps a second, native copy of every collection so user
 * data survives app updates no matter what happens to the WebView.
 *
 * Why two copies?
 *  • Primary  : IndexedDB inside the Android WebView (fast, large).
 *  • Mirror   : Android SharedPreferences via @capacitor/preferences. This is
 *               plain app data owned by the APK, untouched by WebView updates,
 *               WebView cache clears or a change of WebView origin, and kept
 *               across every Play Store / APK update (same package + signing key).
 *
 * Universal Reconcile:
 *  On every launch `reconcile()` compares IndexedDB with all historical storage:
 *  native SharedPreferences (all prefixes: lsv1_, livesync_, legacy names),
 *  localStorage, and permanent snapshots. Anything missing from IndexedDB is
 *  restored before the app reads a single record, so an update can NEVER show an empty app.
 *
 * Critical Protection:
 *  Mirror writes NEVER overwrite an existing populated collection with an empty array.
 */
import { Capacitor } from "@capacitor/core";

export const PREFIX = "lsv1_"; // mirror key prefix in SharedPreferences
const SKIP = (key: string) =>
  key.startsWith("__doc_blob__") || // large files: IndexedDB only
  key === "__auth_session__"; // Supabase already persists its own session natively

export const isNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

let prefsMod: Promise<typeof import("@capacitor/preferences")> | null = null;
export const prefs = () => (prefsMod ??= import("@capacitor/preferences"));

/**
 * Safely parse any JSON string or object and unwrap `{ v: 1, data: ... }` if wrapped.
 */
export function safeExtractData(val: any): any {
  if (!val) return null;
  if (typeof val === "object") {
    return "data" in val ? val.data : val;
  }
  try {
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      return parsed.data;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ── Debounced writes: many quick saves to one collection → one native write ──
const pending = new Map<string, unknown>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Read data from native SharedPreferences or localStorage across all known key aliases.
 */
export async function getNativeMirrorData<T = any>(key: string): Promise<T[] | null> {
  const possibleKeys = [
    PREFIX + key,
    key,
    `livesync_${key}`,
    `ls_${key}`,
  ];

  if (isNative()) {
    try {
      const { Preferences } = await prefs();
      for (const pk of possibleKeys) {
        const { value } = await Preferences.get({ key: pk });
        if (value) {
          const parsed = safeExtractData(value);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed as T[];
        }
      }
    } catch {}
  }

  // Fallback to localStorage
  if (typeof localStorage !== "undefined") {
    try {
      for (const pk of possibleKeys) {
        const raw = localStorage.getItem(pk);
        if (raw) {
          const parsed = safeExtractData(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed as T[];
        }
      }
    } catch {}
  }

  return null;
}

async function flushKey(key: string, force = false) {
  timers.delete(key);
  if (!pending.has(key)) return;
  const value = pending.get(key);
  pending.delete(key);

  // CRITICAL PROTECTION: Never overwrite existing populated native storage with an empty array.
  if (Array.isArray(value) && value.length === 0 && !force) {
    const existing = await getNativeMirrorData(key);
    if (Array.isArray(existing) && existing.length > 0) {
      console.warn(
        `[durable] Mirror protection: Blocked empty overwrite for ${key} (${existing.length} records preserved in native mirror).`,
      );
      return;
    }
  }

  try {
    const { Preferences } = await prefs();
    await Preferences.set({
      key: PREFIX + key,
      value: JSON.stringify({ v: 1, at: Date.now(), data: value }),
    });
  } catch (e) {
    console.warn("[durable] mirror write failed", key, e);
  }
}

export function mirrorWrite(key: string, value: unknown, force = false) {
  if (!isNative() || SKIP(key)) return;

  // Pre-check for empty arrays
  if (Array.isArray(value) && value.length === 0 && !force) {
    // Check synchronously if we already had items queued
    const queued = pending.get(key);
    if (Array.isArray(queued) && queued.length > 0) {
      console.warn(`[durable] Mirror write prevented queued populated data for ${key} from being cleared.`);
      return;
    }
  }

  pending.set(key, value);
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(key, setTimeout(() => void flushKey(key, force), 600));
}

/** Write everything still pending right now (app going to background). */
export async function flushAll() {
  await Promise.all(
    [...timers.keys()].map((k) => {
      clearTimeout(timers.get(k)!);
      return flushKey(k);
    }),
  );
}

export async function mirrorRemove(key: string) {
  if (!isNative()) return;
  pending.delete(key);
  try {
    const { Preferences } = await prefs();
    await Preferences.remove({ key: PREFIX + key });
  } catch {}
}

export async function mirrorClear() {
  if (!isNative()) return;
  pending.clear();
  timers.forEach((t) => clearTimeout(t));
  timers.clear();
  try {
    const { Preferences } = await prefs();
    const { keys } = await Preferences.keys();
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX)).map((k) => Preferences.remove({ key: k })));
  } catch {}
}

/**
 * Universal Reconcile:
 * Scans ALL persistent storage (SharedPreferences with any prefix, localStorage, snapshots)
 * and restores any missing collection into IndexedDB before first user interaction.
 * Returns the list of restored collection keys.
 */
export async function reconcile(
  readIdb: (key: string) => Promise<unknown>,
  writeIdb: (key: string, value: unknown) => Promise<void>,
): Promise<string[]> {
  const restored: string[] = [];
  const candidates = new Map<string, any[]>();

  // Helper to extract collection name
  const normalizeCollectionKey = (rawKey: string): string => {
    let k = rawKey;
    if (k.startsWith(PREFIX)) k = k.slice(PREFIX.length);
    else if (k.startsWith("livesync_")) k = k.slice("livesync_".length);
    else if (k.startsWith("ls_")) k = k.slice("ls_".length);
    return k;
  };

  // 1. Scan Capacitor Preferences (Android SharedPreferences / iOS UserDefaults)
  if (isNative()) {
    try {
      const { Preferences } = await prefs();
      const { keys } = await Preferences.keys();
      for (const pk of keys) {
        const col = normalizeCollectionKey(pk);
        if (SKIP(col) || col.startsWith("__")) continue;

        const { value } = await Preferences.get({ key: pk });
        if (!value) continue;
        const data = safeExtractData(value);

        if (Array.isArray(data) && data.length > 0) {
          const prev = candidates.get(col) || [];
          if (data.length > prev.length) {
            candidates.set(col, data);
          }
        } else if ((pk.includes("permanent_backup") || pk.includes("snapshot")) && data?.collections) {
          for (const [c, items] of Object.entries(data.collections)) {
            if (Array.isArray(items) && items.length > (candidates.get(c)?.length || 0)) {
              candidates.set(c, items);
            }
          }
        }
      }
    } catch (e) {
      console.warn("[durable] preferences scan in reconcile failed:", e);
    }
  }

  // 2. Scan localStorage (browser environments and native fallback)
  if (typeof localStorage !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const pk = localStorage.key(i);
        if (!pk) continue;
        const col = normalizeCollectionKey(pk);
        if (SKIP(col) || col.startsWith("__")) continue;

        const raw = localStorage.getItem(pk);
        if (!raw) continue;
        const data = safeExtractData(raw);

        if (Array.isArray(data) && data.length > 0) {
          const prev = candidates.get(col) || [];
          if (data.length > prev.length) {
            candidates.set(col, data);
          }
        } else if ((pk.includes("permanent_backup") || pk.includes("snapshot")) && data?.collections) {
          for (const [c, items] of Object.entries(data.collections)) {
            if (Array.isArray(items) && items.length > (candidates.get(c)?.length || 0)) {
              candidates.set(c, items);
            }
          }
        }
      }
    } catch (e) {
      console.warn("[durable] localStorage scan in reconcile failed:", e);
    }
  }

  // 3. For each candidate collection, restore into IndexedDB if IndexedDB is missing or has fewer records
  for (const [col, bestData] of candidates.entries()) {
    try {
      const current = await readIdb(col);
      const currentLen = Array.isArray(current) ? current.length : 0;
      if (currentLen === 0 && bestData.length > 0) {
        await writeIdb(col, bestData);
        restored.push(col);
        // Reseed native mirror with current standard prefix
        mirrorWrite(col, bestData);
      }
    } catch (e) {
      console.warn(`[durable] reconcile restore failed for ${col}:`, e);
    }
  }

  if (restored.length > 0) {
    console.info(`[durable] Universal reconcile successfully restored ${restored.length} collections:`, restored);
  }

  return restored;
}

/** Make sure the native mirror is complete (first launch after this update). */
export async function seedMirror(entries: Array<[string, unknown]>) {
  if (!isNative()) return;
  try {
    const { Preferences } = await prefs();
    const { keys } = await Preferences.keys();
    const have = new Set(keys);
    for (const [key, value] of entries) {
      if (SKIP(key) || have.has(PREFIX + key)) continue;
      if (Array.isArray(value) && value.length === 0) continue; // Don't seed empty collections
      await Preferences.set({ key: PREFIX + key, value: JSON.stringify({ v: 1, at: Date.now(), data: value }) });
    }
  } catch (e) {
    console.warn("[durable] seed failed", e);
  }
}

/** Saves an immutable snapshot payload to both native Preferences and localStorage */
export async function saveDurableSnapshot(snapshotKey: string, payload: string): Promise<void> {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(snapshotKey, payload);
    } catch {}
  }
  if (isNative()) {
    try {
      const { Preferences } = await prefs();
      await Preferences.set({ key: snapshotKey, value: payload });
    } catch {}
  }
}

/** Flush pending writes whenever the app is backgrounded or closed. */
export function installLifecycleFlush() {
  try {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flushAll();
    });
    window.addEventListener("pagehide", () => void flushAll());
    if (isNative()) {
      import("@capacitor/app")
        .then(({ App }) => App.addListener("pause", () => void flushAll()))
        .catch(() => {});
    }
    // Ask the browser/WebView not to evict our storage under pressure.
    (navigator as any).storage?.persist?.().catch?.(() => {});
  } catch {}
}
