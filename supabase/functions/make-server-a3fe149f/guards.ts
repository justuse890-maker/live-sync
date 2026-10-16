// Pure input-validation helpers for the edge function. No Deno or network
// dependencies, so they are unit-tested under Node (see tests/guards.test.ts).

export const MAX_RECORD_BYTES = 256 * 1024;
export const MAX_ID_LENGTH = 200;

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isValidEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 320 && EMAIL_RE.test(v);
}

export function isAcceptablePassword(v: unknown): v is string {
  return typeof v === "string" && v.length >= 8 && v.length <= 128;
}

export function isValidRecordId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= MAX_ID_LENGTH && !/[\u0000-\u001f]/.test(v);
}

/** True when the JSON-serialised value fits the per-record size budget. */
export function withinRecordLimit(v: unknown, limit = MAX_RECORD_BYTES): boolean {
  try {
    return new TextEncoder().encode(JSON.stringify(v)).length <= limit;
  } catch {
    return false;
  }
}

export function clampString(v: unknown, max: number, fallback = ""): string {
  if (typeof v !== "string") return fallback;
  return v.slice(0, max);
}

/** Feature/event keys are short identifiers, never free text. */
export function isValidFeatureKey(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9_.:-]{1,64}$/.test(v);
}

export const DOCUMENT_EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Verify the leading bytes agree with the declared MIME type (client-supplied types are untrusted). */
export function matchesMagicBytes(mime: string, bytes: Uint8Array): boolean {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  switch (mime) {
    case "application/pdf": return startsWith([0x25, 0x50, 0x44, 0x46]); // %PDF
    case "image/jpeg": return startsWith([0xff, 0xd8, 0xff]);
    case "image/png": return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp": return startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8); // RIFF....WEBP
    default: return false;
  }
}

/** A storage path is only usable by its owner if it lives under `<userId>/` with no traversal. */
export function isOwnedStoragePath(userId: string, path: unknown): path is string {
  return typeof path === "string"
    && path.startsWith(`${userId}/`)
    && !path.split("/").some((seg) => seg === ".." || seg === "." || seg === "");
}

export function isAdminEmailListed(email: string | undefined | null, adminEmails: string[]): boolean {
  return !!email && adminEmails.includes(email.trim().toLowerCase());
}

/**
 * Fixed-window in-memory limiter. Best effort only: edge instances are
 * ephemeral and not shared, so this blunts bursts but is not a substitute for
 * platform-level rate limiting.
 */
export function createRateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { n: number; resetAt: number }>();
  return (key: string): boolean => {
    const t = now();
    if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    const cur = hits.get(key);
    if (!cur || cur.resetAt <= t) {
      hits.set(key, { n: 1, resetAt: t + windowMs });
      return true;
    }
    cur.n += 1;
    return cur.n <= max;
  };
}

export const PAID_PLAN_IDS = ["pro", "lifetime"] as const;
export const SELF_SERVE_PLAN_IDS = ["free", ...PAID_PLAN_IDS] as const;

/**
 * Decide whether a self-serve plan change is allowed. Paid plans require
 * verified payment; until a payment provider is wired up the only way to get
 * one without paying is the explicit ALLOW_UNPAID_UPGRADES server flag.
 */
export function evaluateSelfServePlanChange(
  planId: unknown,
  allowUnpaid: boolean,
): { ok: true; planId: "free" | "pro" | "lifetime" } | { ok: false; status: 400 | 402; error: string } {
  if (typeof planId !== "string" || !(SELF_SERVE_PLAN_IDS as readonly string[]).includes(planId)) {
    return { ok: false, status: 400, error: "Unknown plan" };
  }
  if (planId !== "free" && !allowUnpaid) {
    return { ok: false, status: 402, error: "Online payments are not enabled yet. Please contact support to upgrade." };
  }
  return { ok: true, planId: planId as "free" | "pro" | "lifetime" };
}
