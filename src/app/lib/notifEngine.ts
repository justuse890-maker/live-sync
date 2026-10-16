/**
 * LiveSync Smart Notification Engine
 * Generates intelligent in-app monthly alerts from real store data.
 * No API calls — pure deterministic logic on local state.
 */

import { getMonthKey } from "./dateUtils";
import { formatInr } from "./money";
import { detectRecurring, billRises } from "./recurring";

export type SmartNotif = {
  id: string;
  title: string;
  body: string;
  kind: "emi_due" | "budget_alert" | "budget_pace" | "bill_rise" | "bucket_behind" | "subscription_due" | "insurance_due" | "credit_due" | "monthly_summary" | "goal_update";
  severity: "info" | "warning" | "urgent";
  at: string; // ISO date string
  read?: boolean;
};

type NotifEngineInput = {
  transactions: Array<{ amount: number; type: string; date: string; category: string; title?: unknown; merchant?: unknown; isTransfer?: boolean }>;
  budgets: Array<{ category: string; limit: number; spent: number }>;
  buckets: Array<{ id: string; name: string; savedAmount: number; targetAmount: number; monthlySaveTarget?: number }>;
  bucketContributions: Array<{ bucketId: string; amount: number; date: string }>;
  subscriptions: Array<{ name: string; cost: number; renewal: string }>;
  insurance: Array<{ name: string; premiumAmount: number; dueDate: string }>;
  structuredLoans: Array<{ lenderName: string; emiAmount: number; nextEmiDueDate: string; closed?: boolean }>;
  creditCards: Array<{ bankName: string; cardName: string; last4Digits: string; statementDate?: number; dueDate?: number }>;
};

export type EngineOptions = {
  now?: Date;
  /** The user's alert choices (see alertPrefs.ts). Missing values use the defaults. */
  prefs?: { budgetWarnPct?: number; paceAlerts?: boolean };
};

export function generateSmartNotifications(input: NotifEngineInput, opts: EngineOptions = {}): SmartNotif[] {
  const notifs: SmartNotif[] = [];
  const now = opts.now ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const currentMonth = today.slice(0, 7);
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const warnPct = Math.min(95, Math.max(50, opts.prefs?.budgetWarnPct ?? 85));
  const paceAlerts = opts.prefs?.paceAlerts ?? true;

  // ─── 1. EMI Due in Next 5 Days ───────────────────────────────────────────
  for (const loan of input.structuredLoans) {
    if (loan.closed) continue;
    const emiDate = new Date(loan.nextEmiDueDate);
    const daysUntil = Math.ceil((emiDate.getTime() - now.getTime()) / 86400000);
    if (daysUntil >= 0 && daysUntil <= 5) {
      notifs.push({
        id: `emi-${loan.lenderName}-${loan.nextEmiDueDate}`,
        title: `EMI Due Soon — ${loan.lenderName}`,
        body: `₹${loan.emiAmount.toLocaleString("en-IN")} EMI due on ${loan.nextEmiDueDate} (${daysUntil === 0 ? "today!" : `in ${daysUntil} day${daysUntil > 1 ? "s" : ""}`})`,
        kind: "emi_due",
        severity: daysUntil <= 1 ? "urgent" : "warning",
        at: today,
      });
    }
  }

  // ─── 2. Budget Overspend Alert (>85% used) ───────────────────────────────
  const monthExpenses = input.transactions.filter(t => t.type === "expense" && getMonthKey(t.date) === currentMonth);
  for (const budget of input.budgets) {
    const actualSpent = monthExpenses
      .filter(t => t.category === budget.category)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const pct = budget.limit > 0 ? (actualSpent / budget.limit) * 100 : 0;
    if (pct >= 100) {
      notifs.push({
        id: `budget-over-${budget.category}-${currentMonth}`,
        title: `Budget Exceeded — ${budget.category}`,
        body: `You've spent ₹${Math.round(actualSpent).toLocaleString("en-IN")} against a ₹${budget.limit.toLocaleString("en-IN")} budget. Over by ₹${Math.round(actualSpent - budget.limit).toLocaleString("en-IN")}.`,
        kind: "budget_alert",
        severity: "urgent",
        at: today,
      });
    } else if (pct >= warnPct) {
      notifs.push({
        id: `budget-warn-${budget.category}-${currentMonth}`,
        title: `Budget Warning — ${budget.category}`,
        body: `${pct.toFixed(0)}% of your ₹${budget.limit.toLocaleString("en-IN")} ${budget.category} budget used. ₹${Math.round(budget.limit - actualSpent).toLocaleString("en-IN")} remaining.`,
        kind: "budget_alert",
        severity: "warning",
        at: today,
      });
    } else if (paceAlerts && dayOfMonth >= 7 && pct >= 40 && actualSpent > 0) {
      // Early heads-up: not over yet, but this month's pace will carry the category past its limit.
      const projected = (actualSpent / dayOfMonth) * daysInMonth;
      if (projected > budget.limit) {
        notifs.push({
          id: `budget-pace-${budget.category}-${currentMonth}`,
          title: `${budget.category} is on pace to pass its budget`,
          body: `${formatInr(actualSpent)} of ${formatInr(budget.limit)} used by day ${dayOfMonth}. At this pace the month ends near ${formatInr(projected)}. You can still slow down or adjust the budget.`,
          kind: "budget_pace",
          severity: "info",
          at: today,
        });
      }
    }
  }

  // ─── 2b. Fixed monthly bill that got dearer ──────────────────────────────
  for (const r of billRises(detectRecurring(input.transactions as any, now))) {
    if ((now.getTime() - new Date(`${r.lastDate}T12:00:00`).getTime()) / 86400000 > 30) continue;
    notifs.push({
      id: `rise-${r.label}-${r.lastDate}`,
      title: `${r.label} costs more than before`,
      body: `Earlier payments were ${formatInr(r.previous)}; the latest was ${formatInr(r.latest)} (${Math.round(r.risePct)}% higher). Check whether the plan or price changed.`,
      kind: "bill_rise",
      severity: "info",
      at: today,
    });
  }

  // ─── 3. Bucket Behind Schedule (mid-month check) ─────────────────────────
  if (dayOfMonth >= 15) {
    for (const bucket of input.buckets) {
      if (!bucket.monthlySaveTarget || bucket.monthlySaveTarget <= 0) continue;
      const thisMonthContribs = input.bucketContributions
        .filter(c => c.bucketId === bucket.id && getMonthKey(c.date) === currentMonth)
        .reduce((s, c) => s + c.amount, 0);
      const halfMonthTarget = bucket.monthlySaveTarget / 2;
      if (thisMonthContribs < halfMonthTarget) {
        const deficit = bucket.monthlySaveTarget - thisMonthContribs;
        notifs.push({
          id: `bucket-behind-${bucket.id}-${currentMonth}`,
          title: `Bucket Behind — ${bucket.name}`,
          body: `You've saved ₹${thisMonthContribs.toLocaleString("en-IN")} of your ₹${bucket.monthlySaveTarget.toLocaleString("en-IN")} monthly target. Add ₹${Math.round(deficit).toLocaleString("en-IN")} more to stay on track.`,
          kind: "bucket_behind",
          severity: "warning",
          at: today,
        });
      }
    }
  }

  // ─── 4. Subscription Renewal Due in 7 Days ───────────────────────────────
  for (const sub of input.subscriptions) {
    const renewalDate = new Date(sub.renewal);
    const daysUntil = Math.ceil((renewalDate.getTime() - now.getTime()) / 86400000);
    if (daysUntil >= 0 && daysUntil <= 7) {
      notifs.push({
        id: `sub-${sub.name}-${sub.renewal}`,
        title: `Subscription Renews — ${sub.name}`,
        body: `₹${sub.cost.toLocaleString("en-IN")} will be auto-charged on ${sub.renewal}. Review if you still need it.`,
        kind: "subscription_due",
        severity: daysUntil <= 2 ? "warning" : "info",
        at: today,
      });
    }
  }

  // ─── 5. Insurance Premium Due This Month ─────────────────────────────────
  for (const policy of input.insurance) {
    const dueMonth = policy.dueDate.slice(0, 7);
    if (dueMonth === currentMonth) {
      const dueDay = new Date(policy.dueDate);
      const daysUntil = Math.ceil((dueDay.getTime() - now.getTime()) / 86400000);
      if (daysUntil >= 0 && daysUntil <= 14) {
        notifs.push({
          id: `ins-${policy.name}-${policy.dueDate}`,
          title: `Insurance Premium Due — ${policy.name}`,
          body: `₹${policy.premiumAmount.toLocaleString("en-IN")} due on ${policy.dueDate}. Ensure sufficient balance.`,
          kind: "insurance_due",
          severity: daysUntil <= 5 ? "warning" : "info",
          at: today,
        });
      }
    }
  }

  // ─── 6. Credit Card Bill Due in 5 Days (approximate) ─────────────────────
  for (const card of input.creditCards) {
    if (!card.statementDate || !card.dueDate) continue;
    // Calculate bill due date = statementDate + dueDate days in current month
    const statementDay = new Date(now.getFullYear(), now.getMonth(), card.statementDate);
    const billDueDate = new Date(statementDay);
    billDueDate.setDate(billDueDate.getDate() + card.dueDate);
    const daysUntilDue = Math.ceil((billDueDate.getTime() - now.getTime()) / 86400000);
    if (daysUntilDue >= 0 && daysUntilDue <= 5) {
      notifs.push({
        id: `cc-${card.last4Digits}-${billDueDate.toISOString().slice(0, 10)}`,
        title: `Credit Card Bill Due — ${card.bankName} ••${card.last4Digits}`,
        body: `${card.cardName} bill due on ${billDueDate.toLocaleDateString("en-IN")}. Pay to avoid interest & CIBIL impact.`,
        kind: "credit_due",
        severity: daysUntilDue <= 1 ? "urgent" : "warning",
        at: today,
      });
    }
  }

  // ─── 7. End-of-Month Summary (days 28-31) ─────────────────────────────────
  if (dayOfMonth >= 28) {
    const monthIncome = input.transactions
      .filter(t => t.type === "income" && getMonthKey(t.date) === currentMonth)
      .reduce((s, t) => s + t.amount, 0);
    const monthExpenseTotal = monthExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);
    const monthSavings = monthIncome - monthExpenseTotal;
    const bucketSavedThisMonth = input.bucketContributions
      .filter(c => getMonthKey(c.date) === currentMonth)
      .reduce((s, c) => s + c.amount, 0);

    if (monthIncome > 0) {
      notifs.push({
        id: `summary-${currentMonth}`,
        title: `Monthly Wrap — ${new Date(currentMonth + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`,
        body: `Income: ₹${monthIncome.toLocaleString("en-IN")} · Expenses: ₹${monthExpenseTotal.toLocaleString("en-IN")} · Saved: ₹${Math.max(0, monthSavings).toLocaleString("en-IN")}${bucketSavedThisMonth > 0 ? ` · Buckets: ₹${bucketSavedThisMonth.toLocaleString("en-IN")}` : ""}`,
        kind: "monthly_summary",
        severity: "info",
        at: today,
      });
    }
  }

  return notifs.sort((a, b) => {
    const order = { urgent: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}
