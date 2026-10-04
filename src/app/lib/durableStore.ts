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
 * On every launch `reconcile()` compares the two. Anything missing from
 * IndexedDB is restored from the mirror before the app reads a single record,
 * so an update can never show an empty app.
 *
 * Android Auto Backup (allowBackup="true") also backs up SharedPreferences to
 * the user's Google account, so the mirror can come back after a reinstall or
 * on a new phone when the user has Google backup turned on.
 *
 * Documents (large files) are not mirrored — they stay in IndexedDB only.
 */
import { Capacitor } from "@capacitor/core";

const PREFIX = "lsv1_";               // mirror key prefix in SharedPreferences
const SKIP = (key: string) =>
  key.startsWith("__doc_blob__") ||   // large files: IndexedDB only
  key === "__auth_session__";         // Supabase already persists its own session natively

const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

let prefsMod: Promise<typeof import("@capacitor/preferences")> | null = null;
const prefs = () => (prefsMod ??= import("@capacitor/preferences"));

// ── Debounced writes: many quick saves to one collection → one native write ──
const pending = new Map<string, unknown>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

async function flushKey(key: string) {
  timers.delete(key);
  if (!pending.has(key)) return;
  const value = pending.get(key);
  pending.delete(key);
  try {
    const { Preferences } = await prefs();
    await Preferences.set({ key: PREFIX + key, value: JSON.stringify({ v: 1, at: Date.now(), data: value }) });
  } catch (e) {
    console.warn("[durable] mirror write failed", key, e);
  }
}

export function mirrorWrite(key: string, value: unknown) {
  if (!isNative() || SKIP(key)) return;
  pending.set(key, value);
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(key, setTimeout(() => void flushKey(key), 600));
}

/** Write everything still pending right now (app going to background). */
export async function flushAll() {
  await Promise.all([...timers.keys()].map((k) => { clearTimeout(timers.get(k)!); return flushKey(k); }));
}

export async function mirrorRemove(key: string) {
  if (!isNative()) return;
  pending.delete(key);
  try { const { Preferences } = await prefs(); await Preferences.remove({ key: PREFIX + key }); } catch {}
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
 * Restore any collection that exists in the native mirror but is missing (or
 * empty while the mirror is not) in IndexedDB. Returns restored keys.
 */
export async function reconcile(
  readIdb: (key: string) => Promise<unknown>,
  writeIdb: (key: string, value: unknown) => Promise<void>,
): Promise<string[]> {
  if (!isNative()) return [];
  const restored: string[] = [];
  try {
    const { Preferences } = await prefs();
    const { keys } = await Preferences.keys();
    for (const pk of keys) {
      if (!pk.startsWith(PREFIX)) continue;
      const key = pk.slice(PREFIX.length);
      const current = await readIdb(key);
      const idbEmpty = current == null || (Array.isArray(current) && current.length === 0);
      if (!idbEmpty) continue;
      const { value } = await Preferences.get({ key: pk });
      if (!value) continue;
      try {
        const parsed = JSON.parse(value);
        const data = parsed && typeof parsed === "object" && "data" in parsed ? parsed.data : parsed;
        if (data == null || (Array.isArray(data) && data.length === 0)) continue;
        await writeIdb(key, data);
        restored.push(key);
      } catch { /* corrupt entry — skip */ }
    }
    if (restored.length) console.info(`[durable] restored ${restored.length} collections from native mirror`, restored);
  } catch (e) {
    console.warn("[durable] reconcile failed", e);
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
      await Preferences.set({ key: PREFIX + key, value: JSON.stringify({ v: 1, at: Date.now(), data: value }) });
    }
  } catch (e) {
    console.warn("[durable] seed failed", e);
  }
}

/** Flush pending writes whenever the app is backgrounded or closed. */
export function installLifecycleFlush() {
  try {
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") void flushAll(); });
    window.addEventListener("pagehide", () => void flushAll());
    if (isNative()) {
      import("@capacitor/app").then(({ App }) => App.addListener("pause", () => void flushAll())).catch(() => {});
    }
    // Ask the browser/WebView not to evict our storage under pressure.
    (navigator as any).storage?.persist?.().catch?.(() => {});
  } catch {}
}
