import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { nativeStorage } from "./nativeStorage";

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

async function authHeader() {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token ?? publicAnonKey;
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function req(path: string, init: RequestInit = {}) {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...(await authHeader()), ...(init.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = `API ${init.method || "GET"} ${path} failed: ${res.status} ${body.error || res.statusText}`;
    console.error(msg, body);
    throw new Error(msg);
  }
  return body;
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
  signout: async () => {
    clearLocalCache();
    return supabase().auth.signOut();
  },
  resetPassword: (email: string) => supabase().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }),
  updatePassword: (password: string) => supabase().auth.updateUser({ password }),
  session: () => supabase().auth.getSession().then((r) => r.data.session),
  onAuth: (cb: (signedIn: boolean) => void) =>
    supabase().auth.onAuthStateChange((_, s) => cb(!!s)),

  list: <T>(col: string) => req(`/${col}`).then((r) => r.items as T[]),
  create: <T>(col: string, item: Partial<T>) => req(`/${col}`, { method: "POST", body: JSON.stringify(item) }).then((r) => r.item as T),
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
    const result = await req("/me/delete", { method: "POST" });
    clearLocalCache();
    await supabase().auth.signOut();
    return result;
  },
  notifications: () => req("/me/notifications").then((r) => r.items as Array<{ id: string; title: string; body?: string; kind: string; at: string; read: boolean }>),
  markNotificationsRead: () => req("/me/notifications/read", { method: "POST" }),
  subscription: () => req("/me/subscription"),
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
};
