/**
 * homeHero.ts — the income-first headline on Home.
 *
 *   Money in      what actually came in this month
 *   Spent         what has gone out so far (transfers excluded by the caller)
 *   Still to pay  bills / EMIs / premiums that are due for the rest of THIS month and not yet recorded
 *   Free          Money in − Spent − Still to pay   ("left after commitments")
 *
 * "Still to pay" only exists for the current month. For past months it is 0 and Free is simply the net.
 */
export type HeroInput = {
  income: number;
  expense: number;
  /** Amounts of obligations falling due in the rest of the current month (overdue ones included). */
  dueAmounts: number[];
  isCurrentMonth: boolean;
};

export type Hero = {
  moneyIn: number;
  spent: number;
  stillToPay: number;
  free: number;
  /** Shares of Money in for the bar; each 0–100, only meaningful when moneyIn > 0. */
  spentPct: number;
  duePct: number;
  freePct: number;
  /** True when spent + still to pay exceed what came in. */
  overcommitted: boolean;
};

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

export function buildHero({ income, expense, dueAmounts, isCurrentMonth }: HeroInput): Hero {
  const moneyIn = Math.max(0, income);
  const spent = Math.max(0, expense);
  const stillToPay = isCurrentMonth ? dueAmounts.reduce((s, a) => s + (a > 0 ? a : 0), 0) : 0;
  const free = moneyIn - spent - stillToPay;
  if (!(moneyIn > 0)) return { moneyIn, spent, stillToPay, free, spentPct: 0, duePct: 0, freePct: 0, overcommitted: spent + stillToPay > 0 };
  const spentPct = clampPct((spent / moneyIn) * 100);
  const duePct = clampPct(Math.min((stillToPay / moneyIn) * 100, 100 - spentPct));
  const freePct = clampPct(100 - spentPct - duePct);
  return { moneyIn, spent, stillToPay, free, spentPct, duePct, freePct, overcommitted: free < 0 };
}
