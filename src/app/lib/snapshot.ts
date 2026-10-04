/**
 * snapshot.ts — the ONE place where home-screen numbers are computed.
 *
 * Rules (no exceptions):
 *  • Every number comes from data the user entered on this device.
 *  • If the inputs for a number are missing, the number is `null` and the UI
 *    shows an empty state with a "how to fill this" action — never a default,
 *    benchmark, or placeholder value.
 *  • Every number carries the list of inputs it was built from so the detail
 *    screens can show exactly how it was calculated.
 *
 * The Dashboard, Financial Health, Net Worth and Budget screens all call this,
 * so the same figure is always identical everywhere.
 */
import { getMonthKey, shiftMonth, formatMonthName, getCurrentMonthKey } from "./dateUtils";
import type { Asset, Liability } from "./intelligence";
import { ASSET_LABELS, LIABILITY_LABELS } from "./intelligence";

const num = (v: unknown): number => {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string" && !v.startsWith("enc:")) {
    const n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }
  return 0;
};
const norm = (s?: string) => (s || "").trim().toLowerCase();

export type SnapshotInput = {
  transactions: Array<{ id: string; amount: number; type: "income" | "expense"; date: string; category: string; title?: string }>;
  assets: Asset[];
  liabilities: Liability[];
  investments: Array<{ id: string; name: string; type: string; currentValue: number; investedAmount: number }>;
  gold: Array<{ id: string; name: string; purchasePrice: number }>;
  properties: Array<{ id: string; name: string; currentValuation: number; purchasePrice: number }>;
  structuredLoans: Array<{ id: string; lenderName: string; loanType: string; outstandingPrincipal: number; emiAmount: number; closed?: boolean }>;
  loans: Array<{ id: string; person: string; amount: number; direction: string; settled?: boolean }>;
  budgets: Array<{ id: string; category: string; limit: number; color?: string; month?: string }>;
  buckets: Array<{ id: string; name: string; targetAmount: number; savedAmount: number; status: string; iconOrColor?: string; targetDate?: string }>;
  goals: Array<{ id: string; name: string; target: number; current: number; deadline?: string; icon?: string }>;
  sips: Array<{ amount: number; frequency?: string }>;
  insurance: Array<{ coverageAmount: number; type: string }>;
};

export type Line = { label: string; detail?: string; value: number };

export type Pillar = {
  key: "savings" | "runway" | "debt" | "investing" | "protection" | "budget";
  name: string;
  weight: number;
  score: number | null;           // null → not enough data
  metric: string;                 // what we measured
  basis: string;                  // how it was calculated, in plain words
  missing?: string;               // what to add when score is null
  screen: string;                 // where to fix / add data
};

export type MonthFlow = { key: string; label: string; income: number; expense: number; net: number; txCount: number };

function flowFor(tx: SnapshotInput["transactions"], key: string): MonthFlow {
  let income = 0, expense = 0, txCount = 0;
  for (const t of tx) {
    if (getMonthKey(t.date) !== key) continue;
    txCount++;
    if (t.type === "income") income += Math.abs(num(t.amount));
    else expense += Math.abs(num(t.amount));
  }
  return { key, label: formatMonthName(key, "short").split(" ")[0], income, expense, net: income - expense, txCount };
}

export function computeSnapshot(s: SnapshotInput, month: string) {
  const tx = s.transactions;
  const current = flowFor(tx, month);
  const prev = flowFor(tx, shiftMonth(month, -1));

  // ── 6-month series (only real months; empty months stay 0 and are flagged) ──
  const series: MonthFlow[] = [];
  for (let i = 5; i >= 0; i--) series.push(flowFor(tx, shiftMonth(month, -i)));
  const seriesHasData = series.some((m) => m.txCount > 0);

  // ── Average monthly spend: last 3 months that actually have expenses ──
  const recent = [0, 1, 2, 3, 4, 5].map((i) => flowFor(tx, shiftMonth(month, -i))).filter((m) => m.expense > 0).slice(0, 3);
  const avgMonthlyExpense = recent.length ? recent.reduce((a, m) => a + m.expense, 0) / recent.length : null;
  const incomeMonths = [0, 1, 2, 3, 4, 5].map((i) => flowFor(tx, shiftMonth(month, -i))).filter((m) => m.income > 0).slice(0, 3);
  const avgMonthlyIncome = incomeMonths.length ? incomeMonths.reduce((a, m) => a + m.income, 0) / incomeMonths.length : null;

  // ── Net worth (assets − liabilities), with every line listed ──
  const assetLines: Line[] = [];
  const assetNames = new Set<string>();
  for (const a of s.assets) {
    const v = num(a.value);
    if (v <= 0) continue;
    assetNames.add(norm(a.name));
    assetLines.push({ label: a.name || ASSET_LABELS[a.kind] || "Asset", detail: ASSET_LABELS[a.kind] || a.kind, value: v });
  }
  // Holdings entered on their own screens that are not mirrored as an asset yet
  for (const i of s.investments) {
    if (assetNames.has(norm(i.name))) continue;
    const v = num(i.currentValue) || num(i.investedAmount);
    if (v > 0) assetLines.push({ label: i.name, detail: "Investment", value: v });
  }
  for (const g of s.gold) {
    if (assetNames.has(norm(g.name))) continue;
    const v = num(g.purchasePrice);
    if (v > 0) assetLines.push({ label: g.name, detail: "Gold (purchase price)", value: v });
  }
  for (const p of s.properties) {
    if (assetNames.has(norm(p.name))) continue;
    const v = num(p.currentValuation) || num(p.purchasePrice);
    if (v > 0) assetLines.push({ label: p.name, detail: "Property", value: v });
  }

  const liabLines: Line[] = [];
  const liabNames = new Set<string>();
  for (const l of s.liabilities) {
    const v = num(l.outstanding);
    if (v <= 0) continue;
    liabNames.add(norm(l.name));
    liabLines.push({ label: l.name || LIABILITY_LABELS[l.kind], detail: LIABILITY_LABELS[l.kind] || l.kind, value: v });
  }
  for (const l of s.structuredLoans) {
    if (l.closed || liabNames.has(norm(l.lenderName))) continue;
    const v = num(l.outstandingPrincipal);
    if (v > 0) liabLines.push({ label: l.lenderName, detail: l.loanType.replace(/_/g, " "), value: v });
  }
  for (const l of s.loans) {
    if (l.settled || l.direction !== "borrowed") continue;
    const v = num(l.amount);
    if (v > 0) liabLines.push({ label: `Borrowed from ${l.person}`, detail: "Personal loan", value: v });
  }
  const totalAssets = assetLines.reduce((a, l) => a + l.value, 0);
  const totalLiab = liabLines.reduce((a, l) => a + l.value, 0);
  const netWorthHasData = assetLines.length > 0 || liabLines.length > 0;

  // ── Liquid money & runway ──
  const liquidLines: Line[] = s.assets
    .filter((a) => a.kind === "cash" || a.kind === "savings" || a.kind === "fd")
    .map((a) => ({ label: a.name, detail: ASSET_LABELS[a.kind], value: num(a.value) }))
    .filter((l) => l.value > 0);
  for (const i of s.investments) {
    if (i.type === "fixed_deposit" && !assetNames.has(norm(i.name))) {
      const v = num(i.currentValue) || num(i.investedAmount);
      if (v > 0) liquidLines.push({ label: i.name, detail: "Fixed Deposit", value: v });
    }
  }
  const liquid = liquidLines.reduce((a, l) => a + l.value, 0);
  const runwayMonths = liquid > 0 && avgMonthlyExpense ? liquid / avgMonthlyExpense : null;

  // ── Budget for the month ──
  // A budget with no month set is treated as a standing monthly budget.
  const monthBudgets = s.budgets.filter((b) => (b.month ? b.month === month : true) && num(b.limit) > 0);
  const budgetRows = monthBudgets.map((b) => {
    const spent = tx
      .filter((t) => t.type === "expense" && getMonthKey(t.date) === month && norm(t.category) === norm(b.category))
      .reduce((a, t) => a + Math.abs(num(t.amount)), 0);
    return { id: b.id, category: b.category, limit: num(b.limit), spent, color: b.color };
  });
  const budgetLimit = budgetRows.reduce((a, b) => a + b.limit, 0);
  const budgetSpent = budgetRows.reduce((a, b) => a + b.spent, 0);
  let daysLeft: number | null = null;
  if (month === getCurrentMonthKey()) {
    const now = new Date();
    daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  }

  // ── Goals (savings buckets + classic goals) ──
  const goalRows = [
    ...s.buckets
      .filter((b) => b.status !== "archived" && num(b.targetAmount) > 0)
      .map((b) => ({ id: b.id, name: b.name, saved: num(b.savedAmount), target: num(b.targetAmount), kind: "bucket" as const, icon: (b.iconOrColor || "").split(":")[0] })),
    ...s.goals
      .filter((g) => num(g.target) > 0)
      .map((g) => ({ id: g.id, name: g.name, saved: num(g.current), target: num(g.target), kind: "goal" as const, icon: g.icon || "" })),
  ].map((g) => ({ ...g, pct: Math.min(100, Math.round((g.saved / g.target) * 100)) }));

  // ── Health pillars ──
  const incomeBase = current.income > 0 ? current.income : avgMonthlyIncome;
  const expenseBase = current.expense > 0 ? current.expense : avgMonthlyExpense;
  const pillars: Pillar[] = [];

  // 1. Savings rate
  if (incomeBase && expenseBase !== null) {
    const rate = ((incomeBase - (expenseBase ?? 0)) / incomeBase) * 100;
    const score = rate >= 30 ? 100 : rate >= 20 ? 85 + (rate - 20) * 1.5 : rate >= 10 ? 65 + (rate - 10) * 2 : rate > 0 ? 40 + rate * 2.5 : 15;
    pillars.push({
      key: "savings", name: "Savings rate", weight: 25, score: Math.round(score),
      metric: `${rate.toFixed(1)}% of income saved`,
      basis: `(Income ${inrPlain(incomeBase)} − spend ${inrPlain(expenseBase ?? 0)}) ÷ income${current.income > 0 ? ` for ${formatMonthName(month)}` : " (average of recent months)"}. 30%+ scores 100.`,
      screen: "transactions",
    });
  } else {
    pillars.push({ key: "savings", name: "Savings rate", weight: 25, score: null, metric: "—", basis: "Needs income and expense entries.", missing: "Add your income and expenses", screen: "transactions" });
  }

  // 2. Emergency runway
  if (runwayMonths !== null) {
    const r = runwayMonths;
    const score = r >= 6 ? 100 : r >= 3 ? 75 + ((r - 3) / 3) * 25 : r >= 1 ? 45 + ((r - 1) / 2) * 30 : 20 + r * 25;
    pillars.push({
      key: "runway", name: "Emergency runway", weight: 20, score: Math.round(score),
      metric: `${r.toFixed(1)} months covered`,
      basis: `Cash + savings + FDs (${inrPlain(liquid)}) ÷ average monthly spend (${inrPlain(avgMonthlyExpense ?? 0)}). 6 months scores 100.`,
      screen: "emergency",
    });
  } else {
    pillars.push({
      key: "runway", name: "Emergency runway", weight: 20, score: null, metric: "—",
      basis: "Needs savings/cash balances and at least one month of expenses.",
      missing: liquid > 0 ? "Add your expenses" : "Add your savings or cash balance in Net worth",
      screen: liquid > 0 ? "transactions" : "networth",
    });
  }

  // 3. Debt load (EMI-to-income)
  const totalEmi = s.structuredLoans.filter((l) => !l.closed).reduce((a, l) => a + num(l.emiAmount), 0) + s.liabilities.reduce((a, l) => a + num(l.emi), 0);
  const hasDebt = liabLines.length > 0;
  if (hasDebt && incomeBase) {
    const dti = (totalEmi / incomeBase) * 100;
    const score = dti <= 20 ? 95 : dti <= 35 ? 75 : dti <= 50 ? 50 : 25;
    pillars.push({
      key: "debt", name: "Debt load", weight: 20, score,
      metric: `EMIs are ${dti.toFixed(0)}% of income`,
      basis: `Monthly EMIs ${inrPlain(totalEmi)} ÷ income ${inrPlain(incomeBase)}. Under 20% scores highest.`,
      screen: "loans",
    });
  } else {
    pillars.push({
      key: "debt", name: "Debt load", weight: 20, score: null, metric: hasDebt ? "—" : "No loans recorded",
      basis: "Compares your monthly EMIs with your income.",
      missing: hasDebt ? "Add your income" : "Add any loans or credit card dues you have",
      screen: hasDebt ? "transactions" : "loans",
    });
  }

  // 4. Investing
  const monthlySip = s.sips.reduce((a, x) => a + (x.frequency === "quarterly" ? num(x.amount) / 3 : num(x.amount)), 0);
  if (monthlySip > 0 && incomeBase) {
    const ratio = (monthlySip / incomeBase) * 100;
    const score = Math.min(100, Math.round(40 + (ratio / 15) * 60));
    pillars.push({
      key: "investing", name: "Investing habit", weight: 15, score,
      metric: `${ratio.toFixed(1)}% of income in SIPs`,
      basis: `Monthly SIPs ${inrPlain(monthlySip)} ÷ income ${inrPlain(incomeBase)}. 15%+ scores 100.`,
      screen: "sip",
    });
  } else {
    pillars.push({
      key: "investing", name: "Investing habit", weight: 15, score: null, metric: "—",
      basis: "Compares your monthly SIPs with your income.",
      missing: monthlySip > 0 ? "Add your income" : "Add your SIPs",
      screen: monthlySip > 0 ? "transactions" : "sip",
    });
  }

  // 5. Protection
  const cover = s.insurance.reduce((a, p) => a + num(p.coverageAmount), 0);
  if (s.insurance.length > 0 && expenseBase) {
    const needed = expenseBase * 12 * 10; // 10 years of expenses
    const ratio = Math.min(1, cover / needed);
    pillars.push({
      key: "protection", name: "Insurance cover", weight: 10, score: Math.round(30 + ratio * 70),
      metric: `${inrPlain(cover)} total cover`,
      basis: `Total cover ÷ 10 years of your spending (${inrPlain(needed)}).`,
      screen: "insurance",
    });
  } else {
    pillars.push({
      key: "protection", name: "Insurance cover", weight: 10, score: null, metric: "—",
      basis: "Compares your total cover with 10 years of your spending.",
      missing: s.insurance.length ? "Add your expenses" : "Add your insurance policies",
      screen: s.insurance.length ? "transactions" : "insurance",
    });
  }

  // 6. Budget discipline
  if (budgetRows.length > 0) {
    const within = budgetRows.filter((b) => b.spent <= b.limit).length;
    pillars.push({
      key: "budget", name: "Budget discipline", weight: 10, score: Math.round((within / budgetRows.length) * 100),
      metric: `${within} of ${budgetRows.length} budgets on track`,
      basis: `Share of ${formatMonthName(month)} category budgets where spend ≤ limit.`,
      screen: "budgets",
    });
  } else {
    pillars.push({ key: "budget", name: "Budget discipline", weight: 10, score: null, metric: "—", basis: "Checks your category budgets.", missing: "Set a monthly budget", screen: "budgets" });
  }

  const scored = pillars.filter((p) => p.score !== null);
  const weightSum = scored.reduce((a, p) => a + p.weight, 0);
  const healthScore = scored.length >= 2 ? Math.round(scored.reduce((a, p) => a + (p.score as number) * p.weight, 0) / weightSum) : null;

  return {
    month,
    current,
    prev,
    series,
    seriesHasData,
    avgMonthlyExpense,
    avgMonthlyIncome,
    netWorth: { hasData: netWorthHasData, totalAssets, totalLiab, value: totalAssets - totalLiab, assetLines, liabLines },
    liquid: { total: liquid, lines: liquidLines },
    runwayMonths,
    budget: { rows: budgetRows, limit: budgetLimit, spent: budgetSpent, daysLeft },
    goals: goalRows,
    pillars,
    healthScore,
    scoredCount: scored.length,
  };
}

export type Snapshot = ReturnType<typeof computeSnapshot>;

function inrPlain(n: number) {
  return "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");
}

export function healthLabel(score: number | null): { title: string; tone: "emerald" | "indigo" | "amber" | "rose" | "slate" } {
  if (score === null) return { title: "Not enough data yet", tone: "slate" };
  if (score >= 85) return { title: "Excellent", tone: "emerald" };
  if (score >= 70) return { title: "Healthy", tone: "indigo" };
  if (score >= 50) return { title: "Fair", tone: "amber" };
  return { title: "Needs attention", tone: "rose" };
}

/** Real, data-driven insights. Returns [] when there is nothing true to say. */
export function buildInsights(snap: Snapshot, tx: SnapshotInput["transactions"]) {
  const out: Array<{ id: string; tone: "good" | "warn" | "info"; text: string; screen: string }> = [];
  const isCurrent = snap.month === getCurrentMonthKey();
  const day = new Date().getDate();

  // Month-over-month spend (same period for the running month)
  if (snap.prev.expense > 0 && snap.current.expense > 0) {
    let prevComparable = snap.prev.expense;
    if (isCurrent) {
      prevComparable = tx
        .filter((t) => t.type === "expense" && getMonthKey(t.date) === snap.prev.key && Number(String(t.date).slice(8, 10)) <= day)
        .reduce((a, t) => a + Math.abs(num(t.amount)), 0);
    }
    if (prevComparable > 0) {
      const delta = ((snap.current.expense - prevComparable) / prevComparable) * 100;
      if (Math.abs(delta) >= 5) {
        out.push({
          id: "mom",
          tone: delta < 0 ? "good" : "warn",
          text: isCurrent
            ? `You spent ${Math.abs(delta).toFixed(0)}% ${delta < 0 ? "less" : "more"} than in the first ${day} days of ${snap.prev.label}.`
            : `You spent ${Math.abs(delta).toFixed(0)}% ${delta < 0 ? "less" : "more"} than in ${snap.prev.label}.`,
          screen: "spending-patterns",
        });
      }
    }
  }

  // Top category this month
  const byCat = new Map<string, number>();
  for (const t of tx) {
    if (t.type !== "expense" || getMonthKey(t.date) !== snap.month) continue;
    byCat.set(t.category || "Other", (byCat.get(t.category || "Other") || 0) + Math.abs(num(t.amount)));
  }
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && snap.current.expense > 0) {
    out.push({
      id: "topcat",
      tone: "info",
      text: `${top[0]} is your biggest spend this month — ${Math.round((top[1] / snap.current.expense) * 100)}% of expenses.`,
      screen: "spending-patterns",
    });
  }

  // Over-budget categories
  const over = snap.budget.rows.filter((b) => b.spent > b.limit);
  if (over.length) {
    out.push({ id: "over", tone: "warn", text: `${over.map((b) => b.category).join(", ")} ${over.length > 1 ? "are" : "is"} over budget.`, screen: "budgets" });
  }

  // Savings this month
  if (snap.current.income > 0 && snap.current.net > 0) {
    out.push({ id: "saved", tone: "good", text: `You've kept ${Math.round((snap.current.net / snap.current.income) * 100)}% of this month's income so far.`, screen: "money-flow" });
  }
  return out;
}
