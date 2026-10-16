/**
 * outlook.ts — "by month end", split into what is promised and what is only a guess.
 *
 *   committed   bills / EMIs still to pay this month (exact amounts the user entered)
 *   everyday    food, travel, shopping… for the rest of the month — an ESTIMATE
 *
 * The estimate is never one number. It is a range between two things we actually know: the daily pace so far this
 * month (once at least 5 days are in) and the average daily spend of the last three months that had any. If neither
 * exists we say so instead of guessing. Salary that has not arrived is never added.
 *
 * `isCommitted` decides which past expenses were commitments (EMIs, rent…) so they are not repeated in the everyday
 * pace. The default is a plain-words heuristic on loan links and category names.
 */
type Row = { type: string; amount: number; date: string; category?: string; loanId?: string; isTransfer?: boolean };

const COMMITTED_CATEGORY = /\b(emi|loan|rent|insurance|premium|subscription|sip|credit card bill|card bill|tax)\b/i;
export const defaultIsCommitted = (t: Row) => !!t.loanId || COMMITTED_CATEGORY.test(t.category || "");

const MIN_DAYS_FOR_PACE = 5;
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const daysIn = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

export type Outlook = {
  daysLeft: number;
  spentSoFar: number;
  everydaySoFar: number;
  committedLeft: number;
  dailyLow: number;
  dailyHigh: number;
  everydayLow: number;
  everydayHigh: number;
  /** Money in so far − spent − committed − everyday estimate, as a (low, high) pair. */
  freeLow: number;
  freeHigh: number;
  basis: "both" | "this_month" | "history" | "none";
  notes: string[];
};

export function monthEndOutlook({ txs, incomeSoFar, committedLeft, now = new Date(), isCommitted = defaultIsCommitted }: {
  txs: Row[];
  incomeSoFar: number;
  committedLeft: number;
  now?: Date;
  isCommitted?: (t: Row) => boolean;
}): Outlook {
  const expenses = txs.filter((t) => t.type === "expense" && !t.isTransfer);
  const key = monthKey(now);
  const day = now.getDate();
  const dim = daysIn(now.getFullYear(), now.getMonth());
  const daysLeft = Math.max(0, dim - day);

  const inMonth = (t: Row, k: string) => String(t.date).slice(0, 7) === k;
  const thisMonth = expenses.filter((t) => inMonth(t, key) && Number(String(t.date).slice(8, 10)) <= day);
  const spentSoFar = thisMonth.reduce((s, t) => s + Math.abs(t.amount), 0);
  const everydaySoFar = thisMonth.filter((t) => !isCommitted(t)).reduce((s, t) => s + Math.abs(t.amount), 0);

  const pace = day >= MIN_DAYS_FOR_PACE && everydaySoFar > 0 ? everydaySoFar / day : null;

  const history: number[] = [];
  for (let m = 1; m <= 3; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const k = monthKey(d);
    const sum = expenses.filter((t) => inMonth(t, k) && !isCommitted(t)).reduce((s, t) => s + Math.abs(t.amount), 0);
    if (sum > 0) history.push(sum / daysIn(d.getFullYear(), d.getMonth()));
  }
  const histAvg = history.length ? history.reduce((a, b) => a + b, 0) / history.length : null;

  const candidates = [pace, histAvg].filter((x): x is number => x !== null);
  const basis: Outlook["basis"] = pace !== null && histAvg !== null ? "both" : pace !== null ? "this_month" : histAvg !== null ? "history" : "none";
  const dailyLow = candidates.length ? Math.min(...candidates) : 0;
  const dailyHigh = candidates.length ? Math.max(...candidates) : 0;
  const everydayLow = dailyLow * daysLeft;
  const everydayHigh = dailyHigh * daysLeft;

  const base = incomeSoFar - spentSoFar - committedLeft;
  const notes: string[] = [];
  if (basis === "none") notes.push("Not enough spending history yet to estimate everyday spending. Only your committed bills are subtracted.");
  if (basis === "this_month") notes.push("Based on your pace this month only. It gets sturdier after a month or two of history.");
  if (basis === "history") notes.push("Based on your average of recent months, since this month is only just starting.");
  if (basis === "both") notes.push("The range runs from this month's daily pace to your recent-months average.");
  notes.push("Salary or income that has not arrived is not included.");

  return { daysLeft, spentSoFar, everydaySoFar, committedLeft, dailyLow, dailyHigh, everydayLow, everydayHigh, freeLow: base - everydayHigh, freeHigh: base - everydayLow, basis, notes };
}

import { formatInr } from "./money";

/** Plain-words version of the projected-free range. Never a single confident figure unless low and high agree. */
export function describeFreeRange(low: number, high: number): string {
  const lo = Math.round(low), hi = Math.round(high);
  if (lo === hi) return lo >= 0 ? `about ${formatInr(lo)} left` : `short by about ${formatInr(-lo)}`;
  if (lo >= 0) return `${formatInr(lo)} – ${formatInr(hi)} left`;
  if (hi <= 0) return `short by ${formatInr(-hi)} – ${formatInr(-lo)}`;
  return `anywhere from ${formatInr(-lo)} short to ${formatInr(hi)} left`;
}
