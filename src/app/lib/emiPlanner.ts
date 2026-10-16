/**
 * emiPlanner.ts — the numbers behind the EMI Command Centre.
 *
 *  • prepaymentImpact: what a lump-sum part-payment really saves, under both bank options
 *    (keep the EMI and finish sooner, or keep the tenure and lower the EMI).
 *  • emiBurden: total EMIs as a share of monthly income, against a configurable guideline.
 *  • emiOutflowTimeline: what leaves the account for EMIs, month by month.
 *
 * Everything is a plain amortisation estimate from the figures the user entered. It is a planning
 * aid, not the lender's statement — banks round, charge fees and may reset rates.
 */

/** Unrounded EMI, so a simulated schedule ends exactly on the target month. */
function exactEmi(principal: number, ratePA: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = ratePA / 12 / 100;
  if (r === 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

const MAX_MONTHS = 600; // 50 years — a hard stop for runaway loops

export type Schedule = { months: number; interest: number; finalPayment: number };

/** Simulates month-by-month repayment at a fixed EMI. Returns null if the EMI never clears the loan. */
export function simulateRepayment(balance: number, ratePA: number, emi: number): Schedule | null {
  if (balance <= 0) return { months: 0, interest: 0, finalPayment: 0 };
  const r = ratePA / 12 / 100;
  let bal = balance, interest = 0, months = 0, last = 0;
  while (bal > 0.005 && months < MAX_MONTHS) {
    const i = bal * r;
    if (emi <= i + 0.0001 && r > 0) return null; // EMI doesn't even cover interest
    const pay = Math.min(emi, bal + i);
    interest += i;
    bal = bal + i - pay;
    last = pay;
    months++;
  }
  return bal > 0.005 ? null : { months, interest, finalPayment: last };
}

export type PrepaymentImpact = {
  baseline: { months: number; interest: number; emi: number };
  /** Keep paying the same EMI: loan ends earlier. */
  reduceTenure: { months: number; interest: number; monthsSaved: number; interestSaved: number; emi: number } | null;
  /** Keep the same end date: EMI falls. */
  reduceEmi: { months: number; interest: number; interestSaved: number; emi: number } | null;
};

/**
 * @param balance  outstanding principal today
 * @param ratePA   annual interest rate, %
 * @param emi      current EMI
 * @param extra    lump sum the user is considering paying now
 */
export function prepaymentImpact(input: { balance: number; ratePA: number; emi: number; extra: number }): PrepaymentImpact | null {
  const balance = Math.max(0, input.balance);
  const extra = Math.min(Math.max(0, input.extra), balance);
  const base = simulateRepayment(balance, input.ratePA, input.emi);
  if (!base) return null;
  const baseline = { months: base.months, interest: base.interest, emi: input.emi };

  const newBal = balance - extra;
  const tenure = simulateRepayment(newBal, input.ratePA, input.emi);
  const reduceTenure = tenure
    ? { months: tenure.months, interest: tenure.interest, monthsSaved: base.months - tenure.months, interestSaved: Math.max(0, base.interest - tenure.interest), emi: input.emi }
    : null;

  let reduceEmi: PrepaymentImpact["reduceEmi"] = null;
  if (base.months > 0) {
    const newEmi = newBal > 0 ? exactEmi(newBal, input.ratePA, base.months) : 0;
    const sim = newBal > 0 ? simulateRepayment(newBal, input.ratePA, newEmi) : { months: 0, interest: 0, finalPayment: 0 };
    if (sim) reduceEmi = { months: sim.months, interest: sim.interest, interestSaved: Math.max(0, base.interest - sim.interest), emi: Math.round(newEmi) };
  }
  return { baseline, reduceTenure, reduceEmi };
}

// ── EMI burden ──────────────────────────────────────────────────────────────

/** Guideline bands. Lenders typically look at 40–50% of income; planners prefer lower. Editable by the user. */
export const DEFAULT_EMI_ALERT_PCT = 35;
export const EMI_CAUTION_PCT = 25;

export type EmiBurden = {
  ratioPct: number | null; // null → no income to compare against
  level: "none" | "healthy" | "watch" | "high" | "no_income";
  totalEmi: number;
  /** Extra monthly EMI the user could add before crossing the alert line (never negative). */
  headroom: number;
};

export function emiBurden(monthlyIncome: number, totalEmi: number, alertPct = DEFAULT_EMI_ALERT_PCT): EmiBurden {
  const emi = Math.max(0, totalEmi);
  if (emi === 0) return { ratioPct: monthlyIncome > 0 ? 0 : null, level: "none", totalEmi: 0, headroom: Math.max(0, Math.round((monthlyIncome * alertPct) / 100)) };
  if (!(monthlyIncome > 0)) return { ratioPct: null, level: "no_income", totalEmi: emi, headroom: 0 };
  const ratioPct = (emi / monthlyIncome) * 100;
  const caution = Math.min(EMI_CAUTION_PCT, alertPct);
  const level: EmiBurden["level"] = ratioPct > alertPct ? "high" : ratioPct > caution ? "watch" : "healthy";
  return { ratioPct, level, totalEmi: emi, headroom: Math.max(0, Math.round((monthlyIncome * alertPct) / 100 - emi)) };
}

// ── Outflow timeline ────────────────────────────────────────────────────────

type LoanLike = {
  id: string;
  lenderName: string;
  emiAmount: number;
  emisPaid: number;
  totalEmis: number;
  closed?: boolean;
  phase?: "pre_emi" | "emi";
  interestRatePA?: number;
  disbursedAmount?: number;
};

export type OutflowMonth = { monthKey: string; total: number; items: Array<{ loanId: string; name: string; amount: number }> };

/**
 * EMIs due in each of the next `months` months (starting with the month of `from`).
 * Assumes one instalment per month per open loan until its remaining EMIs run out.
 * Pre-EMI loans contribute interest-only until the full EMI starts (start date unknown here → assumed to stay).
 */
export function emiOutflowTimeline(loans: LoanLike[], months = 12, from = new Date()): OutflowMonth[] {
  const out: OutflowMonth[] = [];
  for (let m = 0; m < months; m++) {
    const d = new Date(from.getFullYear(), from.getMonth() + m, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const items: OutflowMonth["items"] = [];
    for (const l of loans) {
      if (l.closed) continue;
      const remaining = Math.max(0, (l.totalEmis || 0) - (l.emisPaid || 0));
      const preEmi = l.phase === "pre_emi";
      if (!preEmi && m >= remaining) continue;
      const amount = preEmi
        ? Math.round(((l.disbursedAmount ?? 0) * (l.interestRatePA ?? 0)) / 12 / 100)
        : l.emiAmount;
      if (amount > 0) items.push({ loanId: l.id, name: l.lenderName, amount });
    }
    out.push({ monthKey, total: items.reduce((s, i) => s + i.amount, 0), items });
  }
  return out;
}

// ── Income baseline ─────────────────────────────────────────────────────────

/**
 * A steady monthly income figure for ratios: the average of the last three months that actually
 * have income recorded (the current month counts only once it has income). Returns 0 when none.
 * `txs` must already exclude own-account transfers.
 */
export function typicalMonthlyIncome(txs: Array<{ type: string; amount: number; date: string }>, now = new Date()): number {
  const totals: number[] = [];
  for (let m = 0; m < 3; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const sum = txs.filter((t) => t.type === "income" && String(t.date).slice(0, 7) === key).reduce((s, t) => s + Math.abs(t.amount), 0);
    if (sum > 0) totals.push(sum);
  }
  return totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : 0;
}

// ── BNPL ────────────────────────────────────────────────────────────────────

/** Share of income going to pay-later instalments. Above 10% is a red flag worth surfacing. */
export const BNPL_ALERT_PCT = 10;

export function bnplBurden(monthlyIncome: number, loans: Array<{ loanType?: string; emiAmount: number; closed?: boolean }>) {
  const monthly = loans.filter((l) => l.loanType === "bnpl" && !l.closed).reduce((s, l) => s + Math.max(0, l.emiAmount), 0);
  const ratioPct = monthlyIncome > 0 ? (monthly / monthlyIncome) * 100 : null;
  return { monthly, ratioPct, flagged: ratioPct !== null && ratioPct > BNPL_ALERT_PCT, hasAny: monthly > 0 };
}
