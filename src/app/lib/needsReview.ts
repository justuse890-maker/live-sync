/**
 * needsReview.ts — entries worth a second look, found with plain rules a person can check.
 *
 *   no_category         spending left as "Other" or blank, so budgets and reports can't place it
 *   odd_amount          bigger than the app's own single-entry limit — almost always a typing slip
 *   odd_text            the title is only digits (or not text at all) — usually a mis-typed field
 *   possible_duplicate  another entry has the same day, amount and title
 *   future_date         dated more than a day ahead
 *
 * Own-account transfers and income are never flagged for category. Nothing here changes data; the user decides.
 */
import { MAX_TRANSACTION_AMOUNT } from "./currencyUtils";
import { normKey, safeText } from "./safeText";

export type ReviewReason = "odd_amount" | "odd_text" | "possible_duplicate" | "future_date" | "no_category";

export const REVIEW_REASON_TEXT: Record<ReviewReason, string> = {
  odd_amount: "Amount looks too large",
  odd_text: "Name is only numbers",
  possible_duplicate: "Looks like a duplicate",
  future_date: "Dated in the future",
  no_category: "No category yet",
};

type Row = { id: string; type: string; amount: number; date: string; title?: unknown; merchant?: unknown; category?: string; isTransfer?: boolean };
export type ReviewItem<T extends Row = Row> = { tx: T; reasons: ReviewReason[] };

const WEIGHT: Record<ReviewReason, number> = { odd_amount: 5, odd_text: 4, future_date: 3, possible_duplicate: 2, no_category: 1 };
const DIGITS_ONLY = /^[\d\s.,-]+$/;

export function needsReview<T extends Row>(txs: T[], { now = new Date(), dismissed = new Set<string>(), limit }: { now?: Date; dismissed?: Set<string>; limit?: number } = {}): Array<ReviewItem<T>> {
  const live = txs.filter((t) => !t.isTransfer && !dismissed.has(t.id));
  const keyOf = (t: T) => `${String(t.date).slice(0, 10)}|${Math.round(Math.abs(t.amount))}|${t.type}|${normKey(t.title)}`;
  const counts = new Map<string, number>();
  for (const t of live) counts.set(keyOf(t), (counts.get(keyOf(t)) ?? 0) + 1);

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59).getTime();
  const out: Array<ReviewItem<T>> = [];
  for (const t of live) {
    const reasons: ReviewReason[] = [];
    if (Math.abs(Number(t.amount)) > MAX_TRANSACTION_AMOUNT) reasons.push("odd_amount");
    const title = safeText(t.title).trim();
    if (typeof t.title !== "string" || (title !== "" && DIGITS_ONLY.test(title))) reasons.push("odd_text");
    if ((counts.get(keyOf(t)) ?? 0) > 1) reasons.push("possible_duplicate");
    const at = new Date(`${String(t.date).slice(0, 10)}T12:00:00`).getTime();
    if (Number.isFinite(at) && at > tomorrow) reasons.push("future_date");
    if (t.type === "expense" && (!t.category || /^(other|uncategori[sz]ed)$/i.test(t.category.trim()))) reasons.push("no_category");
    if (reasons.length) out.push({ tx: t, reasons });
  }
  out.sort((a, b) => Math.max(...b.reasons.map((r) => WEIGHT[r])) - Math.max(...a.reasons.map((r) => WEIGHT[r])));
  return limit ? out.slice(0, limit) : out;
}
