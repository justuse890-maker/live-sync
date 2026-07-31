import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.ts";

const app = new Hono();
app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const DOC_BUCKET = "make-a3fe149f-documents";

// Idempotently create the documents bucket on cold start.
(async () => {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.name === DOC_BUCKET)) {
      await supabase.storage.createBucket(DOC_BUCKET, { public: false });
      console.log(`Created storage bucket ${DOC_BUCKET}`);
    }
  } catch (e) {
    console.log("Bucket setup error:", e);
  }
})();

async function requireUser(c: any): Promise<string | null> {
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    console.log("Auth resolution error:", error?.message);
    return null;
  }
  return data.user.id;
}

app.get("/make-server-a3fe149f/health", (c) => c.json({ status: "ok" }));

// --- Auth ---
app.post("/make-server-a3fe149f/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    if (!email || !password) return c.json({ error: "Missing email or password" }, 400);
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Auto-confirm because no email server is configured in this environment.
      email_confirm: true,
    });
    if (error) {
      console.log("Signup user-creation error:", error.message);
      return c.json({ error: error.message }, 400);
    }
    return c.json({ user: data.user });
  } catch (e) {
    console.log("Signup exception:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// Admin bootstrap: create an admin user. Allowed if (a) the email is permitted by ADMIN_EMAILS
// or starts with admin@, or (b) no admin user exists yet.
app.post("/make-server-a3fe149f/admin/bootstrap", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    if (!email || !password) return c.json({ error: "Missing email or password" }, 400);
    const lower = email.toLowerCase();
    const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    
    // Strictly require that the email is explicitly listed in ADMIN_EMAILS environment variable
    const allowed = ADMIN_EMAILS.includes(lower);
    if (!allowed) {
      return c.json({ error: "Unauthorized. Email is not listed in ADMIN_EMAILS environment variable." }, 403);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || "Admin", role: "admin" },
      email_confirm: true,
    });
    if (error) {
      console.log("Admin bootstrap error:", error.message);
      return c.json({ error: error.message }, 400);
    }
    return c.json({ user: data.user });
  } catch (e) {
    console.log("Admin bootstrap exception:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// --- Generic collection routes ---
const collections = ["transactions", "goals", "buckets", "bucketContributions", "budgets", "subscriptions", "loans", "categories", "accounts", "documents", "settings", "assets", "liabilities", "lifeEvents", "family", "cashLedger", "cashPockets", "sips", "insurance", "investments", "gold", "properties", "creditScore", "fraudAlerts"] as const;
type Collection = (typeof collections)[number];
const EDIT_WINDOW_MS = 5 * 60 * 1000;

function keyFor(userId: string, col: Collection, id?: string) {
  return id ? `user:${userId}:${col}:${id}` : `user:${userId}:${col}:`;
}

for (const col of collections) {
  app.get(`/make-server-a3fe149f/${col}`, async (c) => {
    const userId = await requireUser(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    try {
      const items = await kv.getByPrefix(keyFor(userId, col));
      return c.json({ items });
    } catch (e) {
      console.log(`List ${col} failed for user ${userId}:`, e);
      return c.json({ error: String(e) }, 500);
    }
  });

  app.post(`/make-server-a3fe149f/${col}`, async (c) => {
    const userId = await requireUser(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    try {
      const body = await c.req.json();
      const id = body.id ?? crypto.randomUUID();
      const now = new Date().toISOString();
      const existing = body.id ? await kv.get(keyFor(userId, col, id)) : null;

      // Enforce 5-minute edit window for transactions.
      if (col === "transactions" && existing && existing.createdAt) {
        const age = Date.now() - new Date(existing.createdAt).getTime();
        if (age > EDIT_WINDOW_MS) {
          console.log(`Edit blocked for transaction ${id}: age ${Math.round(age / 1000)}s exceeds window`);
          return c.json({ error: "This transaction is older than 5 minutes and can no longer be edited." }, 403);
        }
      }

      const item = {
        ...body,
        id,
        userId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await kv.set(keyFor(userId, col, id), item);
      return c.json({ item });
    } catch (e) {
      console.log(`Write ${col} failed for user ${userId}:`, e);
      return c.json({ error: String(e) }, 500);
    }
  });

  app.delete(`/make-server-a3fe149f/${col}/:id`, async (c) => {
    const userId = await requireUser(c);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);
    try {
      const id = c.req.param("id");
      if (col === "transactions") {
        const existing = await kv.get(keyFor(userId, col, id));
        if (existing?.createdAt) {
          const age = Date.now() - new Date(existing.createdAt).getTime();
          if (age > EDIT_WINDOW_MS) {
            return c.json({ error: "This transaction is older than 5 minutes and can no longer be deleted." }, 403);
          }
        }
      }
      if (col === "documents") {
        const existing = await kv.get(keyFor(userId, col, id));
        if (existing?.path) {
          await supabase.storage.from(DOC_BUCKET).remove([existing.path]);
        }
      }
      await kv.del(keyFor(userId, col, id));
      return c.json({ ok: true });
    } catch (e) {
      console.log(`Delete ${col} failed for user ${userId}:`, e);
      return c.json({ error: String(e) }, 500);
    }
  });
}

// --- Documents: upload + signed-url ---
app.post("/make-server-a3fe149f/documents/upload", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const form = await c.req.formData();
    const file = form.get("file") as File | null;
    const category = (form.get("category") as string) || "Other";
    const name = (form.get("name") as string) || file?.name || "Untitled";
    const expiry = (form.get("expiry") as string) || "";
    if (!file) return c.json({ error: "No file provided" }, 400);

    const id = crypto.randomUUID();
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${userId}/${id}.${ext}`;
    const arrayBuf = await file.arrayBuffer();

    const { error: upErr } = await supabase.storage
      .from(DOC_BUCKET)
      .upload(path, new Uint8Array(arrayBuf), { contentType: file.type, upsert: false });
    if (upErr) {
      console.log(`Document upload failed for user ${userId}:`, upErr.message);
      return c.json({ error: upErr.message }, 500);
    }

    const now = new Date().toISOString();
    const item = {
      id,
      userId,
      name,
      category,
      path,
      size: file.size,
      mime: file.type,
      expiry: expiry || null,
      uploadedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await kv.set(keyFor(userId, "documents", id), item);
    return c.json({ item });
  } catch (e) {
    console.log("Document upload exception:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.get("/make-server-a3fe149f/documents/:id/url", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const doc = await kv.get(keyFor(userId, "documents", c.req.param("id")));
    if (!doc) return c.json({ error: "Not found" }, 404);
    const { data, error } = await supabase.storage.from(DOC_BUCKET).createSignedUrl(doc.path, 60);
    if (error) {
      console.log(`Signed-url generation failed for doc ${doc.id}:`, error.message);
      return c.json({ error: error.message }, 500);
    }
    return c.json({ url: data.signedUrl });
  } catch (e) {
    console.log("Signed-url exception:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// --- Account deletion (right-to-erasure / DPDP) ---
app.post("/make-server-a3fe149f/me/delete", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    for (const col of collections) {
      const items = await kv.getByPrefix(keyFor(userId, col));
      for (const i of items) {
        if (col === "documents" && i.path) {
          await supabase.storage.from(DOC_BUCKET).remove([i.path]);
        }
        await kv.del(keyFor(userId, col, i.id));
      }
    }
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.log(`Account deletion (auth) failed for user ${userId}:`, error.message);
      return c.json({ error: error.message }, 500);
    }
    return c.json({ ok: true });
  } catch (e) {
    console.log("Account deletion exception:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────────
// ADMIN PANEL
// ───────────────────────────────────────────────────────────────────────
// Admin identity: user email must be listed in env ADMIN_EMAILS (comma-separated).
// Keys are isolated from user data under the `admin:` and `events:` prefixes.

const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

// All app features that admin can grant / revoke per user.
const ALL_FEATURES = [
  "networth", "timeline", "leakage", "inflation", "fire", "simulator",
  "coach", "tax", "documents", "accounts", "budgets", "subscriptions",
  "loans", "categories", "reports", "emergency", "health",
  "import", "country",
] as const;

const DEFAULT_PLANS = [
  {
    id: "free",
    name: "Free (7-day trial)",
    priceMonthly: 0,
    description: "All premium features for 7 days, then free tier only.",
    trialDays: 7,
    features: ALL_FEATURES.map((k) => ({ key: k, label: k, price: 0 })),
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 99,
    description: "All features unlocked, monthly.",
    features: ALL_FEATURES.map((k) => ({ key: k, label: k, price: 0 })),
  },
  {
    id: "lifetime",
    name: "Pro Lifetime",
    priceMonthly: 0,
    priceOneTime: 4999,
    description: "One-time payment, every feature unlocked forever.",
    features: ALL_FEATURES.map((k) => ({ key: k, label: k, price: 0 })),
  },
];

async function ensureDefaultPlans() {
  for (const p of DEFAULT_PLANS) {
    const existing = await kv.get(`admin:plan:${p.id}`);
    if (!existing) await kv.set(`admin:plan:${p.id}`, { ...p, createdAt: new Date().toISOString() });
  }
}

async function resolveAdmin(c: any): Promise<{ id: string; email: string } | null> {
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return null;
  const email = data.user.email.toLowerCase();
  const ok = ADMIN_EMAILS.includes(email);
  if (!ok) return null;
  return { id: data.user.id, email };
}

// Anyone authenticated may emit a feature-usage event for themselves.
app.post("/make-server-a3fe149f/track", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const { feature, meta } = await c.req.json();
    if (!feature) return c.json({ error: "Missing feature" }, 400);
    const ts = Date.now();
    await kv.set(`events:${userId}:${ts}:${crypto.randomUUID().slice(0, 8)}`, {
      userId, feature, meta: meta ?? null, at: new Date(ts).toISOString(),
    });
    // Roll up per-feature counter for fast admin reads
    const counterKey = `usage:${userId}:${feature}`;
    const existing = (await kv.get(counterKey)) || { count: 0, lastAt: null };
    await kv.set(counterKey, { feature, count: existing.count + 1, lastAt: new Date(ts).toISOString() });
    const globalKey = `usage-global:${feature}`;
    const g = (await kv.get(globalKey)) || { count: 0 };
    await kv.set(globalKey, { feature, count: g.count + 1 });
    return c.json({ ok: true });
  } catch (e) {
    console.log("Track event failed:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// Get current user's subscription (plan + active offer, if any). Used by main app.
app.get("/make-server-a3fe149f/me/subscription", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    await ensureDefaultPlans();
    let sub = await kv.get(`subscription:${userId}`);
    if (!sub) {
      // First-time user → put on free trial automatically
      const freePlan = await kv.get("admin:plan:free");
      sub = {
        planId: "free",
        since: new Date().toISOString(),
        trialEndsAt: freePlan?.trialDays
          ? new Date(Date.now() + freePlan.trialDays * 86400000).toISOString()
          : null,
      };
      await kv.set(`subscription:${userId}`, sub);
    }
    const offer = await kv.get(`offer-user:${userId}`);
    const plan = sub.planId ? await kv.get(`admin:plan:${sub.planId}`) : null;
    const overrides = (await kv.get(`feature-overrides:${userId}`)) || {};

    // Compute entitled features:
    // - During trial OR on a paid plan → all plan features
    // - After trial ends on free → only those with overrides[k] === true
    // - Per-feature overrides always win (true unlocks, false locks)
    const inTrial = sub.trialEndsAt ? new Date(sub.trialEndsAt).getTime() > Date.now() : false;
    const isPaid = sub.planId === "pro" || sub.planId === "lifetime";
    // Pro / lifetime / trial → unlock everything in ALL_FEATURES.
    // Admin overrides ALWAYS win (true unlocks a single feature on free, false locks it on Pro).
    const planUnlocks: Record<string, boolean> = {};
    for (const key of ALL_FEATURES) planUnlocks[key] = isPaid || inTrial;
    const entitlements: Record<string, boolean> = { ...planUnlocks, ...overrides };
    return c.json({ subscription: sub, offer, plan, entitlements, inTrial, allFeatures: ALL_FEATURES });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// User-initiated subscription actions
app.post("/make-server-a3fe149f/me/subscription/renew", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const sub = (await kv.get(`subscription:${userId}`)) || {};
  if (sub.planId !== "pro") return c.json({ error: "Renewal only applies to monthly Pro" }, 400);
  const base = sub.renewsAt && new Date(sub.renewsAt).getTime() > Date.now() ? new Date(sub.renewsAt).getTime() : Date.now();
  sub.renewsAt = new Date(base + 30 * 86400000).toISOString();
  sub.cancelAt = null;
  await kv.set(`subscription:${userId}`, sub);
  return c.json({ ok: true, subscription: sub });
});

app.post("/make-server-a3fe149f/me/subscription/cancel", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const sub = (await kv.get(`subscription:${userId}`)) || {};
  if (sub.planId !== "pro") return c.json({ error: "Nothing to cancel" }, 400);
  // Soft cancel: keep access until renewsAt, then auto-revert to free.
  sub.cancelAt = sub.renewsAt || new Date(Date.now() + 30 * 86400000).toISOString();
  await kv.set(`subscription:${userId}`, sub);
  return c.json({ ok: true, subscription: sub });
});

// ─── Admin routes ────────────────────────────────────────────────────────

app.get("/make-server-a3fe149f/admin/me", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  return c.json({ admin });
});

app.get("/make-server-a3fe149f/admin/metrics", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  try {
    await ensureDefaultPlans();
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const users = list?.users || [];

    const plans = await kv.getByPrefix("admin:plan:");
    const subs = await kv.getByPrefix("subscription:");
    const globalUsage = await kv.getByPrefix("usage-global:");

    const planMap = new Map<string, any>(plans.map((p: any) => [p.id, p]));
    let mrr = 0;
    let paidUsers = 0;
    const planDistribution: Record<string, number> = {};
    for (const s of subs) {
      const p = planMap.get(s.planId);
      const price = p?.priceMonthly ?? 0;
      if (price > 0) paidUsers += 1;
      mrr += price;
      planDistribution[s.planId || "free"] = (planDistribution[s.planId || "free"] || 0) + 1;
    }
    const freeUsers = Math.max(users.length - paidUsers, 0);
    const arpu = paidUsers > 0 ? mrr / paidUsers : 0;

    // Churn / retention over the last 30 days
    const churnEvents = await kv.getByPrefix("churn:");
    const cutoff = Date.now() - 30 * 86400000;
    const churned30d = (churnEvents as any[]).filter((c) => c.at && new Date(c.at).getTime() >= cutoff);
    // Denominator: paid users at start of window ≈ paid now + churned in window
    const paidAtStart = paidUsers + churned30d.length;
    const churnPct = paidAtStart > 0 ? (churned30d.length / paidAtStart) * 100 : 0;
    const retentionPct = 100 - churnPct;

    const featureUsage: Record<string, number> = {};
    for (const f of globalUsage as any[]) {
      if (f?.feature) featureUsage[f.feature] = f.count || 0;
    }

    return c.json({
      totalUsers: users.length,
      activeUsersLast7d: users.filter((u) => u.last_sign_in_at && Date.now() - new Date(u.last_sign_in_at).getTime() < 7 * 86400000).length,
      paidUsers,
      freeUsers,
      mrr,
      arr: mrr * 12,
      arpu,
      churnPct,
      retentionPct,
      churnedLast30d: churned30d.length,
      planDistribution,
      featureUsage,
    });
  } catch (e) {
    console.log("Admin metrics failed:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.get("/make-server-a3fe149f/admin/users", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  try {
    const { data: list, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return c.json({ error: error.message }, 500);
    const users = list?.users || [];

    const enriched = await Promise.all(users.map(async (u) => {
      const txs = await kv.getByPrefix(`user:${u.id}:transactions:`);
      const sub = (await kv.get(`subscription:${u.id}`)) || { planId: "free" };
      const offer = await kv.get(`offer-user:${u.id}`);
      const usage = await kv.getByPrefix(`usage:${u.id}:`);
      return {
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name || "",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        txCount: txs.length,
        planId: sub.planId,
        hasOffer: !!offer,
        featureCount: usage.reduce((s: number, x: any) => s + (x.count || 0), 0),
      };
    }));

    return c.json({ items: enriched });
  } catch (e) {
    console.log("Admin users list failed:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.get("/make-server-a3fe149f/admin/users/:id", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  try {
    const id = c.req.param("id");
    const { data: u, error } = await supabase.auth.admin.getUserById(id);
    if (error) return c.json({ error: error.message }, 404);

    const [txs, goals, loans, docs, assets, liab, sub, offer, events, overrides, settings] = await Promise.all([
      kv.getByPrefix(`user:${id}:transactions:`),
      kv.getByPrefix(`user:${id}:goals:`),
      kv.getByPrefix(`user:${id}:loans:`),
      kv.getByPrefix(`user:${id}:documents:`),
      kv.getByPrefix(`user:${id}:assets:`),
      kv.getByPrefix(`user:${id}:liabilities:`),
      kv.get(`subscription:${id}`),
      kv.get(`offer-user:${id}`),
      kv.getByPrefix(`events:${id}:`),
      kv.get(`feature-overrides:${id}`),
      kv.getByPrefix(`user:${id}:settings:`),
    ]);
    const onboarding = (settings as any[]).find((s) => s?.id === "onboarding") || null;

    const features: Record<string, number> = {};
    for (const e of events as any[]) {
      const f = e.feature;
      if (!f) continue;
      features[f] = (features[f] || 0) + 1;
    }

    return c.json({
      user: { id: u.user?.id, email: u.user?.email, name: u.user?.user_metadata?.name, createdAt: u.user?.created_at, lastSignInAt: u.user?.last_sign_in_at },
      txCount: txs.length,
      goalCount: goals.length,
      loanCount: loans.length,
      docCount: docs.length,
      assetCount: assets.length,
      liabCount: liab.length,
      planId: sub?.planId,
      subscription: sub || { planId: "free" },
      offer,
      features,
      featureOverrides: overrides || {},
      onboarding,
      allFeatures: ALL_FEATURES,
      recentEvents: (events as any[]).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 25),
    });
  } catch (e) {
    console.log("Admin user detail failed:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// Plans CRUD
app.get("/make-server-a3fe149f/admin/plans", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  await ensureDefaultPlans();
  const items = await kv.getByPrefix("admin:plan:");
  return c.json({ items });
});

app.post("/make-server-a3fe149f/admin/plans", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  try {
    const body = await c.req.json();
    const id = body.id || crypto.randomUUID();
    const item = { ...body, id, updatedAt: new Date().toISOString() };
    await kv.set(`admin:plan:${id}`, item);
    return c.json({ item });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Per-user feature overrides — admin can toggle individual features on/off.
app.get("/make-server-a3fe149f/admin/users/:id/features", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  const overrides = (await kv.get(`feature-overrides:${c.req.param("id")}`)) || {};
  return c.json({ overrides, allFeatures: ALL_FEATURES });
});

app.post("/make-server-a3fe149f/admin/users/:id/features", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  try {
    const userId = c.req.param("id");
    const { feature, enabled } = await c.req.json();
    if (!feature) return c.json({ error: "Missing feature" }, 400);
    const cur = (await kv.get(`feature-overrides:${userId}`)) || {};
    cur[feature] = !!enabled;
    await kv.set(`feature-overrides:${userId}`, cur);
    // Notify the user
    {
      const nid = crypto.randomUUID();
      const ts = Date.now();
      await kv.set(`notify:${userId}:${ts}:${nid}`, {
        id: nid,
        title: enabled ? "Feature unlocked" : "Feature disabled",
        body: `${feature} has been ${enabled ? "enabled" : "disabled"} on your account.`,
        kind: enabled ? "success" : "info",
        at: new Date(ts).toISOString(),
        read: false,
      });
    }
    return c.json({ ok: true, overrides: cur });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.delete("/make-server-a3fe149f/admin/plans/:id", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  await kv.del(`admin:plan:${c.req.param("id")}`);
  return c.json({ ok: true });
});

// Assign plan to user (admin) — also activates all plan features as overrides.
app.post("/make-server-a3fe149f/admin/users/:id/plan", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  try {
    const userId = c.req.param("id");
    const { planId } = await c.req.json();
    const plan = planId ? await kv.get(`admin:plan:${planId}`) : null;
    const prev = await kv.get(`subscription:${userId}`);
    const isChurn = prev && prev.planId && prev.planId !== "free" && (!planId || planId === "free");
    if (isChurn) {
      const ts = Date.now();
      await kv.set(`churn:${userId}:${ts}`, {
        userId, from: prev.planId, to: planId || "free", at: new Date(ts).toISOString(),
      });
    }
    const sub: any = { planId: planId || "", since: new Date().toISOString() };
    if (plan?.trialDays) sub.trialEndsAt = new Date(Date.now() + plan.trialDays * 86400000).toISOString();
    if (planId === "pro") sub.renewsAt = new Date(Date.now() + 30 * 86400000).toISOString();
    if (planId === "lifetime") sub.lifetime = true;
    await kv.set(`subscription:${userId}`, sub);

    // Activate features of this plan as overrides (admin grants them explicitly)
    if (plan?.features?.length) {
      const overrides: Record<string, boolean> = {};
      for (const f of plan.features) overrides[f.key] = true;
      await kv.set(`feature-overrides:${userId}`, overrides);
    }

    {
      const nid = crypto.randomUUID();
      const ts = Date.now();
      await kv.set(`notify:${userId}:${ts}:${nid}`, {
        id: nid,
        title: planId ? `Plan activated · ${plan?.name || planId}` : "Plan removed",
        body: planId ? `Your ${plan?.name || planId} plan is now active.` : "You have been moved to Free.",
        kind: "success",
        at: new Date(ts).toISOString(),
        read: false,
      });
    }
    return c.json({ ok: true, subscription: sub });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// User-facing notifications
app.get("/make-server-a3fe149f/me/notifications", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const raw = await kv.getByPrefix(`notify:${userId}:`);
  // Dedup by id — pick the entry with read=true if any duplicate exists (newer state wins)
  const byId = new Map<string, any>();
  for (const n of raw as any[]) {
    const existing = byId.get(n.id);
    if (!existing || (n.read && !existing.read)) byId.set(n.id, n);
  }
  const items = Array.from(byId.values()).sort((a, b) => (a.at < b.at ? 1 : -1));
  return c.json({ items });
});

app.post("/make-server-a3fe149f/me/notifications/read", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const items = await kv.getByPrefix(`notify:${userId}:`);
  for (const n of items as any[]) {
    if (!n.read) await kv.set(`notify:${userId}:${new Date(n.at).getTime()}:${n.id}`, { ...n, read: true });
  }
  return c.json({ ok: true });
});

// Offers — per-user (personalised) or global
app.get("/make-server-a3fe149f/admin/offers", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  const userOffers = (await kv.getByPrefix("offer-user:")).map((o: any) => ({ ...o, scope: "user" }));
  const global = (await kv.getByPrefix("offer-global:")).map((o: any) => ({ ...o, scope: "global" }));
  return c.json({ items: [...global, ...userOffers] });
});

app.post("/make-server-a3fe149f/admin/offers", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  try {
    const body = await c.req.json(); // { scope, userId?, title, description?, discountPct?, planId?, expiresAt? }
    const id = crypto.randomUUID();
    const item = { ...body, id, createdAt: new Date().toISOString(), createdBy: admin.email };
    if (body.scope === "user" && body.userId) {
      await kv.set(`offer-user:${body.userId}`, item);
      const nid = crypto.randomUUID();
      await kv.set(`notify:${body.userId}:${Date.now()}:${nid.slice(0, 6)}`, {
        id: nid,
        title: `Offer: ${body.title}`,
        body: body.description || `${body.discountPct || 0}% off${body.planId ? ` on ${body.planId}` : ""}`,
        kind: "offer",
        at: new Date().toISOString(),
        read: false,
      });
    } else {
      await kv.set(`offer-global:${id}`, { ...item, scope: "global" });
    }
    return c.json({ item });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.delete("/make-server-a3fe149f/admin/offers/user/:userId", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  await kv.del(`offer-user:${c.req.param("userId")}`);
  return c.json({ ok: true });
});

app.delete("/make-server-a3fe149f/admin/offers/global/:id", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  await kv.del(`offer-global:${c.req.param("id")}`);
  return c.json({ ok: true });
});

// ─── AI: merchant normalization (paid + AI opt-in) ──────────────────────
// ─── AI: Gemini Integration ──────────────────────
async function queryGemini(prompt: string, isJson: boolean = false): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
  const body: any = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };
  if (isJson) {
    body.generationConfig = {
      responseMimeType: "application/json"
    };
  }
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${txt}`);
  }
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

app.post("/make-server-a3fe149f/ai/normalize-merchants", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const { merchants } = await c.req.json();
    if (!Array.isArray(merchants) || merchants.length === 0) {
      return c.json({ error: "merchants must be a non-empty array" }, 400);
    }
    const list: string[] = merchants.slice(0, 100).map((m: any) => String(m).slice(0, 120));

    // Entitlement check: import feature must be unlocked for this user
    const sub = await kv.get(`subscription:${userId}`);
    const overrides = (await kv.get(`feature-overrides:${userId}`)) || {};
    const inTrial = sub?.trialEndsAt ? new Date(sub.trialEndsAt).getTime() > Date.now() : false;
    const planUnlocks = sub?.planId === "pro" || sub?.planId === "lifetime" || inTrial;
    const allowed = overrides.import === true || (overrides.import !== false && planUnlocks);
    if (!allowed) return c.json({ error: "Import feature locked. Upgrade to Pro to use AI categorization." }, 402);

    const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return c.json({ items: list.map((m) => ({ input: m, canonical: m, category: "Uncategorised" })), aiUsed: false });
    }

    const prompt = `You normalise messy merchant strings from bank/UPI statements into clean canonical brand names and a category.\n` +
      `Return a JSON object: {"items":[{"input":"...","canonical":"...","category":"..."}]} with one entry per input in the same order.\n` +
      `Use one of these categories when possible: Food, Travel, Shopping, Grocery, Medical, Rent, Entertainment, Bills, Salary, Transfer, Other.\n` +
      `Examples: "UPI/FLIPKART INDIA PVT LTD/ABC" → {canonical:"Flipkart", category:"Shopping"}; "ZOMATO BLR" → {canonical:"Zomato", category:"Food"}.\n` +
      `Inputs: ${JSON.stringify(list)}`;

    let items = [];
    try {
      const text = await queryGemini(prompt, true);
      const parsed = JSON.parse(text);
      items = Array.isArray(parsed.items) ? parsed.items : list.map((m) => ({ input: m, canonical: m, category: "Uncategorised" }));
    } catch (e) {
      console.log("Gemini normalise failed:", e);
      items = list.map((m) => ({ input: m, canonical: m, category: "Uncategorised" }));
    }
    return c.json({ items, aiUsed: true });
  } catch (e) {
    console.log("AI normalize exception:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.post("/make-server-a3fe149f/ai/coach", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const { message, history, context } = await c.req.json();
    
    // ── Daily rate limit: 3 AI chats per user per day ──
    const today = new Date().toISOString().slice(0, 10);
    const rateLimitKey = `ai-coach-limit:${userId}:${today}`;
    const usage = (await kv.get(rateLimitKey)) || { count: 0 };
    if (usage.count >= 3) {
      return c.json({ error: "Daily AI Coach limit reached (3/3). Resets at midnight." }, 429);
    }
    
    // Construct Gemini chat messages
    const contents = [];
    
    // System instruction/context
    const systemPrompt = `You are the AI Financial Advisor / Coach for LiveSync AI, a personal financial operating system built for Indian families.\n` +
      `Your tone is professional, encouraging, practical, and family-oriented.\n` +
      `Format values in Indian Rupees (e.g. ₹10,000) or standard percentages.\n` +
      `Avoid generic advice. Use the user's specific context below to give personalized, concrete recommendations.\n` +
      `Redact or respect privacy when categories only mode is indicated.\n\n` +
      `USER FINANCIAL CONTEXT:\n${JSON.stringify(context, null, 2)}`;
      
    contents.push({
      role: "user",
      parts: [{ text: systemPrompt }]
    });
    contents.push({
      role: "model",
      parts: [{ text: "Understood. I will act as a helpful AI Financial Advisor for LiveSync AI and use this context to answer user queries with concrete, Indian-family-focused recommendations in Rupees." }]
    });
    
    // Add history
    if (Array.isArray(history)) {
      for (const msg of history) {
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.text }]
        });
      }
    }
    
    // Add current message
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });
    
    const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return c.json({ text: "AI Coach is in offline demo mode. Please configure GEMINI_API_KEY on the server to activate real AI responses." });
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    console.log(`AI Coach request for user ${userId} — usage: ${usage.count + 1}/3`);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents })
    });
    
    if (!res.ok) {
      const txt = await res.text();
      console.log("Gemini coach failed:", res.status, txt);
      return c.json({ error: `Gemini error ${res.status}: ${txt.slice(0, 200)}` }, 500);
    }
    
    const aiJson = await res.json();
    const text = aiJson.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";
    
    // Increment rate limit counter on success
    await kv.set(rateLimitKey, { count: usage.count + 1, lastAt: new Date().toISOString() });
    
    return c.json({ text });
  } catch (e) {
    console.log("AI coach exception:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// ─── Country switch: wipe cloud-synced collections for the user ──────────
app.post("/make-server-a3fe149f/me/switch-country", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const { country } = await c.req.json();
    if (!country || typeof country !== "string") return c.json({ error: "Missing country code" }, 400);

    // Entitlement check: country switch is paid
    const sub = await kv.get(`subscription:${userId}`);
    const plan = sub?.planId ? await kv.get(`admin:plan:${sub.planId}`) : null;
    const overrides = (await kv.get(`feature-overrides:${userId}`)) || {};
    const inTrial = sub?.trialEndsAt ? new Date(sub.trialEndsAt).getTime() > Date.now() : false;
    const planUnlocks = sub?.planId === "pro" || sub?.planId === "lifetime" || inTrial;
    const allowed = overrides.country === true || (overrides.country !== false && planUnlocks);
    if (!allowed) return c.json({ error: "Country switching is a Pro feature." }, 402);

    // Wipe user-scoped collections. Preserve: settings, subscription, notifications, documents, profile.
    const wipeCols = ["transactions", "goals", "loans", "assets", "liabilities", "categories", "budgets", "subscriptions", "lifeEvents"];
    let removed = 0;
    for (const col of wipeCols) {
      const prefix = `user:${userId}:${col}:`;
      const items = await kv.getByPrefix(prefix);
      for (const it of items) {
        const id = it?.id;
        if (id) { await kv.del(`${prefix}${id}`); removed++; }
      }
    }

    // Update preferences with new country
    const prefsKey = `user:${userId}:settings:preferences`;
    const prefs = (await kv.get(prefsKey)) || { id: "preferences" };
    await kv.set(prefsKey, { ...prefs, id: "preferences", country, updatedAt: new Date().toISOString() });

    // Notify the user
    const ts = Date.now();
    const switchNid = crypto.randomUUID();
    await kv.set(`notify:${userId}:${ts}:${switchNid}`, {
      id: switchNid,
      title: `Region set to ${country}`,
      body: `Cleared ${removed} cloud records. Your new books follow ${country}'s tax year and currency.`,
      kind: "info",
      at: new Date(ts).toISOString(),
      read: false,
    });

    return c.json({ ok: true, removed, country });
  } catch (e) {
    console.log("Country switch exception:", e);
    return c.json({ error: String(e) }, 500);
  }
});

// --- App feedback (user reports issue / suggestion) ---
app.post("/make-server-a3fe149f/feedback", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const body = await c.req.json(); // { kind, message, screen?, severity? }
    const msg = (body.message || "").toString().trim();
    if (!msg) return c.json({ error: "Message is required" }, 400);
    const id = crypto.randomUUID();
    const ts = Date.now();
    const { data: u } = await supabase.auth.getUser(c.req.header("Authorization")?.split(" ")[1] || "");
    const item = {
      id,
      userId,
      userEmail: u.user?.email || null,
      userName: u.user?.user_metadata?.name || null,
      kind: body.kind || "issue",
      severity: body.severity || "normal",
      screen: body.screen || null,
      message: msg.slice(0, 4000),
      createdAt: new Date(ts).toISOString(),
      status: "open",
    };
    await kv.set(`feedback:${userId}:${ts}:${id}`, item);
    return c.json({ item });
  } catch (e) {
    console.log("Feedback submit failed:", e);
    return c.json({ error: String(e) }, 500);
  }
});

app.get("/make-server-a3fe149f/feedback", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  const items = await kv.getByPrefix(`feedback:${userId}:`);
  return c.json({ items: (items as any[]).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
});

app.get("/make-server-a3fe149f/admin/feedback", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  const items = await kv.getByPrefix("feedback:");
  return c.json({ items: (items as any[]).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) });
});

app.post("/make-server-a3fe149f/admin/feedback/:userId/:id/status", async (c) => {
  const admin = await resolveAdmin(c);
  if (!admin) return c.json({ error: "Not an admin" }, 403);
  try {
    const { userId, id } = c.req.param();
    const { status } = await c.req.json();
    const prefix = `feedback:${userId}:`;
    const items = (await kv.getByPrefix(prefix)) as any[];
    const target = items.find((x) => x.id === id);
    if (!target) return c.json({ error: "Not found" }, 404);
    const key = `feedback:${userId}:${new Date(target.createdAt).getTime()}:${id}`;
    const updated = { ...target, status, resolvedAt: status === "resolved" ? new Date().toISOString() : undefined, resolvedBy: status === "resolved" ? admin.email : undefined };
    await kv.set(key, updated);
    return c.json({ item: updated });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

app.post("/make-server-a3fe149f/buckets/:id/contributions", async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);
  try {
    const { id } = c.req.param(); // bucketId
    const body = await c.req.json();
    const contribId = body.id ?? crypto.randomUUID();
    const now = new Date().toISOString();

    // Fetch bucket
    const bucketKey = keyFor(userId, "buckets", id);
    const bucket = await kv.get(bucketKey);
    if (!bucket) return c.json({ error: "Bucket not found" }, 404);

    // Save contribution
    const contrib = {
      id: contribId,
      bucketId: id,
      userId,
      amount: Number(body.amount) || 0,
      sourceAccountId: body.sourceAccountId || null,
      note: body.note || "",
      date: body.date || now,
      linkedTransactionId: body.linkedTransactionId || null,
      createdAt: body.createdAt || now,
    };
    await kv.set(keyFor(userId, "bucketContributions", contribId), contrib);

    // Update bucket savedAmount
    bucket.savedAmount = (Number(bucket.savedAmount) || 0) + contrib.amount;
    if (bucket.savedAmount >= (Number(bucket.targetAmount) || 0)) {
      bucket.status = "completed";
    }
    bucket.updatedAt = now;
    await kv.set(bucketKey, bucket);

    return c.json({ item: contrib, bucket, justCompleted: bucket.status === "completed" });
  } catch (e) {
    console.log("Add bucket contribution failed:", e);
    return c.json({ error: String(e) }, 500);
  }
});

Deno.serve(app.fetch);
