/**
 * alertPrefs.ts — what the user has asked the in-app alert feed to do, and the rules that apply it.
 *
 *   budgetWarnPct   the "you've used most of this budget" level (50–95%, default 85)
 *   paceAlerts      early heads-up when the month's pace will pass a budget
 *   muted           alert kinds the user switched off
 *   snoozedUntil    alert kinds silenced for a few days
 *
 * Two promises: an URGENT alert (an EMI or card bill due within a day, a budget already exceeded) is never muted or
 * snoozed — hiding it could cost the user money — and a burst of more than five ordinary alerts becomes one summary
 * line instead of a wall of notifications.
 */
export type AlertLike = { id: string; title: string; body: string; kind: string; severity: "urgent" | "warning" | "info"; at: string; read?: boolean; [k: string]: unknown };

export type AlertPrefs = {
  budgetWarnPct: number;
  paceAlerts: boolean;
  muted: string[];
  snoozedUntil: Record<string, string>;
};

export const DEFAULT_PREFS: AlertPrefs = { budgetWarnPct: 85, paceAlerts: true, muted: [], snoozedUntil: {} };
export const MAX_INDIVIDUAL = 5;
const STORE_KEY = "ls_alert_prefs";

export function normalizePrefs(raw: unknown): AlertPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pct = Number(r.budgetWarnPct);
  const snoozed: Record<string, string> = {};
  if (r.snoozedUntil && typeof r.snoozedUntil === "object") {
    for (const [k, v] of Object.entries(r.snoozedUntil as Record<string, unknown>)) if (typeof v === "string") snoozed[k] = v;
  }
  return {
    budgetWarnPct: Number.isFinite(pct) && r.budgetWarnPct !== undefined && r.budgetWarnPct !== null ? Math.min(95, Math.max(50, Math.round(pct))) : DEFAULT_PREFS.budgetWarnPct,
    paceAlerts: typeof r.paceAlerts === "boolean" ? r.paceAlerts : DEFAULT_PREFS.paceAlerts,
    muted: Array.isArray(r.muted) ? r.muted.filter((x): x is string => typeof x === "string") : [],
    snoozedUntil: snoozed,
  };
}

export function loadPrefs(): AlertPrefs {
  try { return normalizePrefs(JSON.parse(localStorage.getItem(STORE_KEY) || "null")); } catch { return { ...DEFAULT_PREFS }; }
}
export function savePrefs(p: AlertPrefs) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch { /* storage unavailable: choices last until the app closes */ }
}

export function snoozeKind(p: AlertPrefs, kind: string, days: number, now = new Date()): AlertPrefs {
  const until = new Date(now.getTime() + days * 86400000).toISOString();
  return { ...p, snoozedUntil: { ...p.snoozedUntil, [kind]: until } };
}
export function clearSnooze(p: AlertPrefs, kind: string): AlertPrefs {
  const { [kind]: _drop, ...rest } = p.snoozedUntil;
  return { ...p, snoozedUntil: rest };
}
export const isSnoozed = (p: AlertPrefs, kind: string, now = new Date()) => {
  const u = p.snoozedUntil[kind];
  return !!u && new Date(u).getTime() > now.getTime();
};

export function applyAlertPrefs<T extends AlertLike>(items: T[], prefs: AlertPrefs, now = new Date()): Array<T | AlertLike> {
  const visible = items.filter((i) => i.severity === "urgent" || (!prefs.muted.includes(i.kind) && !isSnoozed(prefs, i.kind, now)));
  const ordinary = visible.filter((i) => i.severity !== "urgent");
  if (ordinary.length <= MAX_INDIVIDUAL) return visible;

  const keep = new Set(ordinary.slice(0, MAX_INDIVIDUAL - 1));
  const rest = ordinary.slice(MAX_INDIVIDUAL - 1);
  const digest: AlertLike = {
    id: `digest:${rest.map((r) => r.id).join("|").slice(0, 80)}`,
    title: `${rest.length} more updates`,
    body: `${rest.length} more: ${rest.slice(0, 3).map((r) => r.title).join(" · ")}${rest.length > 3 ? " …" : ""}`,
    kind: "digest",
    severity: "info",
    at: rest[0].at,
    read: rest.every((r) => r.read),
  };
  const out: Array<T | AlertLike> = [];
  let placed = false;
  for (const i of visible) {
    if (i.severity === "urgent" || keep.has(i)) out.push(i);
    else if (!placed) { out.push(digest); placed = true; }
  }
  return out;
}
