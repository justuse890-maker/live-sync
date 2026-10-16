/**
 * monthClose.ts — the month-end ritual: a short checklist, then "close the month".
 *
 * Closing does not lock anything. It saves the month's headline figures so that later edits can be
 * flagged ("2 entries changed since you closed September"), the way a CA notices a restated month.
 */
export type CheckItem = {
  id: "uncategorised" | "transfers" | "loans" | "income" | "budgets";
  label: string;
  /** How many things need attention; 0 = all good. */
  count: number;
  detail: string;
  screen: string;
};

type Tx = { id: string; type: string; amount: number; date: string; category?: string; loanId?: string; isTransfer?: boolean };
type Loan = { id: string; lenderName: string; closed?: boolean; autoDebit?: boolean; nextEmiDueDate?: string; disbursementDate?: string };

export type ChecklistInput = {
  month: string; // YYYY-MM
  /** Full ledger including transfer rows. */
  transactions: Tx[];
  /** Pairs the matcher thinks are own-account transfers, as [outId, inId]. */
  transferSuggestions: Array<{ outId: string; inId: string }>;
  loans: Loan[];
  /** Budgets over their limit this month (count). */
  overBudgetCount: number;
};

const inMonth = (t: Tx, m: string) => String(t.date).slice(0, 7) === m;
const isUncategorised = (t: Tx) => !t.category || ["other", "uncategorised", "uncategorized", "misc", "miscellaneous"].includes(t.category.trim().toLowerCase());

export function buildChecklist(i: ChecklistInput): CheckItem[] {
  const month = i.transactions.filter((t) => inMonth(t, i.month));
  const real = month.filter((t) => !t.isTransfer);
  const monthIds = new Set(month.map((t) => t.id));

  const uncategorised = real.filter((t) => t.type === "expense" && isUncategorised(t)).length;
  const transfers = i.transferSuggestions.filter((s) => monthIds.has(s.outId) || monthIds.has(s.inId)).length;
  const hasIncome = real.some((t) => t.type === "income");

  // An open loan that had already started by month-end but has no instalment recorded in the month.
  const monthEnd = `${i.month}-31`;
  const loansMissing = i.loans.filter((l) => {
    if (l.closed) return false;
    const started = !l.disbursementDate || l.disbursementDate.slice(0, 10) <= monthEnd;
    return started && !month.some((t) => t.loanId === l.id);
  });

  return [
    { id: "income", label: "Income recorded", count: hasIncome ? 0 : 1, detail: hasIncome ? "Income is in for this month." : "No income recorded yet — add your salary or other income.", screen: "transactions" },
    { id: "uncategorised", label: "Entries sorted into categories", count: uncategorised, detail: uncategorised ? `${uncategorised} expense${uncategorised > 1 ? "s are" : " is"} still “Other”.` : "Every expense has a category.", screen: "transactions" },
    { id: "transfers", label: "Own-account transfers confirmed", count: transfers, detail: transfers ? `${transfers} possible transfer${transfers > 1 ? "s" : ""} between your own accounts to confirm.` : "No transfers waiting.", screen: "transactions" },
    { id: "loans", label: "EMIs recorded", count: loansMissing.length, detail: loansMissing.length ? `No instalment recorded for ${loansMissing.map((l) => l.lenderName).slice(0, 2).join(", ")}${loansMissing.length > 2 ? ` +${loansMissing.length - 2}` : ""}.` : "Every open loan has its instalment.", screen: "loans" },
    { id: "budgets", label: "Budgets reviewed", count: i.overBudgetCount, detail: i.overBudgetCount ? `${i.overBudgetCount} budget${i.overBudgetCount > 1 ? "s are" : " is"} over the limit.` : "No budget is over its limit.", screen: "budgets" },
  ];
}

export const openItems = (items: CheckItem[]) => items.filter((x) => x.count > 0);

// ── close record + drift ────────────────────────────────────────────────────
export type CloseRecord = { month: string; closedAt: string; income: number; expense: number; entries: number };

export function makeCloseRecord(month: string, figures: { income: number; expense: number; entries: number }, now = new Date()): CloseRecord {
  return { month, closedAt: now.toISOString(), income: Math.round(figures.income), expense: Math.round(figures.expense), entries: figures.entries };
}

/** What changed in a closed month since it was closed. Null when nothing did. */
export function driftSince(rec: CloseRecord, now: { income: number; expense: number; entries: number }) {
  const income = Math.round(now.income) - rec.income;
  const expense = Math.round(now.expense) - rec.expense;
  const entries = now.entries - rec.entries;
  return income === 0 && expense === 0 && entries === 0 ? null : { income, expense, entries };
}

/** Consecutive closed months ending at the latest closed one — the "books closed" streak, kept calm (no guilt). */
export function closedStreak(closed: string[], currentMonth: string): number {
  const set = new Set(closed);
  const prev = (m: string) => { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  let m = prev(currentMonth);
  let n = 0;
  while (set.has(m)) { n++; m = prev(m); }
  return n;
}
