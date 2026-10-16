/**
 * txKind.ts — what KIND of money movement a ledger row is, shown as a small badge so users can see why a row does or
 * does not move their totals.
 *
 *   transfer   own-account move: never income, never spending (see transfers.ts)
 *   card_bill  paying a credit-card bill; the purchases themselves were the spending
 *   income     money in
 *   spend      everything else (no badge, it is the default)
 *
 * card_bill is recognised from the category or title only. It is informational: this file does not change any total,
 * so the badge never claims a row is "not counted" unless it really is a transfer.
 */
export type TxKind = "transfer" | "card_bill" | "income" | "spend";

type Row = { type: string; category?: string; title?: string; merchant?: string; isTransfer?: boolean; creditCardId?: string };

const CARD_BILL = /\b(credit card (bill|payment)|card bill|cc bill|card payment)\b/i;

export function txKind(t: Row): TxKind {
  if (t.isTransfer) return "transfer";
  if (t.type === "income") return "income";
  if (!t.creditCardId && (CARD_BILL.test(t.category || "") || CARD_BILL.test(t.title || "") || CARD_BILL.test(t.merchant || ""))) return "card_bill";
  return "spend";
}

export const KIND_BADGE: Record<TxKind, { label: string; hint: string; icon: string } | null> = {
  transfer: { label: "Transfer", hint: "Your own money moving between accounts. Not counted as income or spending.", icon: "arrow-right-left" },
  card_bill: { label: "Card bill", hint: "Paying a credit-card bill. The card purchases are your spending.", icon: "credit-card" },
  income: { label: "Income", hint: "Money in.", icon: "arrow-down-left" },
  spend: null,
};
