/**
 * salarySplit.ts — "every rupee has a home": divide a salary across buckets by the percentage
 * the user gave each one. Pure and deterministic; the UI shows the plan and the user confirms.
 *
 * Rounding: amounts are whole rupees and always add up to exactly the allocated share
 * (largest-remainder method), so nothing is created or lost in rounding.
 */
export type BucketKind = "need" | "want" | "gold" | "chit" | "goal";

export const BUCKET_KINDS: Array<{ id: BucketKind; label: string; hint: string }> = [
  { id: "need", label: "Need", hint: "Rent, groceries, bills" },
  { id: "want", label: "Want", hint: "Fun, travel, shopping" },
  { id: "goal", label: "Goal", hint: "Car, home, education" },
  { id: "gold", label: "Gold", hint: "Gold savings" },
  { id: "chit", label: "Chit", hint: "Chit fund / committee" },
];

export type SplitBucket = { id: string; name: string; allocPct?: number; kind?: BucketKind };
export type SplitRow = { id: string; name: string; pct: number; amount: number };

export type SplitPlan = {
  rows: SplitRow[];
  allocatedPct: number;
  allocatedAmount: number;
  /** Salary not assigned to any bucket — stays with the user, never silently dropped. */
  unallocated: number;
  /** null when the plan is usable. */
  problem: null | "no_salary" | "no_allocations" | "over_100";
};

export function planSalarySplit(salary: number, buckets: SplitBucket[]): SplitPlan {
  const withPct = buckets.filter((b) => Number(b.allocPct) > 0);
  const allocatedPct = withPct.reduce((s, b) => s + Number(b.allocPct), 0);
  const empty = (problem: SplitPlan["problem"]): SplitPlan => ({ rows: [], allocatedPct, allocatedAmount: 0, unallocated: Math.max(0, salary), problem });
  if (!(salary > 0)) return empty("no_salary");
  if (withPct.length === 0) return empty("no_allocations");
  if (allocatedPct > 100.0001) return empty("over_100");

  const whole = Math.floor(salary);
  const target = Math.round((whole * allocatedPct) / 100);
  const raw = withPct.map((b) => ({ b, exact: (whole * Number(b.allocPct)) / 100 }));
  const floors = raw.map((r) => Math.floor(r.exact));
  let left = target - floors.reduce((s, n) => s + n, 0);
  const order = raw.map((r, i) => ({ i, frac: r.exact - floors[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const o of order) { if (left <= 0) break; floors[o.i] += 1; left--; }

  const rows = raw.map((r, i) => ({ id: r.b.id, name: r.b.name, pct: Number(r.b.allocPct), amount: floors[i] }));
  const allocatedAmount = rows.reduce((s, r) => s + r.amount, 0);
  return { rows, allocatedPct, allocatedAmount, unallocated: salary - allocatedAmount, problem: null };
}

/** Largest salary-like income credited in the month, as a starting figure for the split. */
export function suggestedSalary(
  txs: Array<{ type: string; amount: number; date: string; category?: string; title?: string; isTransfer?: boolean }>,
  monthKey: string,
): number | null {
  let best: number | null = null;
  for (const t of txs) {
    if (t.type !== "income" || t.isTransfer || String(t.date).slice(0, 7) !== monthKey) continue;
    if (!/salary|payroll|stipend|pay\s?check/i.test(`${t.category || ""} ${t.title || ""}`)) continue;
    const a = Math.abs(t.amount);
    if (best === null || a > best) best = a;
  }
  return best;
}
