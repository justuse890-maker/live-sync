/**
 * chit.ts — chit fund / committee (kitty) bookkeeping.
 *
 * A chit of N members runs N months. Every month each member pays an instalment; one member wins
 * the pot (by auction or draw) and the discount the winner gives up is shared back to the others as a
 * "dividend", so non-winners usually pay a little less than the nominal instalment.
 *
 * We only record what the user actually paid and received. Until the user wins, money paid in (net of
 * dividends) is SAVINGS; after winning, the remaining instalments are what is still owed.
 * Not a statement from the chit company — the user's own record.
 */
export type ChitEntry = {
  /** 1-based month number of the chit. */
  month: number;
  /** Rupees actually paid that month (after any dividend was adjusted). */
  paid: number;
  /** Dividend credited/adjusted that month. Informational — already reflected in `paid`. */
  dividend?: number;
  date: string; // YYYY-MM-DD
};

export type Chit = {
  id: string;
  name: string;
  organiser?: string;
  /** Nominal monthly instalment. */
  instalment: number;
  /** Total months (= members). */
  tenure: number;
  /** Day of month the instalment falls due (1–28). */
  dueDay: number;
  startDate: string; // YYYY-MM-DD, month 1
  entries: ChitEntry[];
  /** Set when the user wins the pot. */
  won?: { month: number; amount: number; date: string };
  closed?: boolean;
};

export type ChitSummary = {
  monthsPaid: number;
  monthsLeft: number;
  totalCommitted: number;
  paidTotal: number;
  dividendTotal: number;
  /** Money put in, net of dividends. */
  netPaid: number;
  /** Nominal instalments still to pay. */
  nominalLeft: number;
  status: "saving" | "won" | "done";
  /** After winning: prize received minus what has been paid in so far (what you are effectively holding). */
  prizeHeld: number | null;
  /** Next month number to pay, or null when complete. */
  nextMonth: number | null;
};

export function summarizeChit(c: Chit): ChitSummary {
  const months = new Set(c.entries.map((e) => e.month));
  const monthsPaid = months.size;
  const monthsLeft = Math.max(0, c.tenure - monthsPaid);
  const paidTotal = c.entries.reduce((s, e) => s + Math.max(0, e.paid), 0);
  const dividendTotal = c.entries.reduce((s, e) => s + Math.max(0, e.dividend || 0), 0);
  let nextMonth: number | null = null;
  for (let m = 1; m <= c.tenure; m++) if (!months.has(m)) { nextMonth = m; break; }
  const done = nextMonth === null;
  return {
    monthsPaid,
    monthsLeft,
    totalCommitted: c.instalment * c.tenure,
    paidTotal,
    dividendTotal,
    netPaid: paidTotal,
    nominalLeft: c.instalment * monthsLeft,
    status: done ? "done" : c.won ? "won" : "saving",
    prizeHeld: c.won ? c.won.amount - paidTotal : null,
    nextMonth,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Due date (YYYY-MM-DD) of chit month `month`: the start month plus (month−1), on `dueDay`. */
export function chitDueDate(c: Pick<Chit, "startDate" | "dueDay">, month: number): string {
  const [y, m] = c.startDate.split("-").map(Number);
  const d = new Date(y, m - 1 + (month - 1), 1);
  const day = Math.min(Math.max(1, c.dueDay), 28);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(day)}`;
}

/** Next unpaid instalment with its due date, or null when finished. */
export function nextChitDue(c: Chit): { month: number; dueDate: string; amount: number } | null {
  const s = summarizeChit(c);
  if (s.nextMonth === null || c.closed) return null;
  return { month: s.nextMonth, dueDate: chitDueDate(c, s.nextMonth), amount: c.instalment };
}

/** Validation for logging an instalment; returns an error message or null. */
export function validateEntry(c: Chit, e: ChitEntry): string | null {
  if (!Number.isInteger(e.month) || e.month < 1 || e.month > c.tenure) return `Month must be between 1 and ${c.tenure}.`;
  if (c.entries.some((x) => x.month === e.month)) return `Month ${e.month} is already recorded.`;
  if (!(e.paid > 0)) return "Enter the amount you paid.";
  if (e.paid > c.instalment * 1.5) return "That is far above the instalment — check the amount.";
  if ((e.dividend || 0) < 0) return "Dividend can't be negative.";
  return null;
}
