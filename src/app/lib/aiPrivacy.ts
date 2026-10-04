/**
 * aiPrivacy.ts — the ONLY data that may leave the device for AI features.
 *
 * Principles:
 *  • Minimum necessary: category totals for this month and last month, income,
 *    spend, savings rate. No transaction list, no dates, no merchant names,
 *    no notes, no account/card numbers, no names, no email, no user id.
 *  • Anonymous: amounts are rounded to the nearest ₹100 so exact figures
 *    can't be used to fingerprint a person. Requests carry no identifier.
 *  • Redacted: anything the user types is scrubbed of phone numbers, emails,
 *    PAN, Aadhaar, card/account numbers, IFSC and UPI IDs before sending.
 *  • Visible: the exact payload is shown to the user ("What AI sees").
 */
import { getMonthKey, shiftMonth, getCurrentMonthKey } from "./dateUtils";

const round100 = (n: number) => Math.round(n / 100) * 100;

export function redactText(input: string): string {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b[\w.-]{2,}@(ok|ybl|ibl|axl|upi|paytm|apl|sbi|icici|hdfcbank|axisbank|kotak|yesbank|oksbi|okhdfcbank|okicici|okaxis)\w*\b/gi, "[upi-id]")
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, "[pan]")
    .replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, "[ifsc]")
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[id-number]")              // Aadhaar-like
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[card-number]")                // cards
    .replace(/\b\d{9,18}\b/g, "[account-number]")                        // bank accounts
    .replace(/(?:\+91[\s-]?)?\b[6-9]\d{9}\b/g, "[phone]");
}

type Tx = { amount: number; type: "income" | "expense"; date: string; category: string };

export function buildAiContext(transactions: Tx[]) {
  const thisMonth = getCurrentMonthKey();
  const lastMonth = shiftMonth(thisMonth, -1);
  const summarise = (key: string) => {
    let income = 0, spend = 0;
    const byCategory: Record<string, number> = {};
    for (const t of transactions) {
      if (getMonthKey(t.date) !== key) continue;
      const a = Math.abs(Number(t.amount) || 0);
      if (t.type === "income") income += a;
      else {
        spend += a;
        const c = (t.category || "Other").slice(0, 24);
        byCategory[c] = (byCategory[c] || 0) + a;
      }
    }
    const cats = Object.fromEntries(
      Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [k, round100(v)]),
    );
    return {
      income: round100(income),
      spend: round100(spend),
      savingsRatePct: income > 0 ? Math.round(((income - spend) / income) * 100) : null,
      spendByCategory: cats,
    };
  };
  return {
    note: "Anonymous, rounded monthly totals only. No names, dates, merchants or account details.",
    currency: "INR",
    thisMonth: summarise(thisMonth),
    lastMonth: summarise(lastMonth),
  };
}

export const AI_CONSENT_KEY = "ls_ai_consent_v2";
export const hasAiConsent = () => { try { return localStorage.getItem(AI_CONSENT_KEY) === "yes"; } catch { return false; } };
export const setAiConsent = (v: boolean) => { try { v ? localStorage.setItem(AI_CONSENT_KEY, "yes") : localStorage.removeItem(AI_CONSENT_KEY); } catch {} };
