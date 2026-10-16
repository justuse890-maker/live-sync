/**
 * recurring.ts — spot bills that repeat every month, and flag when one quietly gets dearer.
 *
 * Simple rules a person can check, all on the phone:
 *   • group expenses by merchant / title
 *   • monthly = the typical gap between payments is 26–35 days
 *   • mature = 3 or more payments (2 is only an early guess), stale = nothing for 45+ days
 *   • a "fixed bill" has near-constant earlier amounts (within 10%) — electricity or groceries that always vary never
 *     count as a price rise
 * Transfers and income are ignored. Titles that are not text are tolerated (see safeText.ts).
 */
import { normKey, safeText } from "./safeText";

type Row = { type: string; amount: number; date: string; title?: unknown; merchant?: unknown; isTransfer?: boolean };

export type RecurringStream = {
  key: string;
  label: string;
  count: number;
  lastDate: string;
  lastAmount: number;
  /** Median of every payment before the latest one. */
  previousAmount: number;
  fixedAmount: boolean;
  status: "early" | "mature" | "stale";
};

const DAY = 86400000;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const toTime = (d: string) => new Date(`${String(d).slice(0, 10)}T12:00:00`).getTime();

export function detectRecurring(txs: Row[], now = new Date()): RecurringStream[] {
  const groups = new Map<string, Array<{ at: number; date: string; amount: number; label: string }>>();
  for (const t of txs) {
    if (t.type !== "expense" || t.isTransfer) continue;
    const label = safeText(t.merchant) || safeText(t.title);
    const key = normKey(label);
    const at = toTime(t.date);
    if (!key || !Number.isFinite(at)) continue;
    const arr = groups.get(key) ?? [];
    arr.push({ at, date: String(t.date).slice(0, 10), amount: Math.abs(t.amount), label });
    groups.set(key, arr);
  }

  const out: RecurringStream[] = [];
  for (const [key, rows] of groups) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => a.at - b.at);
    const gaps = rows.slice(1).map((r, i) => (r.at - rows[i].at) / DAY);
    const g = median(gaps);
    if (g < 26 || g > 35) continue;

    const last = rows[rows.length - 1];
    const earlier = rows.slice(0, -1).map((r) => r.amount);
    const prev = median(earlier);
    const spread = prev > 0 ? (Math.max(...earlier) - Math.min(...earlier)) / prev : 1;
    const stale = (now.getTime() - last.at) / DAY > 45;
    out.push({
      key, label: last.label, count: rows.length, lastDate: last.date, lastAmount: last.amount,
      previousAmount: prev, fixedAmount: spread <= 0.1,
      status: stale ? "stale" : rows.length >= 3 ? "mature" : "early",
    });
  }
  return out.sort((a, b) => b.lastAmount - a.lastAmount);
}

export type BillRise = { label: string; previous: number; latest: number; risePct: number; lastDate: string };

/** Mature, fixed-amount monthly bills whose latest payment is at least `minRisePct` above the usual. */
export function billRises(streams: RecurringStream[], minRisePct = 10): BillRise[] {
  return streams
    .filter((s) => s.status === "mature" && s.fixedAmount && s.previousAmount > 0)
    .map((s) => ({ label: s.label, previous: Math.round(s.previousAmount), latest: Math.round(s.lastAmount), risePct: ((s.lastAmount - s.previousAmount) / s.previousAmount) * 100, lastDate: s.lastDate }))
    .filter((r) => r.risePct >= minRisePct);
}
