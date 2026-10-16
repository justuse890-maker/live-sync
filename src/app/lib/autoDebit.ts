/**
 * autoDebit.ts — a plain heads-up for payments that may leave the account on their own in the next three days.
 *
 * RBI's e-mandate rules make the bank or card issuer send a pre-debit notice at least 24 hours before an auto-debit,
 * with the merchant, amount, date and a way to opt out. This mirrors the same facts from what the user entered, so they
 * see it in one place. It supplements the issuer's notice and never replaces it. We do not know whether a given
 * payment is actually set to auto-debit, so the wording says "if".
 */
import { formatInr } from "./money";
import type { Obligation } from "./obligations";

export type AutoDebitNotice = { id: string; title: string; amountText: string; whenText: string; body: string; stopHint: string; screen: string; dueAt: Date };

const STOP_HINT: Record<string, string> = {
  subscription: "To stop it, cancel in the merchant's app, or switch off the mandate under AutoPay / e-mandates in your bank or UPI app.",
  emi: "To change it, contact your lender or switch off the mandate in your bank app. Stopping a mandate does not cancel the loan; the EMI is still due.",
  insurance: "To stop it, turn off the premium mandate in your insurer's app or in your bank's e-mandates list. A missed premium can lapse the policy.",
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function autoDebitNotices(obligations: Obligation[], now = new Date(), withinDays = 3): AutoDebitNotice[] {
  const today = startOfDay(now);
  return obligations
    .filter((o) => STOP_HINT[o.source] && !o.overdue && (o.amount ?? 0) > 0)
    .map((o) => ({ o, days: Math.round((startOfDay(o.dueAt) - today) / 86400000) }))
    .filter(({ days }) => days >= 0 && days <= withinDays)
    .sort((a, b) => a.o.dueAt.getTime() - b.o.dueAt.getTime() || (b.o.amount as number) - (a.o.amount as number))
    .map(({ o, days }) => {
      const whenText = days === 0 ? "today" : days === 1 ? "tomorrow" : o.dueAt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
      return {
        id: o.id,
        title: o.title,
        amountText: formatInr(o.amount),
        whenText,
        body: `If this is set to auto-debit, ${formatInr(o.amount)} may leave your account ${whenText}. Your bank or card issuer should have sent a notice at least 24 hours before.`,
        stopHint: STOP_HINT[o.source],
        screen: o.screen as string,
        dueAt: o.dueAt,
      };
    });
}
