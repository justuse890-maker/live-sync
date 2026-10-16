/**
 * billSuggest.ts — after the user records an expense, decide whether to offer "remind me next time?" and what to
 * pre-fill. Pure functions; the sheet that shows the offer is components/ReminderOffer.tsx.
 */
import { addRepeat, emptyNote, isBill, Repeat } from "./notes";
import type { Note } from "./notes";
import { parseTime } from "./reminderPlan";

export type OfferInput = {
  type: string;
  amount: number;
  date: string; // YYYY-MM-DD, the day it was paid
  title?: string;
  merchant?: string;
  category?: string;
  isTransfer?: boolean;
  loanId?: string;
};

export type OfferDraft = { title: string; amount: number; category: string; paidOn: string; suggestedRepeat: Repeat };

const norm = (s: string | undefined) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Most recurring household payments are monthly; a few words say otherwise. */
export function suggestRepeat(category?: string, title?: string): Repeat {
  const s = `${category || ""} ${title || ""}`.toLowerCase();
  if (/\bdaily\b/.test(s)) return "daily";
  if (/\bweekly\b|\bevery week\b/.test(s)) return "weekly";
  if (/\b(yearly|annual|annually)\b/.test(s)) return "yearly";
  return "monthly";
}

/** Null when no offer should be made: not a spend, a transfer, a loan EMI (tracked in Loans), or already reminded. */
export function reminderOfferFor(tx: OfferInput, notes: Array<Pick<Note, "title" | "amount" | "category" | "archived" | "reminder">>): OfferDraft | null {
  if (tx.type !== "expense" || tx.isTransfer || tx.loanId) return null;
  const amount = Math.abs(Number(tx.amount) || 0);
  if (!(amount > 0)) return null;
  const category = (tx.category || "Other").trim() || "Other";
  const title = (tx.merchant || tx.title || category).trim();

  const t = norm(title);
  const already = notes.some((n) => {
    if (n.archived || !n.reminder || !isBill(n as Note)) return false;
    if (norm(n.title) === t) return true;
    return norm(n.category) === norm(category) && Math.abs((n.amount || 0) - amount) <= amount * 0.01;
  });
  if (already) return null;
  return { title, amount, category, paidOn: tx.date.slice(0, 10), suggestedRepeat: suggestRepeat(category, title) };
}

/** The first due date: one period after the payment, rolled forward if that is already past. */
export function firstDueDate(paidOn: string, repeat: Exclude<Repeat, "none">, time: string, now = new Date()): Date {
  const [y, m, d] = paidOn.split("-").map(Number);
  const { h, m: min } = parseTime(time);
  const day = d;
  let due = addRepeat(new Date(y, m - 1, d, h, min), repeat, day);
  for (let i = 0; i < 400 && due.getTime() <= now.getTime(); i++) due = addRepeat(due, repeat, day);
  return due;
}

export function noteFromOffer(
  draft: OfferDraft,
  choice: { repeat: Exclude<Repeat, "none">; leadDays: number; time: string },
  now = new Date(),
): Note {
  const due = firstDueDate(draft.paidOn, choice.repeat, choice.time, now);
  return emptyNote({
    title: draft.title,
    body: "Added from an expense you recorded.",
    amount: draft.amount,
    category: draft.category,
    dueDay: choice.repeat === "monthly" ? due.getDate() : undefined,
    reminder: { at: due.toISOString(), repeat: choice.repeat, leadDays: choice.leadDays, time: choice.time },
  });
}
