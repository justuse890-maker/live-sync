/**
 * statements.ts — the three statements a CA would prepare for a client, built from the user's own records.
 *
 *   1. Statement of Income & Expenditure   (what came in, what was consumed, what was left)
 *   2. Cash-Flow Statement                 (operating / financing / investing, net change in cash)
 *   3. Statement of Assets & Liabilities   (net worth, grouped)
 *
 * Pure functions. Callers pass transactions that already exclude own-account transfers (the store's
 * `transactions`); rows flagged `isTransfer` are skipped here as a second safety.
 *
 * These are "prepared from your records" summaries — not audited and not a bank or tax-authority statement.
 */
import { classifyFlow } from "./intelligence";

export type StmtTx = {
  type: string;
  amount: number;
  date: string;
  category?: string;
  title?: string;
  merchant?: string;
  loanId?: string;
  isTransfer?: boolean;
};

export type Range = { from: string; to: string };
export type Line = { key: string; label: string; amount: number };

const abs = (n: number) => Math.abs(Number(n) || 0);
const inRange = (t: StmtTx, r: Range) => {
  const d = String(t.date).slice(0, 10);
  return d >= r.from && d <= r.to;
};

// ── income heads ────────────────────────────────────────────────────────────
export type IncomeHead = "salary" | "business" | "rent" | "interest" | "other";
export const INCOME_HEAD_LABEL: Record<IncomeHead, string> = {
  salary: "Salary", business: "Business / professional", rent: "Rent received", interest: "Interest & dividends", other: "Other income",
};

export function classifyIncome(t: Pick<StmtTx, "title" | "category" | "merchant">): IncomeHead {
  const s = `${t.category || ""} ${t.title || ""} ${t.merchant || ""}`.toLowerCase();
  if (/\b(salary|payroll|stipend|bonus|arrears|wages)\b/.test(s)) return "salary";
  if (/\b(rent received|rental|tenant|house rent income)\b/.test(s)) return "rent";
  if (/\b(interest|dividend|maturity|fd interest|coupon)\b/.test(s)) return "interest";
  if (/\b(business|sales|invoice|client|freelance|consult|professional|commission|payment received|revenue)\b/.test(s)) return "business";
  return "other";
}

// ── 1. Income & Expenditure ─────────────────────────────────────────────────
export type Group = { total: number; lines: Line[] };

export type IncomeExpenditure = {
  range: Range;
  income: Group;
  needs: Group;
  wants: Group;
  debtService: Group;
  savings: Group;
  /** Income − needs − wants − debt service: what was left after living and repaying. */
  surplus: number;
  /** Surplus ÷ income, % (null without income). */
  surplusRatePct: number | null;
  /** Surplus − savings & investments deployed: the cash actually retained. */
  cashRetained: number;
  entryCount: number;
};

function group(map: Map<string, number>, topN = 6): Group {
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN).reduce((s, [, v]) => s + v, 0);
  const lines: Line[] = top.map(([k, v]) => ({ key: k.toLowerCase(), label: k, amount: v }));
  if (rest > 0) lines.push({ key: "__more", label: "Other items", amount: rest });
  return { total: sorted.reduce((s, [, v]) => s + v, 0), lines };
}
const bump = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) || 0) + v);

export function incomeExpenditure(txs: StmtTx[], range: Range): IncomeExpenditure {
  const inc = new Map<string, number>();
  const buckets = { needs: new Map<string, number>(), wants: new Map<string, number>(), emis: new Map<string, number>(), savings: new Map<string, number>() };
  let entryCount = 0;
  for (const t of txs) {
    if (t.isTransfer || !inRange(t, range)) continue;
    const a = abs(t.amount);
    if (a === 0) continue;
    entryCount++;
    if (t.type === "income") {
      bump(inc, INCOME_HEAD_LABEL[classifyIncome(t)], a);
    } else if (t.type === "expense") {
      const b = classifyFlow(t as any);
      bump(buckets[b], (t.category || "Other").trim() || "Other", a);
    }
  }
  const income = group(inc, 5);
  const needs = group(buckets.needs), wants = group(buckets.wants), debtService = group(buckets.emis), savings = group(buckets.savings);
  const surplus = income.total - needs.total - wants.total - debtService.total;
  return {
    range, income, needs, wants, debtService, savings,
    surplus,
    surplusRatePct: income.total > 0 ? (surplus / income.total) * 100 : null,
    cashRetained: surplus - savings.total,
    entryCount,
  };
}

// ── 2. Cash flow ────────────────────────────────────────────────────────────
export type CashFlow = {
  /** Income less living costs (needs + wants). */
  operating: number;
  /** Loan and card repayments (outflow, shown negative). */
  financing: number;
  /** Savings and investments deployed (outflow, shown negative). */
  investing: number;
  /** Net change in cash over the period. */
  net: number;
};

export function cashFlow(ie: IncomeExpenditure): CashFlow {
  const operating = ie.income.total - ie.needs.total - ie.wants.total;
  const financing = -ie.debtService.total;
  const investing = -ie.savings.total;
  return { operating, financing, investing, net: operating + financing + investing };
}

// ── 3. Assets & Liabilities ─────────────────────────────────────────────────
export type SnapLine = { label: string; detail?: string; value: number };
export type BalanceGroup = { key: string; label: string; total: number; lines: SnapLine[] };
export type BalanceSheet = {
  assets: BalanceGroup[];
  liabilities: BalanceGroup[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  /** Liabilities ÷ assets, % (null with no assets). */
  debtToAssetPct: number | null;
};

const ASSET_GROUPS: Array<{ key: string; label: string; test: RegExp }> = [
  { key: "cash", label: "Cash & bank", test: /\b(cash|savings|bank|wallet)\b/i },
  { key: "fd", label: "Deposits", test: /\b(fixed deposit|fd|rd|recurring|deposit)\b/i },
  { key: "retirement", label: "Retirement funds", test: /\b(epf|ppf|nps|vpf|pension)\b/i },
  { key: "market", label: "Market investments", test: /\b(mutual|mf|stocks?|shares?|etf|crypto|investment|bond)\b/i },
  { key: "gold", label: "Gold", test: /\bgold|silver\b/i },
  { key: "property", label: "Property", test: /\b(property|real estate|land|flat|house)\b/i },
];
const LIAB_GROUPS: Array<{ key: string; label: string; test: RegExp }> = [
  { key: "home", label: "Home loans", test: /\b(home|housing|property)\b/i },
  { key: "bnpl", label: "Pay-later (BNPL)", test: /\b(bnpl|pay[- ]?later)\b/i },
  { key: "cards", label: "Credit cards", test: /\b(credit card|card)\b/i },
  { key: "personal", label: "Personal & other loans", test: /\b(personal|education|car|vehicle|loan|borrowed)\b/i },
];

function bucketize(lines: SnapLine[], groups: typeof ASSET_GROUPS): BalanceGroup[] {
  const out = new Map<string, BalanceGroup>();
  for (const l of lines) {
    if (!(l.value > 0)) continue;
    const text = `${l.detail || ""} ${l.label}`;
    const g = groups.find((x) => x.test.test(l.detail || "")) ?? groups.find((x) => x.test.test(text)) ?? { key: "other", label: "Other", test: /./ };
    const cur = out.get(g.key) ?? { key: g.key, label: g.label, total: 0, lines: [] };
    cur.total += l.value;
    cur.lines.push(l);
    out.set(g.key, cur);
  }
  const order = [...groups.map((g) => g.key), "other"];
  return [...out.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

export function balanceSheet(assetLines: SnapLine[], liabLines: SnapLine[]): BalanceSheet {
  const assets = bucketize(assetLines, ASSET_GROUPS);
  const liabilities = bucketize(liabLines, LIAB_GROUPS);
  const totalAssets = assets.reduce((s, g) => s + g.total, 0);
  const totalLiabilities = liabilities.reduce((s, g) => s + g.total, 0);
  return {
    assets, liabilities, totalAssets, totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    debtToAssetPct: totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : null,
  };
}

// ── monthly series for the year ─────────────────────────────────────────────
export function monthlySeries(txs: StmtTx[], monthKeys: string[]) {
  return monthKeys.map((key) => {
    let income = 0, expense = 0;
    for (const t of txs) {
      if (t.isTransfer || String(t.date).slice(0, 7) !== key) continue;
      if (t.type === "income") income += abs(t.amount);
      else if (t.type === "expense") expense += abs(t.amount);
    }
    return { key, income, expense, net: income - expense };
  });
}
