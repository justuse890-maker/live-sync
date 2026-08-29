import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { nativeStorage } from "./nativeStorage";
import { encryptFields, decryptFields, clearFieldKeyCache } from "./fieldCrypto";
import { isInvestorDemo } from "./demo";

const STORAGE_KEY = "livesync-auth";

/** All localStorage / sessionStorage keys owned by LiveSync — cleared on sign-out */
const LIVESYNC_CACHE_KEYS = [
  "livesync_news_cache",
  "livesync_news_notif_time",
  "livesync_news_notif_enabled",
  "livesync-notified",           // sessionStorage loan notifications
];

/** Wipe all local cache so no data bleeds between sign-in/sign-out sessions */
export function clearLocalCache() {
  try {
    LIVESYNC_CACHE_KEYS.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    // Also clear any leftover livesync_ prefixed keys
    Object.keys(localStorage)
      .filter((k) => k.startsWith("livesync"))
      .forEach((k) => localStorage.removeItem(k));
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("livesync"))
      .forEach((k) => sessionStorage.removeItem(k));
    
    // Clear native preferences storage key
    nativeStorage.removeItem(STORAGE_KEY);

    // Clear cached encryption key so next sign-in derives a fresh one
    clearFieldKeyCache();
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
  if (!navigator.onLine) throw new Error("No internet connection. Please check your network and try again.");

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

export const api = {
  signup: (email: string, password: string, name: string) =>
    req("/signup", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  signin: async (email: string, password: string) => {
    const { data, error } = await supabase().auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Sign-in failed:", error.message);
      throw error;
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
    clearLocalCache();
    return supabase().auth.signOut();
  },
  resetPassword: (email: string) => supabase().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }),
  updatePassword: (password: string) => supabase().auth.updateUser({ password }),
  session: () => supabase().auth.getSession().then((r) => r.data.session),
  onAuth: (cb: (signedIn: boolean) => void) =>
    supabase().auth.onAuthStateChange((_, s) => cb(!!s)),

  list: <T>(col: string) =>
    req(`/${col}`).then(async (r) => {
      const userId = await getCurrentUserId();
      if (!userId) return r.items as T[];
      return Promise.all(
        (r.items as T[]).map((item) => decryptFields(col, item as any, userId) as Promise<T>)
      );
    }),
  create: <T>(col: string, item: Partial<T>) =>
    getCurrentUserId().then(async (userId) => {
      const payload = userId
        ? await encryptFields(col, item as any, userId)
        : item;
      const r = await req(`/${col}`, { method: "POST", body: JSON.stringify(payload) });
      // Decrypt the returned item so the caller gets plaintext
      return userId
        ? (await decryptFields(col, r.item as any, userId)) as T
        : (r.item as T);
    }),
  remove: (col: string, id: string) => req(`/${col}/${id}`, { method: "DELETE" }),

  uploadDocument: async (file: File, category: string, name: string, expiry?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    fd.append("name", name);
    if (expiry) fd.append("expiry", expiry);
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token ?? publicAnonKey;
    const res = await fetch(`${base}/documents/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Upload failed: ${res.status}`);
    return body.item;
  },
  documentUrl: (id: string) => req(`/documents/${id}/url`).then((r) => r.url as string),
  deleteAccount: async () => {
    // A shared demo identity is intentionally non-destructive. Server-side
    // protection should also be enabled for this account before public launch.
    if (isInvestorDemo) throw new Error("The shared investor demo account cannot be deleted.");
    const result = await req("/me/delete", { method: "POST" });
    clearLocalCache();
    await supabase().auth.signOut();
    return result;
  },
  notifications: () => req("/me/notifications").then((r) => r.items as Array<{ id: string; title: string; body?: string; kind: string; at: string; read: boolean }>),
  markNotificationsRead: () => req("/me/notifications/read", { method: "POST" }),
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
      // Fallback default state
      return {
        subscription: { planId: "pro", since: new Date().toISOString() },
        plan: { id: "pro", name: "Pro", priceMonthly: 99 },
        entitlements: {},
        allFeatures: [],
        inTrial: true,
      };
    }
  },
  upgradeSubscription: async (planId: "free" | "pro" | "lifetime") => {
    const cachedSub = {
      subscription: {
        planId,
        since: new Date().toISOString(),
        lifetime: planId === "lifetime",
        renewsAt: planId === "pro" ? new Date(Date.now() + 30 * 86400000).toISOString() : null,
      },
      plan: planId === "free" ? { id: "free", name: "Free", priceMonthly: 0 } : planId === "pro" ? { id: "pro", name: "Pro", priceMonthly: 99 } : { id: "lifetime", name: "Pro Lifetime", priceMonthly: 0, priceOneTime: 4999 },
      entitlements: {},
      allFeatures: [],
      inTrial: planId !== "free",
    };
    try { localStorage.setItem("livesync_subscription_cache", JSON.stringify(cachedSub)); } catch {}

    try {
      return await req("/me/subscription/upgrade", { method: "POST", body: JSON.stringify({ planId }) });
    } catch {
      return { ok: true, subscription: cachedSub.subscription };
    }
  },
  renewSubscription: () => req("/me/subscription/renew", { method: "POST" }),
  cancelSubscription: () => req("/me/subscription/cancel", { method: "POST" }),
  submitFeedback: (payload: { kind?: string; severity?: string; screen?: string; message: string }) =>
    req("/feedback", { method: "POST", body: JSON.stringify(payload) }).then((r) => r.item),
  listFeedback: () => req("/feedback").then((r) => r.items as Array<{ id: string; createdAt: string; kind: string; severity: string; screen?: string; message: string; status: string }>),
  coach: async (message: string, history: Array<{ role: "user" | "assistant"; text: string }>, context: any) => {
    try {
      const result = await req("/ai/coach", { method: "POST", body: JSON.stringify({ message, history, context }) });
      return result.text as string;
    } catch (err: any) {
      // Surface rate limit errors distinctly
      if (err.message?.includes("429")) {
        throw new Error("RATE_LIMIT: Daily AI Coach limit reached (3/3). Resets at midnight.");
      }
      throw err;
    }
  },

  // ── [P0] Weekly AI Briefing ──────────────────────────────────────────
  weeklyBriefing: async (snapshot: Record<string, unknown>, force = false): Promise<{ text: string; cached: boolean; generatedAt?: string }> => {
    return req("/ai/weekly-briefing", { method: "POST", body: JSON.stringify({ snapshot, force }) });
  },

  // ── [P1] AI-Drafted Negotiation / Cancellation Script ────────────────
  negotiationScript: async (
    kind: "credit_card_rate" | "insurance_premium" | "loan_rate" | "subscription_cancel",
    context: {
      name: string;
      currentAmount: number;
      currentRatePct?: number;
      marketBenchmarkPct?: number;
      tenureMonths?: number;
      hasGoodPaymentHistory?: boolean;
    }
  ): Promise<{ text: string; aiUsed: boolean }> => {
    try {
      return await req("/ai/negotiation-script", { method: "POST", body: JSON.stringify({ kind, context }) });
    } catch (err: any) {
      if (err.message?.includes("429")) {
        throw new Error("RATE_LIMIT: Daily AI limit reached (3/3). Resets at midnight.");
      }
      throw err;
    }
  },

  // ── AI feature status (used by Settings/diagnostics + the verify script) ──
  aiStatus: async (): Promise<{
    geminiConfigured: boolean;
    features: Record<string, { server: string; status: string; lastGeneratedAt?: string | null }>;
  }> => {
    return req("/ai/status");
  },
};
