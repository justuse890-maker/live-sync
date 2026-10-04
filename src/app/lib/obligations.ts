/**
 * obligations.ts — one deterministic list of "money you have to pay / things
 * you have to do" built ONLY from data the user entered. Powers the home
 * "Today" card, the "Coming up next month" card, the notification bell and the
 * scheduled device notifications. If the user entered nothing, this is empty.
 */
import type { ScreenId } from "../components/types";
import type { Note } from "./notes";
import { isBill } from "./notes";

export type ObligationSource =
  | "note" | "bill" | "emi" | "subscription" | "card" | "insurance" | "household" | "society" | "loan";

export type Obligation = {
  id: string;            // stable across launches (used for notification ids)
  source: ObligationSource;
  title: string;
  amount?: number;       // undefined = user didn't enter an amount
  dueAt: Date;
  overdue: boolean;
  screen: ScreenId;
  noteId?: string;
};

type Input = {
  notes: Note[];
  structuredLoans: Array<{ id: string; lenderName: string; emiAmount: number; nextEmiDueDate: string; closed?: boolean; loanType?: string }>;
  subscriptions: Array<{ id: string; name: string; cost: number; renewal: string; status?: string; period?: string }>;
  creditCards: Array<{ id: string; bankName: string; cardName: string; last4Digits: string; dueDate?: number; cardType?: string }>;
  insurance: Array<{ id: string; name: string; premiumAmount: number; dueDate: string }>;
  householdReminders: Array<{ id: string; title: string; dueDate: string; done: boolean }>;
  societyNotices: Array<{ id: string; title: string; type: string; date: string; amount?: number; paid?: boolean }>;
  loans: Array<{ id: string; person: string; amount: number; repayBy: string; direction: string; settled?: boolean }>;
};

const DAY = 86400000;
const validDate = (s?: string) => {
  if (!s) return null;
  const d = new Date(s.length === 10 ? `${s}T09:00:00` : s);
  return isNaN(d.getTime()) ? null : d;
};

function nextMonthly(from: Date, now: Date, graceDays: number): Date {
  const d = new Date(from);
  let guard = 0;
  while (d.getTime() < now.getTime() - graceDays * DAY && guard++ < 600) {
    const day = from.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  return d;
}
function nextYearly(from: Date, now: Date, graceDays: number): Date {
  const d = new Date(from);
  let guard = 0;
  while (d.getTime() < now.getTime() - graceDays * DAY && guard++ < 200) d.setFullYear(d.getFullYear() + 1);
  return d;
}

/**
 * @param horizonDays how far ahead to look
 * @param overdueDays how far back an unpaid item still counts as overdue
 */
export function buildObligations(input: Input, horizonDays = 35, overdueDays = 10, now = new Date()): Obligation[] {
  const out: Obligation[] = [];
  const end = now.getTime() + horizonDays * DAY;
  const push = (o: Omit<Obligation, "overdue">) => {
    const t = o.dueAt.getTime();
    if (t > end || t < now.getTime() - overdueDays * DAY) return;
    out.push({ ...o, overdue: t < now.getTime() });
  };

  // 1. Notes & bills (user-created reminders)
  for (const n of input.notes) {
    if (n.archived || !n.reminder) continue;
    const at = validDate(n.reminder.at);
    if (!at) continue;
    push({
      id: `note:${n.id}:${n.reminder.at}`,
      source: isBill(n) ? "bill" : "note",
      title: n.title || n.body.slice(0, 40) || "Reminder",
      amount: isBill(n) ? n.amount : undefined,
      dueAt: at,
      screen: "notes" as ScreenId,
      noteId: n.id,
    });
  }

  // 2. Loan EMIs
  for (const l of input.structuredLoans) {
    if (l.closed) continue;
    const d = validDate(l.nextEmiDueDate);
    if (!d) continue;
    push({ id: `emi:${l.id}`, source: "emi", title: `${l.lenderName} EMI`, amount: l.emiAmount || undefined, dueAt: nextMonthly(d, now, 3), screen: "loans" });
  }

  // 3. Subscriptions
  for (const s of input.subscriptions) {
    if (s.status && /cancel|paused|inactive/i.test(s.status)) continue;
    const d = validDate(s.renewal);
    if (!d) continue;
    const yearly = /year|annual/i.test(s.period || "");
    push({ id: `sub:${s.id}`, source: "subscription", title: `${s.name} renewal`, amount: s.cost || undefined, dueAt: yearly ? nextYearly(d, now, 1) : nextMonthly(d, now, 1), screen: "subscriptions" });
  }

  // 4. Credit card payment day (only if the user set one)
  for (const c of input.creditCards) {
    if (!c.dueDate || (c.cardType && c.cardType !== "credit" && c.cardType !== "corporate")) continue;
    const base = new Date(now.getFullYear(), now.getMonth(), Math.min(c.dueDate, 28), 9, 0, 0);
    push({ id: `card:${c.id}`, source: "card", title: `${c.bankName} card ••${c.last4Digits} bill`, dueAt: nextMonthly(base, now, 2), screen: "cards" });
  }

  // 5. Insurance premiums (yearly)
  for (const p of input.insurance) {
    const d = validDate(p.dueDate);
    if (!d) continue;
    push({ id: `ins:${p.id}`, source: "insurance", title: `${p.name} premium`, amount: p.premiumAmount || undefined, dueAt: nextYearly(d, now, 3), screen: "insurance" });
  }

  // 6. Household reminders
  for (const r of input.householdReminders) {
    if (r.done) continue;
    const d = validDate(r.dueDate);
    if (!d) continue;
    push({ id: `hh:${r.id}`, source: "household", title: r.title, dueAt: d, screen: "reminders" });
  }

  // 7. Society bills
  for (const n of input.societyNotices) {
    if (n.type !== "bill" || n.paid) continue;
    const d = validDate(n.date);
    if (!d) continue;
    push({ id: `soc:${n.id}`, source: "society", title: n.title, amount: n.amount || undefined, dueAt: d, screen: "society" });
  }

  // 8. Personal money you borrowed and must return
  for (const l of input.loans) {
    if (l.settled || l.direction !== "borrowed") continue;
    const d = validDate(l.repayBy);
    if (!d) continue;
    push({ id: `loan:${l.id}`, source: "loan", title: `Repay ${l.person}`, amount: l.amount || undefined, dueAt: d, screen: "loans" });
  }

  return out.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

export function daysUntil(d: Date, now = new Date()): number {
  const s = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((s(d) - s(now)) / DAY);
}

export function dueLabel(d: Date, now = new Date()): string {
  const n = daysUntil(d, now);
  if (n < -1) return `${-n} days overdue`;
  if (n === -1) return "Overdue since yesterday";
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  if (n <= 7) return `In ${n} days`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Stable 31-bit integer for Android notification ids. */
export function notifIdFor(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (Math.abs(h) % 2_000_000_000) + 1000;
}
