/**
 * budgetRollover.ts — unspent budget carries into the next month.
 *
 * For a budget with rollover switched on, money you did not spend last month stays available
 * this month. Walking forward month by month:
 *
 *     carry(next) = max(0, limit + carry − spent)
 *
 * Overspending never creates a negative carry (it just uses the month's own limit up) and a month
 * with no budget set resets the carry to zero. Only the last `MAX_LOOKBACK` months are considered,
 * so an old surplus can't pile up forever.
 */
export const MAX_LOOKBACK = 6;

export type MonthFigures = {
  /** Budget limit in force that month, or null when there was no budget. */
  limit: number | null;
  spent: number;
};

/** `history` is oldest → newest, ending with the month BEFORE the one being viewed. */
export function rolloverCarry(history: MonthFigures[]): number {
  let carry = 0;
  for (const m of history.slice(-MAX_LOOKBACK)) {
    if (m.limit === null || !(m.limit > 0)) { carry = 0; continue; }
    carry = Math.max(0, m.limit + carry - Math.max(0, m.spent));
  }
  return carry;
}

export type BudgetView = { effectiveLimit: number; carry: number; remaining: number; pct: number };

export function budgetView(limit: number, spent: number, carry: number): BudgetView {
  const effectiveLimit = Math.max(0, limit) + Math.max(0, carry);
  const remaining = effectiveLimit - spent;
  return { effectiveLimit, carry: Math.max(0, carry), remaining, pct: effectiveLimit > 0 ? (spent / effectiveLimit) * 100 : 0 };
}
