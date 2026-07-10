// Financial Intelligence Engine — pure, deterministic compute used by every
// wealth module. Keeping it framework-free makes it trivial to test and to
// swap with a server-side implementation later.

import { Tx } from "../store";

export type Asset = {
  id: string;
  name: string;
  kind: "cash" | "savings" | "fd" | "mf" | "stocks" | "epf" | "ppf" | "nps" | "gold" | "property" | "crypto" | "other";
  value: number;
  expectedReturn?: number; // annual %, used for projections
  updatedAt?: string;
};

export type Liability = {
  id: string;
  name: string;
  kind: "home" | "personal" | "car" | "education" | "credit_card" | "other";
  outstanding: number;
  interestRate: number; // annual %
  emi?: number;
  updatedAt?: string;
};

export type LifeEvent = {
  id: string;
  kind: "marriage" | "child" | "house" | "car" | "education" | "travel" | "retirement" | "other";
  title: string;
  targetDate: string; // YYYY-MM-DD
  estimatedCost: number;
  saved?: number;
};

export const ASSET_LABELS: Record<Asset["kind"], string> = {
  cash: "Cash", savings: "Savings", fd: "Fixed Deposit", mf: "Mutual Fund", stocks: "Stocks",
  epf: "EPF", ppf: "PPF", nps: "NPS", gold: "Gold", property: "Property", crypto: "Crypto", other: "Other",
};

export const LIABILITY_LABELS: Record<Liability["kind"], string> = {
  home: "Home Loan", personal: "Personal Loan", car: "Car Loan",
  education: "Education Loan", credit_card: "Credit Card", other: "Other",
};

export const DEFAULT_RETURN: Record<Asset["kind"], number> = {
  cash: 0, savings: 3.5, fd: 7.0, mf: 12.0, stocks: 13.0, epf: 8.25,
  ppf: 7.1, nps: 10.0, gold: 8.0, property: 6.0, crypto: 0, other: 6.0,
};

export function netWorth(assets: Asset[], liabilities: Liability[]) {
  const totalAssets = assets.reduce((s, a) => s + a.value, 0);
  const totalLiab = liabilities.reduce((s, l) => s + l.outstanding, 0);
  return { totalAssets, totalLiab, netWorth: totalAssets - totalLiab };
}

export function monthlyFlow(transactions: Tx[], monthsBack = 0) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  const inMonth = transactions.filter((t) => t.date.startsWith(key));
  const income = inMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = -inMonth.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, expense, savings: income - expense, monthKey: key };
}

// ─── Wealth Leakage ────────────────────────────────────────────────────────
// Detection runs five independent rules over your real transactions, subs,
// assets and liabilities. Each rule emits at most one Leak with an estimated
// annual ₹ cost and an actionable tip. Rules are tuned to avoid noise — a
// rule only fires when the signal clearly exceeds a sensible threshold.
export type Leak = {
  id: string;
  title: string;
  category: "Subscriptions" | "Dining" | "Banking" | "Travel" | "Idle Cash" | "Debt";
  annual: number;
  tip: string;
  severity: "low" | "medium" | "high";
};

const SUB_BILLING_MULTIPLIER: Record<string, number> = {
  weekly: 52, monthly: 12, quarterly: 4, yearly: 1, annual: 1,
};

export function detectLeaks(
  transactions: Tx[],
  subscriptions: any[],
  assets: Asset[] = [],
  liabilities: Liability[] = [],
): { leaks: Leak[]; totalAnnual: number } {
  const leaks: Leak[] = [];

  // 1. Subscriptions: only flag explicitly-marked stale / unused / duplicate.
  //    Respect billing cycle (yearly subs aren't ×12).
  const stale = subscriptions.filter((s: any) => {
    if (s.status === "unused" || s.status === "duplicate") return true;
    if (s.unused === true) return true;
    if (typeof s.lastUsedDays === "number" && s.lastUsedDays > 30) return true;
    return false;
  });
  for (const s of stale) {
    const cost = s.amount ?? s.cost ?? 0;
    if (cost <= 0) continue;
    const cycle = (s.billing ?? s.cycle ?? "monthly").toString().toLowerCase();
    const annual = cost * (SUB_BILLING_MULTIPLIER[cycle] ?? 12);
    const reason = s.status === "duplicate" ? "Duplicate service" : "No activity in 30+ days";
    leaks.push({
      id: `sub-${s.id}`,
      title: s.name,
      category: "Subscriptions",
      annual,
      tip: `${reason}. Cancel or downgrade to recover ₹${Math.round(annual).toLocaleString("en-IN")}/yr.`,
      severity: annual > 6000 ? "high" : annual > 1500 ? "medium" : "low",
    });
  }

  // 2. Food delivery / dining overspend — compare to a generous ₹6k/mo cap.
  const foodRx = /swiggy|zomato|dunzo|eatsure|faasos|box8|behrouz/i;
  const food = transactions.filter((t) =>
    t.type === "expense" && (foodRx.test(t.merchant || t.title || "") || t.category === "Food"),
  );
  const foodMonthly = food.reduce((s, t) => s + Math.abs(t.amount), 0);
  if (foodMonthly > 6000) {
    const excess = foodMonthly - 4500;
    leaks.push({
      id: "food-excess",
      title: "Food delivery overspend",
      category: "Dining",
      annual: excess * 12,
      tip: `Cap delivery at ₹4,500/mo — you spent ₹${Math.round(foodMonthly).toLocaleString("en-IN")} this period.`,
      severity: excess > 4000 ? "high" : "medium",
    });
  }

  // 3. Bank / ATM / GST charges
  const chargeRx = /\b(charge|fee|atm|gst|sms\s*charge|amc|annual\s*fee)\b/i;
  const charges = transactions.filter((t) => t.type === "expense" && chargeRx.test(t.title || ""));
  const chargesTotal = charges.reduce((s, t) => s + Math.abs(t.amount), 0);
  if (chargesTotal > 200) {
    leaks.push({
      id: "bank-fees",
      title: "Bank & ATM charges",
      category: "Banking",
      annual: chargesTotal * 12,
      tip: "Switch to a zero-balance digital savings account or fee-waiver credit card.",
      severity: chargesTotal > 1000 ? "medium" : "low",
    });
  }

  // 4. Cab usage above ₹4k/mo
  const rideRx = /uber|ola|rapido|meru|namma\s*yatri/i;
  const ride = transactions.filter((t) => t.type === "expense" && rideRx.test(t.merchant || t.title || ""));
  const rideTotal = ride.reduce((s, t) => s + Math.abs(t.amount), 0);
  if (rideTotal > 4000) {
    const excess = rideTotal - 2500;
    leaks.push({
      id: "rides-excess",
      title: "Frequent cab usage",
      category: "Travel",
      annual: excess * 12,
      tip: "Pool, batch errands, or use metro for 2–3 trips/week.",
      severity: excess > 5000 ? "high" : "medium",
    });
  }

  // 5. Idle cash: large savings/cash balance earning < 4% while inflation ~6%.
  const monthlyExp = monthlyFlow(transactions, 0).expense || monthlyFlow(transactions, 1).expense || 0;
  const idleAssets = assets.filter((a) => (a.kind === "cash" || a.kind === "savings") && (a.expectedReturn ?? DEFAULT_RETURN[a.kind]) < 4);
  const idleValue = idleAssets.reduce((s, a) => s + a.value, 0);
  // Anything above 6 months of expenses sitting in low-yield is "idle".
  const idleBuffer = monthlyExp * 6;
  const idleExcess = idleValue - idleBuffer;
  if (idleExcess > 50000) {
    // Opportunity cost vs liquid fund at 7%: roughly 4% delta annually.
    const annual = Math.round(idleExcess * 0.04);
    leaks.push({
      id: "idle-cash",
      title: "Idle cash earning nothing",
      category: "Idle Cash",
      annual,
      tip: `₹${Math.round(idleExcess).toLocaleString("en-IN")} above your 6-month buffer is sitting in low-yield. Move to a liquid fund (~7%) to earn ~₹${annual.toLocaleString("en-IN")}/yr.`,
      severity: idleExcess > 500000 ? "high" : "medium",
    });
  }

  // 6. High-interest debt: credit card / personal loan > 14%.
  const highCost = liabilities.filter((l) => !l.outstanding ? false : l.interestRate > 14);
  const highCostInterest = highCost.reduce((s, l) => s + (l.outstanding * l.interestRate / 100), 0);
  if (highCostInterest > 5000) {
    const worst = [...highCost].sort((a, b) => b.interestRate - a.interestRate)[0];
    leaks.push({
      id: "high-interest-debt",
      title: "High-interest debt",
      category: "Debt",
      annual: Math.round(highCostInterest),
      tip: `${worst.name} at ${worst.interestRate}% is bleeding ₹${Math.round(highCostInterest).toLocaleString("en-IN")}/yr in interest. Prepay or refinance to a lower-rate loan.`,
      severity: "high",
    });
  }

  const totalAnnual = leaks.reduce((s, l) => s + l.annual, 0);
  return { leaks: leaks.sort((a, b) => b.annual - a.annual), totalAnnual };
}

// ─── Lifestyle Inflation ──────────────────────────────────────────────────
export function lifestyleInflation(transactions: Tx[]) {
  // Compare last 3 months vs prior 3 months (rolling)
  const recent = [0, 1, 2].map((m) => monthlyFlow(transactions, m));
  const older = [3, 4, 5].map((m) => monthlyFlow(transactions, m));
  const avg = (arr: { income: number; expense: number }[], k: "income" | "expense") =>
    arr.reduce((s, x) => s + x[k], 0) / arr.length || 0;

  const recIncome = avg(recent, "income");
  const oldIncome = avg(older, "income");
  const recExp = avg(recent, "expense");
  const oldExp = avg(older, "expense");

  const incomeGrowth = oldIncome ? ((recIncome - oldIncome) / oldIncome) * 100 : 0;
  const expenseGrowth = oldExp ? ((recExp - oldExp) / oldExp) * 100 : 0;
  const gap = expenseGrowth - incomeGrowth;
  const verdict = gap > 5 ? "outpacing" : gap < -5 ? "disciplined" : "balanced";
  return { recIncome, oldIncome, recExp, oldExp, incomeGrowth, expenseGrowth, gap, verdict };
}

// ─── FIRE (Financial Independence, Retire Early) ───────────────────────────
export function fire(monthlyExpense: number, currentInvested: number, currentAge: number, targetReturn = 11, swr = 4) {
  const annualExp = monthlyExpense * 12;
  const fireNumber = annualExp * (100 / swr);    // 25x at 4% SWR
  const leanFire = annualExp * 0.7 * 25;
  const fatFire = annualExp * 1.5 * 25;
  const coast = fireNumber / Math.pow(1 + targetReturn / 100, Math.max(0, 60 - currentAge));

  // Years to FIRE assuming current invested compounds at targetReturn, no further contributions
  const r = targetReturn / 100;
  const yrs = currentInvested > 0 && currentInvested < fireNumber
    ? Math.log(fireNumber / currentInvested) / Math.log(1 + r)
    : currentInvested >= fireNumber ? 0 : Infinity;

  const progress = Math.min(100, (currentInvested / fireNumber) * 100);
  const projectedAge = isFinite(yrs) ? Math.round(currentAge + yrs) : null;
  return { annualExp, fireNumber, leanFire, fatFire, coast, progress, projectedAge };
}

// ─── Opportunity Cost ──────────────────────────────────────────────────────
export function opportunityCost(amount: number, years = 10, rate = 12) {
  return amount * Math.pow(1 + rate / 100, years);
}

// ─── Decision Simulator ───────────────────────────────────────────────────
export type SimulatorInput =
  | { kind: "buy"; price: number; downPct: number; loanYears: number; loanRate: number; monthlyExpense: number; monthlyIncome: number; emergencyFund: number }
  | { kind: "quit"; monthlyExpense: number; liquidAssets: number; sideIncome: number }
  | { kind: "prepay"; outstanding: number; rate: number; remainingYears: number; lumpsum: number; alternateReturn: number };

export function simulate(input: SimulatorInput) {
  if (input.kind === "buy") {
    const principal = input.price * (1 - input.downPct / 100);
    const r = input.loanRate / 12 / 100;
    const n = input.loanYears * 12;
    const emi = principal > 0 ? (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : 0;
    const totalInterest = emi * n - principal;
    const newSavingsRate = ((input.monthlyIncome - input.monthlyExpense - emi) / input.monthlyIncome) * 100;
    const runwayHit = (input.price * input.downPct / 100) / input.monthlyExpense;
    const safe = newSavingsRate > 15 && input.emergencyFund > input.monthlyExpense * 3;
    return { emi, totalInterest, newSavingsRate, runwayHit, safe,
      verdict: safe ? "Likely safe" : "Risky — savings rate or emergency fund drops too low" };
  }
  if (input.kind === "quit") {
    const monthsRunway = (input.liquidAssets) / Math.max(1, input.monthlyExpense - input.sideIncome);
    const risk = monthsRunway < 6 ? "high" : monthsRunway < 12 ? "medium" : "low";
    return { monthsRunway, risk,
      verdict: risk === "low" ? "12+ months runway — comfortable" :
               risk === "medium" ? "Tight — line up income within 6 months" :
               "High risk — build runway first" };
  }
  // prepay
  const interestSaved = (input.outstanding * input.rate / 100) * input.remainingYears * (input.lumpsum / input.outstanding);
  const altGrowth = input.lumpsum * Math.pow(1 + input.alternateReturn / 100, input.remainingYears) - input.lumpsum;
  const better = interestSaved > altGrowth ? "prepay" : "invest";
  return { interestSaved, altGrowth, better,
    verdict: better === "prepay"
      ? `Prepay — saves ₹${Math.round(interestSaved).toLocaleString("en-IN")} in interest`
      : `Invest instead — earns ₹${Math.round(altGrowth).toLocaleString("en-IN")} extra over ${input.remainingYears} yrs` };
}

// ─── Unified Timeline ──────────────────────────────────────────────────────
export type TimelineEvent = {
  id: string; date: string; kind: "income" | "expense" | "subscription" | "goal" | "loan" | "tax" | "sip" | "bill";
  title: string; amount?: number; meta?: string;
};

export function buildTimeline({ transactions, subscriptions, goals, loans, bills }: {
  transactions: Tx[]; subscriptions: any[]; goals: any[]; loans: any[]; bills: any[];
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const t of transactions.slice(0, 60)) {
    events.push({ id: `tx-${t.id}`, date: t.date, kind: t.type === "income" ? "income" : "expense",
      title: t.merchant || t.title, amount: t.amount, meta: t.category });
  }
  for (const s of subscriptions) {
    if (s.nextRenewal) events.push({ id: `sub-${s.id}`, date: s.nextRenewal, kind: "subscription",
      title: `${s.name} renews`, amount: s.amount || s.cost, meta: "Subscription" });
  }
  for (const g of goals) {
    if (g.deadline) events.push({ id: `goal-${g.id}`, date: g.deadline, kind: "goal",
      title: `${g.name} target`, amount: g.target, meta: "Goal milestone" });
  }
  for (const l of loans) {
    if (!l.settled && l.repayBy) events.push({ id: `loan-${l.id}`, date: l.repayBy, kind: "loan",
      title: `${l.direction === "borrowed" ? "Owe" : "Collect"} ${l.person}`, amount: l.amount, meta: "Loan repayment" });
  }
  for (const b of bills || []) {
    if (b.due) events.push({ id: `bill-${b.id}`, date: b.due, kind: "bill",
      title: b.name, amount: b.amount, meta: "Bill" });
  }

  // India tax calendar
  for (const tx of [
    { date: "2026-06-15", title: "Advance tax — Q1" },
    { date: "2026-07-31", title: "ITR filing deadline" },
    { date: "2026-09-15", title: "Advance tax — Q2" },
    { date: "2026-12-15", title: "Advance tax — Q3" },
    { date: "2027-03-15", title: "Advance tax — Q4" },
  ]) events.push({ id: `tax-${tx.date}`, date: tx.date, kind: "tax", title: tx.title, meta: "Tax calendar" });

  return events.sort((a, b) => (a.date < b.date ? 1 : -1));
}
