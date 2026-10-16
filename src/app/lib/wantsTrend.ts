/**
 * wantsTrend.ts — is lifestyle spending (the "wants") growing faster than income?
 *
 * Twelve calendar months ending with the current one. For each: income, wants, and wants as a share of income.
 * The nudge compares the average of the latest six months with the six before: when wants have grown more than
 * 15 percentage points faster than income, we say so — once, plainly.
 */
import { classifyFlow } from "./intelligence";

type Row = { type: string; amount: number; date: string; title?: string; merchant?: string; category?: string; loanId?: string; isTransfer?: boolean };

export type WantsMonth = { key: string; income: number; wants: number; sharePct: number | null };

export const WANTS_NUDGE_GAP_PCT = 15;

export function wantsSeries(txs: Row[], now = new Date(), months = 12): WantsMonth[] {
  const keys = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const acc = new Map(keys.map((k) => [k, { income: 0, wants: 0 }]));
  for (const t of txs) {
    if (t.isTransfer) continue;
    const m = acc.get(String(t.date).slice(0, 7));
    if (!m) continue;
    const a = Math.abs(Number(t.amount) || 0);
    if (t.type === "income") m.income += a;
    else if (t.type === "expense" && classifyFlow(t as any) === "wants") m.wants += a;
  }
  return keys.map((key) => {
    const m = acc.get(key)!;
    return { key, income: m.income, wants: m.wants, sharePct: m.income > 0 ? (m.wants / m.income) * 100 : null };
  });
}

export type WantsVerdict = {
  verdict: "not_enough_data" | "outpacing" | "in_step" | "easing";
  incomeGrowthPct: number | null;
  wantsGrowthPct: number | null;
  gapPct: number | null;
};

/** Latest six months against the six before. Needs income and wants in at least two months of each half. */
export function wantsVerdict(series: WantsMonth[]): WantsVerdict {
  const half = Math.floor(series.length / 2);
  const old = series.slice(0, half), rec = series.slice(half);
  const usable = (h: WantsMonth[]) => h.filter((m) => m.income > 0);
  if (usable(old).length < 2 || usable(rec).length < 2) return { verdict: "not_enough_data", incomeGrowthPct: null, wantsGrowthPct: null, gapPct: null };
  const avg = (h: WantsMonth[], k: "income" | "wants") => usable(h).reduce((s, m) => s + m[k], 0) / usable(h).length;
  const oi = avg(old, "income"), ri = avg(rec, "income"), ow = avg(old, "wants"), rw = avg(rec, "wants");
  if (oi <= 0 || ow <= 0) return { verdict: "not_enough_data", incomeGrowthPct: null, wantsGrowthPct: null, gapPct: null };
  const incomeGrowthPct = ((ri - oi) / oi) * 100;
  const wantsGrowthPct = ((rw - ow) / ow) * 100;
  const gapPct = wantsGrowthPct - incomeGrowthPct;
  return { verdict: gapPct > WANTS_NUDGE_GAP_PCT ? "outpacing" : gapPct < -WANTS_NUDGE_GAP_PCT ? "easing" : "in_step", incomeGrowthPct, wantsGrowthPct, gapPct };
}
