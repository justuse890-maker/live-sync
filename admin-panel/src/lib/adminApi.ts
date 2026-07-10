import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "./supabaseInfo";

const STORAGE_KEY = "livesync-admin-auth";

let _client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey,
      { auth: { storageKey: STORAGE_KEY, persistSession: true, autoRefreshToken: true } },
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
    const msg = `Admin API ${init.method || "GET"} ${path} failed: ${res.status} ${body.error || res.statusText}`;
    console.error(msg, body);
    throw new Error(body.error || msg);
  }
  return body;
}

export type Plan = {
  id: string;
  name: string;
  priceMonthly: number;
  priceYearly?: number;
  priceOneTime?: number;
  features: { key: string; label: string; price?: number }[];
  description?: string;
  createdAt?: string;
};

export type Offer = {
  id: string;
  userId?: string;
  scope: "user" | "global";
  title: string;
  description?: string;
  discountPct?: number;
  planId?: string;
  expiresAt?: string;
  createdAt?: string;
};

export type AdminUser = {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
  lastSignInAt?: string;
  txCount: number;
  featureCount: number;
  planId?: string;
  hasOffer: boolean;
};

export type Metrics = {
  totalUsers: number;
  activeUsersLast7d: number;
  paidUsers: number;
  freeUsers: number;
  mrr: number;
  arr: number;
  arpu: number;
  churnPct: number;
  retentionPct: number;
  churnedLast30d: number;
  planDistribution: Record<string, number>;
  featureUsage: Record<string, number>;
};

export const adminApi = {
  me: () => req("/admin/me"),
  metrics: () => req("/admin/metrics").then((r) => r as Metrics),
  users: () => req("/admin/users").then((r) => r.items as AdminUser[]),
  user: (id: string) => req(`/admin/users/${id}`),
  plans: () => req("/admin/plans").then((r) => r.items as Plan[]),
  upsertPlan: (p: Partial<Plan>) => req("/admin/plans", { method: "POST", body: JSON.stringify(p) }).then((r) => r.item as Plan),
  deletePlan: (id: string) => req(`/admin/plans/${id}`, { method: "DELETE" }),
  assignPlan: (userId: string, planId: string) =>
    req(`/admin/users/${userId}/plan`, { method: "POST", body: JSON.stringify({ planId }) }),
  offers: () => req("/admin/offers").then((r) => r.items as Offer[]),
  userFeatures: (userId: string) =>
    req(`/admin/users/${userId}/features`).then((r) => ({ overrides: r.overrides as Record<string, boolean>, allFeatures: r.allFeatures as string[] })),
  toggleFeature: (userId: string, feature: string, enabled: boolean) =>
    req(`/admin/users/${userId}/features`, { method: "POST", body: JSON.stringify({ feature, enabled }) }),
  createOffer: (o: Partial<Offer>) => req("/admin/offers", { method: "POST", body: JSON.stringify(o) }).then((r) => r.item as Offer),
  deleteUserOffer: (userId: string) => req(`/admin/offers/user/${userId}`, { method: "DELETE" }),
  deleteGlobalOffer: (id: string) => req(`/admin/offers/global/${id}`, { method: "DELETE" }),
  feedback: () => req("/admin/feedback").then((r) => r.items as Array<{ id: string; userId: string; userEmail?: string; userName?: string; createdAt: string; kind: string; severity: string; screen?: string; message: string; status: string }>),
  setFeedbackStatus: (userId: string, id: string, status: "open" | "resolved") =>
    req(`/admin/feedback/${userId}/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
};
