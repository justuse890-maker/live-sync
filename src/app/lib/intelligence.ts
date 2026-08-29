// Financial Intelligence Engine — pure, deterministic compute used by every
// wealth module. Keeping it framework-free makes it trivial to test and to
// swap with a server-side implementation later.

import type { Tx } from "../store";
import { getMonthKey } from "./dateUtils";

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
  const inMonth = transactions.filter((t) => getMonthKey(t.date) === key);
  const income = inMonth.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
  const expense = inMonth.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
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
  category: "Subscriptions" | "Dining" | "Banking" | "Travel" | "Idle Cash" | "Debt" | "Micro Leaks" | "Frequency" | "Recurring";
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

  // 7. Micro-spend accumulator: small purchases can be easy to miss in a
  // statement, so only surface a category once it has both volume and scale.
  const currentMonth = transactions.reduce((latest, t) => {
    const key = getMonthKey(t.date);
    return key > latest ? key : latest;
  }, "");
  const currentExpenses = transactions.filter((t) => t.type === "expense" && getMonthKey(t.date) === currentMonth);
  const microByCategory: Record<string, { total: number; count: number }> = {};
  for (const t of currentExpenses) {
    const amount = Math.abs(t.amount);
    if (amount >= 500) continue;
    const category = t.category || "Other";
    const bucket = microByCategory[category] ||= { total: 0, count: 0 };
    bucket.total += amount;
    bucket.count += 1;
  }
  for (const [category, data] of Object.entries(microByCategory)) {
    if (data.total < 3000 || data.count < 6) continue;
    leaks.push({
      id: `micro-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: `${data.count} small ${category.toLowerCase()} spends`,
      category: "Micro Leaks",
      annual: data.total * 12,
      tip: `${data.count} purchases below ₹500 added up to ₹${Math.round(data.total).toLocaleString("en-IN")} this month. Set a monthly cap before they compound.`,
      severity: data.total >= 6000 ? "high" : "medium",
    });
  }

  // 8. Frequency creep: compare a merchant's transaction count with the
  // previous calendar month. Require a meaningful baseline to avoid noise.
  if (currentMonth) {
    const previousMonth = shiftMonthKey(currentMonth, -1);
    const merchantCount = (month: string) => {
      const counts: Record<string, number> = {};
      for (const t of transactions) {
        if (t.type !== "expense" || getMonthKey(t.date) !== month) continue;
        const name = (t.merchant || t.title || "Other").trim();
        counts[name] = (counts[name] || 0) + 1;
      }
      return counts;
    };
    const currentCounts = merchantCount(currentMonth);
    const priorCounts = merchantCount(previousMonth);
    for (const [merchant, count] of Object.entries(currentCounts)) {
      const before = priorCounts[merchant] || 0;
      if (before < 3 || count < before * 1.3) continue;
      const currentSpend = currentExpenses
        .filter((t) => (t.merchant || t.title || "Other").trim() === merchant)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      leaks.push({
        id: `frequency-${merchant.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        title: `${merchant} purchase frequency rose`,
        category: "Frequency",
        annual: currentSpend * 12,
        tip: `Orders rose from ${before} to ${count} this month (${Math.round(((count - before) / before) * 100)}%). Plan a weekly limit to bring the habit back in range.`,
        severity: count >= before * 1.75 ? "high" : "medium",
      });
    }
  }

  // 9. Forgotten recurring charges: detect equal-value charges at roughly
  // monthly intervals that are not already tracked in Subscription Shield.
  const trackedNames = subscriptions.map((s: any) => (s.name || "").toLowerCase());
  const recurring: Record<string, Tx[]> = {};
  for (const t of transactions.filter((t) => t.type === "expense")) {
    const name = (t.merchant || t.title || "Other").trim();
    if (trackedNames.some((tracked) => tracked && name.toLowerCase().includes(tracked))) continue;
    const key = `${name.toLowerCase()}::${Math.round(Math.abs(t.amount))}`;
    (recurring[key] ||= []).push(t);
  }
  for (const [key, charges] of Object.entries(recurring)) {
    if (charges.length < 2) continue;
    const sorted = [...charges].sort((a, b) => a.date.localeCompare(b.date));
    const gaps = sorted.slice(1).map((t, index) => (new Date(t.date).getTime() - new Date(sorted[index].date).getTime()) / 86400000);
    const monthly = gaps.every((gap) => gap >= 25 && gap <= 35);
    if (!monthly) continue;
    const amount = Math.abs(sorted[0].amount);
    const name = sorted[0].merchant || sorted[0].title || "Recurring charge";
    leaks.push({
      id: `recurring-${key.replace(/[^a-z0-9]+/g, "-")}`,
      title: `${name} appears to recur monthly`,
      category: "Recurring",
      annual: amount * 12,
      tip: `₹${Math.round(amount).toLocaleString("en-IN")} has appeared ${charges.length} times at a monthly interval. Track it as a subscription or cancel it if it is no longer useful.`,
      severity: amount >= 1000 ? "medium" : "low",
    });
  }

  const totalAnnual = leaks.reduce((s, l) => s + l.annual, 0);
  return { leaks: leaks.sort((a, b) => b.annual - a.annual), totalAnnual };
}

// ─── Phase 4: Savings flow ───────────────────────────────────────────────
const FLOW_NEEDS = new Set(["rent", "grocery", "groceries", "medical", "health", "utilities", "bills", "insurance", "education"]);
const FLOW_SAVINGS = new Set(["savings", "investment", "sip", "gold", "mutual fund", "stocks", "ppf", "fd", "goal"]);

export function needsWantsSavings(transactions: Tx[], monthKey: string) {
  const totals = { needs: 0, wants: 0, savings: 0, emis: 0 };
  for (const t of transactions) {
    if (t.type !== "expense" || getMonthKey(t.date) !== monthKey) continue;
    const amount = Math.abs(t.amount);
    const category = (t.category || "").toLowerCase();
    const label = `${t.title || ""} ${t.merchant || ""} ${category}`.toLowerCase();
    if (/\bemi\b|loan repayment|loan emi/.test(label)) totals.emis += amount;
    else if (FLOW_SAVINGS.has(category)) totals.savings += amount;
    else if (FLOW_NEEDS.has(category)) totals.needs += amount;
    else totals.wants += amount;
  }
  return totals;
}

export function savingsFlow(transactions: Tx[], monthKey: string) {
  const income = transactions.filter((t) => t.type === "income" && getMonthKey(t.date) === monthKey).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const split = needsWantsSavings(transactions, monthKey);
  const spending = split.needs + split.wants + split.savings + split.emis;
  const leftForFuture = income - spending;
  const savingsRate = income > 0 ? (leftForFuture / income) * 100 : 0;
  return { income, ...split, spending, leftForFuture, savingsRate };
}

export function savingsProjection(transactions: Tx[], months = 6) {
  const keys = Array.from(new Set(transactions.map((t) => getMonthKey(t.date)))).sort().slice(-months);
  const monthly = keys.map((key) => ({ monthKey: key, ...savingsFlow(transactions, key) }));
  const averageMonthly = monthly.length ? monthly.reduce((sum, item) => sum + item.leftForFuture, 0) / monthly.length : 0;
  return { monthly, averageMonthly, annual: averageMonthly * 12 };
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

// ─── Phase 1: Spending Breakdown ──────────────────────────────────────────

export type CategorySpend = {
  category: string;
  total: number;
  count: number;
  pct: number;
  avgPerTx: number;
};

/** Returns spending grouped by category with % share for a given month. */
export function spendingByCategory(transactions: Tx[], monthKey: string): CategorySpend[] {
  const expenses = transactions.filter(
    (t) => t.type === "expense" && getMonthKey(t.date) === monthKey,
  );
  const map: Record<string, { total: number; count: number }> = {};
  for (const t of expenses) {
    const cat = t.category || "Other";
    if (!map[cat]) map[cat] = { total: 0, count: 0 };
    map[cat].total += Math.abs(t.amount);
    map[cat].count += 1;
  }
  const grandTotal = Object.values(map).reduce((s, v) => s + v.total, 0) || 1;
  return Object.entries(map)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      pct: (data.total / grandTotal) * 100,
      avgPerTx: data.count > 0 ? data.total / data.count : 0,
    }));
}

export type MerchantSpend = {
  merchant: string;
  total: number;
  count: number;
  pct: number;
  category: string;
  avgPerTx: number;
};

/** Returns spending grouped by normalized merchant name with frequency & total. */
export function spendingByMerchant(transactions: Tx[], monthKey: string): MerchantSpend[] {
  const expenses = transactions.filter(
    (t) => t.type === "expense" && getMonthKey(t.date) === monthKey,
  );
  const map: Record<string, { total: number; count: number; category: string }> = {};
  for (const t of expenses) {
    const name = (t.merchant || t.title || "Other").trim();
    if (!map[name]) map[name] = { total: 0, count: 0, category: t.category || "Other" };
    map[name].total += Math.abs(t.amount);
    map[name].count += 1;
  }
  const grandTotal = Object.values(map).reduce((s, v) => s + v.total, 0) || 1;
  return Object.entries(map)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([merchant, data]) => ({
      merchant,
      total: data.total,
      count: data.count,
      pct: (data.total / grandTotal) * 100,
      category: data.category,
      avgPerTx: data.count > 0 ? data.total / data.count : 0,
    }));
}

export type TopSpend = {
  id: string;
  title: string;
  merchant: string;
  amount: number;
  category: string;
  date: string;
  pctOfTotal: number;
};

/** Returns top N spends by absolute amount in a month. */
export function topSpends(transactions: Tx[], monthKey: string, n = 10): TopSpend[] {
  const expenses = transactions
    .filter((t) => t.type === "expense" && getMonthKey(t.date) === monthKey)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const totalSpend = expenses.reduce((s, t) => s + Math.abs(t.amount), 0) || 1;
  return expenses.slice(0, n).map((t) => ({
    id: t.id,
    title: t.title,
    merchant: t.merchant || t.title || "Unknown",
    amount: Math.abs(t.amount),
    category: t.category || "Other",
    date: t.date,
    pctOfTotal: (Math.abs(t.amount) / totalSpend) * 100,
  }));
}

export type AccountSummary = {
  accountId: string;
  income: number;
  expense: number;
  txCount: number;
  topCategory: string;
};

/** Returns summary stats for a specific account's linked transactions. */
export function getAccountSummary(transactions: Tx[], accountId: string, monthKey?: string): AccountSummary {
  let filtered = transactions.filter((t) => t.accountId === accountId);
  if (monthKey) filtered = filtered.filter((t) => getMonthKey(t.date) === monthKey);
  const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
  const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
  // Find top category
  const catMap: Record<string, number> = {};
  for (const t of filtered.filter((t) => t.type === "expense")) {
    const cat = t.category || "Other";
    catMap[cat] = (catMap[cat] || 0) + Math.abs(t.amount);
  }
  const topCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  return { accountId, income, expense, txCount: filtered.length, topCategory };
}

// ─── Phase 2: Spending Patterns & Comparisons ────────────────────────────

export type CategoryComparison = {
  category: string;
  currentAmount: number;
  previousAmount: number;
  change: number;      // absolute change
  changePct: number;   // percentage change
  direction: "up" | "down" | "same";
};

/** Compares category-wise spending between two months. */
export function monthComparison(transactions: Tx[], monthA: string, monthB: string): CategoryComparison[] {
  const catA = spendingByCategory(transactions, monthA);
  const catB = spendingByCategory(transactions, monthB);
  const mapB = new Map(catB.map((c) => [c.category, c.total]));
  const allCategories = new Set([...catA.map((c) => c.category), ...catB.map((c) => c.category)]);
  const result: CategoryComparison[] = [];

  for (const category of allCategories) {
    const currentAmount = catA.find((c) => c.category === category)?.total ?? 0;
    const previousAmount = mapB.get(category) ?? 0;
    const change = currentAmount - previousAmount;
    const changePct = previousAmount > 0 ? (change / previousAmount) * 100 : currentAmount > 0 ? 100 : 0;
    result.push({
      category,
      currentAmount,
      previousAmount,
      change,
      changePct,
      direction: changePct > 5 ? "up" : changePct < -5 ? "down" : "same",
    });
  }
  return result.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
}

export type SpendingAnomaly = {
  category: string;
  currentAmount: number;
  averageAmount: number;
  deviation: number;     // % above/below average
  direction: "spike" | "drop";
  message: string;
};

/** Detects categories where spending spiked or dropped >20% vs lookback average. */
export function spendingAnomalies(
  transactions: Tx[],
  monthKey: string,
  lookbackMonths = 3,
): SpendingAnomaly[] {
  const currentCats = spendingByCategory(transactions, monthKey);
  const anomalies: SpendingAnomaly[] = [];

  // Build average from lookback months
  const lookbackTotals: Record<string, number[]> = {};
  for (let i = 1; i <= lookbackMonths; i++) {
    const prevMonth = shiftMonthKey(monthKey, -i);
    const prevCats = spendingByCategory(transactions, prevMonth);
    for (const c of prevCats) {
      (lookbackTotals[c.category] ||= []).push(c.total);
    }
  }

  for (const cat of currentCats) {
    const history = lookbackTotals[cat.category] || [];
    if (history.length === 0) continue;
    const avg = history.reduce((s, v) => s + v, 0) / history.length;
    if (avg < 500) continue; // Ignore tiny categories
    const deviation = ((cat.total - avg) / avg) * 100;
    if (Math.abs(deviation) >= 20) {
      const direction = deviation > 0 ? "spike" : "drop";
      anomalies.push({
        category: cat.category,
        currentAmount: cat.total,
        averageAmount: avg,
        deviation,
        direction,
        message:
          direction === "spike"
            ? `Your ${cat.category} spending jumped ${Math.abs(deviation).toFixed(0)}% this month`
            : `Your ${cat.category} spending dropped ${Math.abs(deviation).toFixed(0)}% this month`,
      });
    }
  }
  return anomalies.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}

export type HeatmapCell = {
  monthKey: string;
  monthLabel: string;
  category: string;
  amount: number;
  intensity: number; // 0-1 normalized
};

/** Returns a months × category heatmap grid showing spend intensity. */
export function spendingHeatmap(
  transactions: Tx[],
  endMonth: string,
  months = 6,
): { cells: HeatmapCell[]; categories: string[]; monthKeys: string[] } {
  const monthKeys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    monthKeys.push(shiftMonthKey(endMonth, -i));
  }

  // Gather all category data
  const allData: Map<string, Map<string, number>> = new Map(); // month -> category -> amount
  const catTotals: Record<string, number> = {};

  for (const mk of monthKeys) {
    const cats = spendingByCategory(transactions, mk);
    const catMap = new Map<string, number>();
    for (const c of cats) {
      catMap.set(c.category, c.total);
      catTotals[c.category] = (catTotals[c.category] || 0) + c.total;
    }
    allData.set(mk, catMap);
  }

  // Top categories by total spend across all months
  const categories = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat]) => cat);

  // Find global max for intensity normalization
  let maxAmount = 0;
  for (const catMap of allData.values()) {
    for (const [cat, amount] of catMap) {
      if (categories.includes(cat) && amount > maxAmount) maxAmount = amount;
    }
  }

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const cells: HeatmapCell[] = [];
  for (const mk of monthKeys) {
    const catMap = allData.get(mk) || new Map();
    const mIdx = parseInt(mk.slice(5, 7), 10) - 1;
    for (const category of categories) {
      const amount = catMap.get(category) || 0;
      cells.push({
        monthKey: mk,
        monthLabel: MONTH_NAMES[mIdx] || mk,
        category,
        amount,
        intensity: maxAmount > 0 ? amount / maxAmount : 0,
      });
    }
  }

  return { cells, categories, monthKeys };
}

/** Category-level lifestyle inflation — which categories are inflating fastest. */
export function categoryInflation(
  transactions: Tx[],
  recentMonths = 3,
): { category: string; recentAvg: number; olderAvg: number; growthPct: number }[] {
  const now = new Date();
  const results: { category: string; recentAvg: number; olderAvg: number; growthPct: number }[] = [];

  // Gather recent and older month keys
  const recentKeys: string[] = [];
  const olderKeys: string[] = [];
  for (let i = 0; i < recentMonths; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    recentKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  for (let i = recentMonths; i < recentMonths * 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    olderKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  // Sum per category for recent and older
  const recentMap: Record<string, number> = {};
  const olderMap: Record<string, number> = {};

  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const mk = getMonthKey(t.date);
    const cat = t.category || "Other";
    if (recentKeys.includes(mk)) recentMap[cat] = (recentMap[cat] || 0) + Math.abs(t.amount);
    if (olderKeys.includes(mk)) olderMap[cat] = (olderMap[cat] || 0) + Math.abs(t.amount);
  }

  const allCats = new Set([...Object.keys(recentMap), ...Object.keys(olderMap)]);
  for (const cat of allCats) {
    const recentAvg = (recentMap[cat] || 0) / recentMonths;
    const olderAvg = (olderMap[cat] || 0) / recentMonths;
    if (olderAvg < 500 && recentAvg < 500) continue; // Skip tiny categories
    const growthPct = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : recentAvg > 0 ? 100 : 0;
    results.push({ category: cat, recentAvg, olderAvg, growthPct });
  }

  return results.sort((a, b) => b.growthPct - a.growthPct);
}

/** Helper: shift a YYYY-MM string by N months (avoids importing dateUtils circular). */
function shiftMonthKey(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ════════════════════════════════════════════════════════════════════════
// [P0] Cash Flow Forecast Engine — predicts near-future balance instead of
// only reporting past balance. Pure, deterministic, no network call.
// ════════════════════════════════════════════════════════════════════════
export type ForecastPoint = {
  date: string;        // YYYY-MM-DD
  projectedBalance: number;
  isPast: boolean;
};

export type CashFlowForecast = {
  points: ForecastPoint[];
  endOfMonthBalance: number;
  lowestPoint: ForecastPoint;
  willGoBelowZero: boolean;
  willGoBelowSafetyLine: boolean;
  daysUntilRisk: number | null; // days from today until balance < safetyLine, or null
};

/**
 * Projects balance forward `daysAhead` days using:
 *  1) Detected recurring transactions (same merchant/category, similar amount,
 *     recurring cadence) as fixed future events on their known day-of-month.
 *  2) A day-of-week discretionary spend average from the last 8 weeks, applied
 *     to remaining days that have no recurring event.
 * This intentionally avoids an LLM round-trip — it's arithmetic on data
 * already in memory, so it can run on every Dashboard render.
 */
export function forecastCashFlow(
  transactions: Tx[],
  currentBalance: number,
  daysAhead = 30,
  safetyLine = 0,
): CashFlowForecast {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1) Detect recurring items: group by (title|merchant, roughly same amount),
  //    keep ones seen in at least 2 of the last 3 months on a similar day-of-month.
  type Recurring = { key: string; amount: number; type: "income" | "expense"; dayOfMonth: number };
  const groups: Record<string, { amounts: number[]; days: number[]; type: "income" | "expense" }> = {};
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 95);
  for (const t of transactions) {
    const d = new Date(t.date);
    if (d < cutoff) continue;
    const key = `${(t.merchant || t.title || "").trim().toLowerCase()}|${t.type}`;
    if (!key.trim()) continue;
    (groups[key] ||= { amounts: [], days: [], type: t.type }).amounts.push(Math.abs(t.amount));
    groups[key].days.push(d.getDate());
  }
  const recurring: Recurring[] = [];
  for (const [key, g] of Object.entries(groups)) {
    if (g.amounts.length < 2) continue; // needs to have repeated
    const avgAmount = g.amounts.reduce((s, v) => s + v, 0) / g.amounts.length;
    const avgDay = Math.round(g.days.reduce((s, v) => s + v, 0) / g.days.length);
    // Only trust it as "recurring" if the amounts are reasonably consistent (low variance)
    const variance = g.amounts.reduce((s, v) => s + Math.abs(v - avgAmount), 0) / g.amounts.length;
    if (variance / Math.max(avgAmount, 1) > 0.35) continue; // too noisy to call recurring
    recurring.push({ key, amount: avgAmount, type: g.type, dayOfMonth: avgDay });
  }

  // 2) Day-of-week discretionary baseline from the last 56 days of expenses
  //    that are NOT part of a recurring group (so we don't double count).
  const recurringKeys = new Set(recurring.map((r) => r.key));
  const lookback = new Date(today);
  lookback.setDate(lookback.getDate() - 56);
  const dowTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
  const dowCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const d = new Date(t.date);
    if (d < lookback || d > today) continue;
    const key = `${(t.merchant || t.title || "").trim().toLowerCase()}|expense`;
    if (recurringKeys.has(key)) continue;
    dowTotals[d.getDay()] += Math.abs(t.amount);
  }
  const weeksInLookback = 8;
  const dowAverage = dowTotals.map((total) => total / weeksInLookback);

  // 3) Walk forward day by day
  const points: ForecastPoint[] = [];
  let balance = currentBalance;
  let lowest: ForecastPoint = { date: today.toISOString().slice(0, 10), projectedBalance: balance, isPast: false };
  let daysUntilRisk: number | null = null;

  for (let i = 0; i <= daysAhead; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    if (i > 0) {
      // Apply recurring events landing on this day-of-month
      for (const r of recurring) {
        if (r.dayOfMonth === d.getDate()) {
          balance += r.type === "income" ? r.amount : -r.amount;
        }
      }
      // Apply discretionary daily average for this day-of-week
      balance -= dowAverage[d.getDay()];
    }

    const point: ForecastPoint = { date: dateStr, projectedBalance: Math.round(balance), isPast: false };
    points.push(point);
    if (point.projectedBalance < lowest.projectedBalance) lowest = point;
    if (daysUntilRisk === null && point.projectedBalance < safetyLine) daysUntilRisk = i;
  }

  const endOfMonthIdx = Math.min(daysAhead, points.length - 1);
  return {
    points,
    endOfMonthBalance: points[endOfMonthIdx]?.projectedBalance ?? Math.round(balance),
    lowestPoint: lowest,
    willGoBelowZero: lowest.projectedBalance < 0,
    willGoBelowSafetyLine: lowest.projectedBalance < safetyLine,
    daysUntilRisk,
  };
}

/** Detects large recurring items (annual/quarterly cadence) due in the next
 *  `warnDays` days — used for "bill shock" prevention cards. [P0] */
export type UpcomingBigBill = { title: string; amount: number; dueInDays: number; cadence: "quarterly" | "annual" };
export function upcomingBigBills(transactions: Tx[], warnDays = 21): UpcomingBigBill[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const groups: Record<string, { dates: Date[]; amounts: number[] }> = {};
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const key = (t.merchant || t.title || "").trim().toLowerCase();
    if (!key) continue;
    (groups[key] ||= { dates: [], amounts: [] }).dates.push(new Date(t.date));
    groups[key].amounts.push(Math.abs(t.amount));
  }
  const results: UpcomingBigBill[] = [];
  for (const [key, g] of Object.entries(groups)) {
    if (g.dates.length < 2) continue;
    g.dates.sort((a, b) => a.getTime() - b.getTime());
    const gapsDays: number[] = [];
    for (let i = 1; i < g.dates.length; i++) {
      gapsDays.push((g.dates[i].getTime() - g.dates[i - 1].getTime()) / 86400000);
    }
    const avgGap = gapsDays.reduce((s, v) => s + v, 0) / gapsDays.length;
    const isQuarterly = avgGap > 75 && avgGap < 110;
    const isAnnual = avgGap > 330 && avgGap < 400;
    if (!isQuarterly && !isAnnual) continue;
    const lastDate = g.dates[g.dates.length - 1];
    const nextDue = new Date(lastDate);
    nextDue.setDate(nextDue.getDate() + Math.round(avgGap));
    const dueInDays = Math.round((nextDue.getTime() - today.getTime()) / 86400000);
    if (dueInDays >= 0 && dueInDays <= warnDays) {
      const avgAmount = g.amounts.reduce((s, v) => s + v, 0) / g.amounts.length;
      results.push({
        title: key.replace(/\b\w/g, (c) => c.toUpperCase()),
        amount: Math.round(avgAmount),
        dueInDays,
        cadence: isAnnual ? "annual" : "quarterly",
      });
    }
  }
  return results.sort((a, b) => a.dueInDays - b.dueInDays);
}

