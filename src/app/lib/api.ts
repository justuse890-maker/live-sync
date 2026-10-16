import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { nativeStorage } from "./nativeStorage";
import { encryptFields, decryptFields, clearFieldKeyCache } from "./fieldCrypto";
import { isInvestorDemo } from "./demo";
import { Capacitor } from "@capacitor/core";
import { NATIVE_RESET_REDIRECT, parseAuthLink, AuthLink } from "./authLink";
import { redactText } from "./aiPrivacy";
import { saveAuthSession, clearAuthSession, saveCachedUserId, loadFromCache, saveToCache, clearCache } from "./localCache";
import { localList, localUpsert, localRemove, localKey, claimDeviceFor, ALL_COLLECTIONS } from "./localDb";

/** Thrown when a write is attempted with no internet connection. */
export class OfflineError extends Error {
  constructor() { super("offline"); this.name = "OfflineError"; }
}

const STORAGE_KEY = "livesync-auth";

/** All localStorage / sessionStorage keys owned by LiveSync — cleared on sign-out */
const LIVESYNC_CACHE_KEYS = [
  "livesync_news_cache",
  "livesync_news_notif_time",
  "livesync_news_notif_enabled",
  "livesync-notified",           // sessionStorage loan notifications
];

/** Clear auth session and temporary cache on sign-out, never touching user financial data */
export function clearLocalCache() {
  try {
    LIVESYNC_CACHE_KEYS.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    
    // Clear native preferences auth storage key
    nativeStorage.removeItem(STORAGE_KEY);

    // Clear cached encryption key so next sign-in derives a fresh one
    clearFieldKeyCache();

    // Clear persisted auth session from IndexedDB
    clearAuthSession();
  } catch { /* ignore – private browsing may throw */ }
}


let _client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey,
      {
        auth: {
          storageKey: STORAGE_KEY,
          storage: nativeStorage,
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    );
  }
  return _client;
}

const base = `https://${projectId}.supabase.co/functions/v1/make-server-a3fe149f`;

/** Get the current signed-in user's ID (needed for encryption key derivation) */
async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase().auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function authHeader() {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token ?? publicAnonKey;
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function req(path: string, init: RequestInit = {}) {
  // Fail fast if device is offline
  if (!navigator.onLine) throw new OfflineError();

  // Wrap with a 15-second timeout so requests never hang silently
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { ...(await authHeader()), ...(init.headers || {}) },
    });
    clearTimeout(timeoutId);
    
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = `API ${init.method || "GET"} ${path} failed: ${res.status} ${body.error || res.statusText}`;
      console.error(msg, body);
      throw new Error(msg);
    }
    return body;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") throw new Error("Request timed out. Please check your connection and try again.");
    throw err;
  }
}

// ── One-time move of legacy cloud data onto the device ────────────────────
// Builds before v2.4 kept a copy of user data on the server. The first time a
// signed-in user opens this version with internet, we copy anything that is
// not yet on the device, then never read from the server again.
let _ensurePromise: Promise<void> | null = null;
let _migrationTriedThisSession = false;
const MIGRATION_FLAG = "__migrated_to_device_v1__";

export function ensureLocalData(): Promise<void> {
  if (!_ensurePromise) {
    _ensurePromise = (async () => {
      const userId = await getCurrentUserId();
      await claimDeviceFor(userId);
      const flag = await loadFromCache<string>(MIGRATION_FLAG);
      if (flag && flag[0] === userId) return;
      if (!userId || !navigator.onLine || _migrationTriedThisSession) return;
      _migrationTriedThisSession = true; // never block the UI twice in one session
      try {
        await Promise.race([
          (async () => {
            for (const col of ALL_COLLECTIONS) {
              if (col === "notes" || col === "inbox") continue;
              try {
                const r = await req(`/${col}`);
                const remote = await Promise.all(
                  ((r.items || []) as any[]).map((it) => decryptFields(col, it, userId).catch(() => it)),
                );
                if (remote.length === 0) continue;
                const key = localKey(col);
                const local = ((await loadFromCache<any>(key)) ?? []) as any[];
                const have = new Set(local.map((x) => x?.id));
                const merged = [...local, ...remote.filter((x) => x && !have.has(x.id))];
                await saveToCache(key, merged);
              } catch { /* collection not deployed / offline — skip */ }
            }
          })(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("migration timeout")), 20_000)),
        ]);
        await saveToCache(MIGRATION_FLAG, [userId] as any);
      } catch (e) {
        console.warn("[localDb] legacy migration incomplete, will retry next launch", e);
      }
    })();
  }
  return _ensurePromise;
}

export const api = {
  signup: (email: string, password: string, name: string) =>
    req("/signup", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  signin: async (email: string, password: string) => {
    const { data, error } = await supabase().auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Sign-in failed:", error.message);
      throw error;
    }
    // Persist session and userId so the app works offline after this login
    if (data.session) {
      saveAuthSession(data.session).catch(() => {});
      saveCachedUserId(data.session.user.id).catch(() => {});
    }
    return data;
  },
  signInWithGoogleIdToken: async (idToken: string) => {
    if (!idToken || idToken.split(".").length !== 3) {
      throw new Error("Google did not return a valid ID token. Please try again.");
    }
    const { data, error } = await supabase().auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    if (error) {
      console.error("Google sign-in failed:", error.message);
      throw error;
    }
    if (data.session) {
      saveAuthSession(data.session).catch(() => {});
      saveCachedUserId(data.session.user.id).catch(() => {});
    }
    return data;
  },
  signInWithGoogleOAuth: async () => {
    const { data, error } = await supabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      console.error("Google OAuth failed:", error.message);
      throw error;
    }
    return data;
  },
  signout: async () => {
    // Financial data stays on this device (it exists nowhere else). Only the
    // session and transient caches are cleared. A different account signing in
    // on this device triggers a full wipe — see claimDeviceFor().
    clearLocalCache();
    _ensurePromise = null;
    return supabase().auth.signOut();
  },
  // In the APK window.location.origin is https://localhost, which an e-mail client can't open.
  // Native builds use the app's own deep link instead (must be in Supabase → Auth → Redirect URLs).
  resetPassword: async (email: string) => {
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Capacitor.isNativePlatform() ? NATIVE_RESET_REDIRECT : window.location.origin,
    });
    if (error) throw error;
  },
  /** Consume a deep link opened from the reset e-mail. Returns what the UI should do next. */
  handleAuthLink: async (url: string): Promise<AuthLink> => {
    const link = parseAuthLink(url);
    if (link?.kind === "recovery") {
      const { error } = await supabase().auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
      if (error) return { kind: "error", message: "This reset link is no longer valid. Please request a new one." };
    }
    return link;
  },
  onPasswordRecovery: (cb: () => void) =>
    supabase().auth.onAuthStateChange((event) => { if (event === "PASSWORD_RECOVERY") cb(); }),
  updatePassword: (password: string) => supabase().auth.updateUser({ password }),
  session: () => supabase().auth.getSession().then((r) => r.data.session),
  onAuth: (cb: (signedIn: boolean) => void) =>
    supabase().auth.onAuthStateChange((_, s) => cb(!!s)),

  // ── User data: ON-DEVICE ONLY ────────────────────────────────────────
  // These three methods never touch the network for reads/writes. See localDb.ts.
  list: async <T>(col: string): Promise<T[]> => {
    void ensureLocalData(); // Run sync/migration in background without blocking UI
    return localList<T>(col);
  },
  create: async <T>(col: string, item: Partial<T>): Promise<T> => {
    void ensureLocalData();
    // Items queued by older builds may still carry encrypted fields — decrypt
    // once so on-device data is always plain, readable by this device only.
    const userId = await getCurrentUserId();
    const clean = userId ? await decryptFields(col, item as any, userId).catch(() => item) : item;
    return localUpsert<any>(col, clean as any) as Promise<T>;
  },
  remove: async (col: string, id: string) => {
    await localRemove(col, id);
    return { ok: true };
  },

  /** Documents are stored on the device as data-URLs — never uploaded. */
  uploadDocument: async (file: File, category: string, name: string, expiry?: string) => {
    if (file.size > 25 * 1024 * 1024) throw new Error("File too large (max 25 MB)");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    const item = await localUpsert<any>("documents", {
      name, category, expiry: expiry || null,
      fileName: file.name, mimeType: file.type, size: file.size,
      uploadedAt: new Date().toISOString(),
    });
    await saveToCache(`__doc_blob__${item.id}`, [dataUrl] as any);
    return item;
  },
  documentUrl: async (id: string): Promise<string> => {
    const blob = await loadFromCache<string>(`__doc_blob__${id}`);
    if (blob && blob[0]) return blob[0];
    // A document uploaded by an older build may still only exist in the cloud.
    const r = await req(`/documents/${id}/url`);
    return r.url as string;
  },

  /** In-app notification inbox — stored on device. */
  notifications: async () => localList<{ id: string; title: string; body?: string; kind: string; at: string; read: boolean }>("inbox"),
  markNotificationsRead: async () => {
    const items = await localList<any>("inbox");
    await Promise.all(items.filter((n) => !n.read).map((n) => localUpsert("inbox", { ...n, read: true })));
    return { ok: true };
  },

  /**
   * Erase every copy of this user's data that older app versions stored on the
   * server. Device data is untouched. Returns how many records were erased.
   */
  eraseCloudCopy: async (onProgress?: (done: number, total: number) => void): Promise<number> => {
    let erased = 0;
    const cols = ALL_COLLECTIONS.filter((c) => c !== "notes" && c !== "inbox");
    for (let i = 0; i < cols.length; i++) {
      onProgress?.(i, cols.length);
      try {
        const r = await req(`/${cols[i]}`);
        for (const it of (r.items || []) as Array<{ id: string }>) {
          try { await req(`/${cols[i]}/${it.id}`, { method: "DELETE" }); erased++; } catch {}
        }
      } catch {}
    }
    onProgress?.(cols.length, cols.length);
    try { localStorage.setItem("livesync_cloud_erased_at", new Date().toISOString()); } catch {}
    return erased;
  },

  deleteAccount: async () => {
    // A shared demo identity is intentionally non-destructive. Server-side
    // protection should also be enabled for this account before public launch.
    if (isInvestorDemo) throw new Error("The shared investor demo account cannot be deleted.");
    const result = await req("/me/delete", { method: "POST" });
    clearLocalCache();
    await clearCache(); // account deleted → wipe this device too
    await supabase().auth.signOut();
    return result;
  },
  subscription: async () => {
    try {
      const res = await req("/me/subscription");
      if (res && res.subscription) {
        try { localStorage.setItem("livesync_subscription_cache", JSON.stringify(res)); } catch {}
      }
      return res;
    } catch (err) {
      try {
        const cached = localStorage.getItem("livesync_subscription_cache");
        if (cached) return JSON.parse(cached);
      } catch {}
      // Fail closed: if the server cannot confirm a plan and nothing is cached, treat the
      // user as Free. (Granting Pro here would let anyone unlock it by blocking the request.)
      return {
        subscription: { planId: "free", since: new Date().toISOString() },
        plan: { id: "free", name: "Free", priceMonthly: 0 },
        entitlements: {},
        allFeatures: [],
        inTrial: false,
      };
    }
  },
  // The server is the only authority on the plan. No optimistic local grant and no
  // swallowed failure: a rejected or unreachable upgrade must surface as an error.
  upgradeSubscription: (planId: "free" | "pro" | "lifetime") =>
    req("/me/subscription/upgrade", { method: "POST", body: JSON.stringify({ planId }) }),
  renewSubscription: () => req("/me/subscription/renew", { method: "POST" }),
  cancelSubscription: () => req("/me/subscription/cancel", { method: "POST" }),
  submitFeedback: (payload: { kind?: string; severity?: string; screen?: string; message: string }) =>
    req("/feedback", { method: "POST", body: JSON.stringify(payload) }).then((r) => r.item),
  listFeedback: () => req("/feedback").then((r) => r.items as Array<{ id: string; createdAt: string; kind: string; severity: string; screen?: string; message: string; status: string }>),
  getCurrentUserId,
};
