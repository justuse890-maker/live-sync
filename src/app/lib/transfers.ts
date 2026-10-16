/**
 * transfers.ts — money that moves between the user's OWN accounts is neither income nor expense.
 *
 * Model: a transfer is stored as two ordinary ledger rows that share a `transferId`:
 *   • the "out" leg (type "expense") on the source account
 *   • the "in" leg  (type "income")  on the destination account
 * Both are flagged `isTransfer`. Account balances still see both legs; every income / expense /
 * savings-rate / budget computation uses `countable()` and therefore ignores them.
 *
 * No PAN, name matching or SMS is involved — we only match on amount, date window and the
 * accounts the user themselves has recorded.
 */

export type TransferFields = {
  isTransfer?: boolean;
  transferId?: string;
  transferRole?: "out" | "in";
  /** Category the row had before it was turned into a transfer, so Undo restores it. */
  categoryBeforeTransfer?: string;
};

type TxLike = {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense";
  date: string; // YYYY-MM-DD
  category?: string;
  accountId?: string;
  loanId?: string;
  creditCardId?: string;
} & TransferFields;

export const TRANSFER_CATEGORY = "Transfer";

export const isTransfer = (t: Pick<TransferFields, "isTransfer">): boolean => t.isTransfer === true;

/** Rows that count towards income, expense, savings rate, budgets, reports. */
export function countable<T extends TransferFields>(txs: T[]): T[] {
  return txs.filter((t) => !isTransfer(t));
}

const SELF_RX = /\b(self[\s-]?transfer|own\s+(a\/?c|account)|to\s+self|from\s+self|transfer\s+(to|from)\s+(my\s+)?(savings|salary|current|wallet|account)|a\/?c\s+to\s+a\/?c|internal\s+transfer|wallet\s+(top[\s-]?up|load))\b/i;

/** Wording that strongly suggests the user moved money between their own accounts. */
export function looksLikeSelfTransfer(text: string | undefined): boolean {
  return !!text && SELF_RX.test(text);
}

const DAY = 86_400_000;
const dayNum = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY);
const cents = (n: number) => Math.round(Math.abs(n) * 100);

export type TransferSuggestion = {
  outId: string;
  inId: string;
  amount: number;
  /** "certain": two different recorded accounts. "likely": wording hints at a self-transfer. */
  confidence: "certain" | "likely";
  dayGap: number;
};

/**
 * Finds expense/income rows that look like the two halves of one own-account transfer.
 * One-to-one, closest date first, never touches rows that are already transfers, loan payments
 * or credit-card rows. It only SUGGESTS — the caller decides whether to apply.
 */
export function suggestTransferPairs(txs: TxLike[], opts: { windowDays?: number } = {}): TransferSuggestion[] {
  const windowDays = opts.windowDays ?? 2;
  const eligible = txs.filter((t) => !isTransfer(t) && !t.loanId && !t.creditCardId && cents(t.amount) > 0);
  const outs = eligible.filter((t) => t.type === "expense");
  const ins = eligible.filter((t) => t.type === "income");

  const candidates: Array<TransferSuggestion & { rank: number }> = [];
  for (const o of outs) {
    for (const i of ins) {
      if (cents(o.amount) !== cents(i.amount)) continue;
      const gap = Math.abs(dayNum(o.date) - dayNum(i.date));
      if (gap > windowDays) continue;
      const bothAccounts = !!o.accountId && !!i.accountId;
      if (bothAccounts && o.accountId === i.accountId) continue; // same account can't pair with itself
      const hint = looksLikeSelfTransfer(o.title) || looksLikeSelfTransfer(i.title);
      let confidence: TransferSuggestion["confidence"] | null = null;
      if (bothAccounts) confidence = "certain";
      else if (hint) confidence = "likely";
      if (!confidence) continue; // equal amounts alone are NOT enough — a salary and a rent can match
      candidates.push({ outId: o.id, inId: i.id, amount: Math.abs(o.amount), confidence, dayGap: gap, rank: gap * 10 + (confidence === "certain" ? 0 : 5) });
    }
  }
  candidates.sort((a, b) => a.rank - b.rank);
  const usedOut = new Set<string>();
  const usedIn = new Set<string>();
  const result: TransferSuggestion[] = [];
  for (const c of candidates) {
    if (usedOut.has(c.outId) || usedIn.has(c.inId)) continue;
    usedOut.add(c.outId);
    usedIn.add(c.inId);
    const { rank: _rank, ...s } = c;
    result.push(s);
  }
  return result;
}

/** Builds the two ledger rows for a transfer the user records directly. */
export function buildTransferLegs(input: {
  transferId: string;
  amount: number;
  date: string;
  fromAccountId?: string;
  toAccountId?: string;
  fromLabel?: string;
  toLabel?: string;
  note?: string;
}): { out: Omit<TxLike, "id">; in: Omit<TxLike, "id"> } {
  const amount = Math.abs(input.amount);
  const base = { date: input.date, category: TRANSFER_CATEGORY, isTransfer: true as const, transferId: input.transferId };
  // Same sign convention as the rest of the ledger: money out is negative, money in is positive.
  return {
    out: { ...base, amount: -amount, title: `Transfer to ${input.toLabel || "own account"}`, type: "expense", accountId: input.fromAccountId, transferRole: "out" },
    in: { ...base, amount, title: `Transfer from ${input.fromLabel || "own account"}`, type: "income", accountId: input.toAccountId, transferRole: "in" },
  };
}

/** Marks (or unmarks) a matched pair as a transfer. Returns new rows; does not mutate. */
export function applyTransferPair<T extends TxLike>(out: T, inn: T, transferId: string): [T, T] {
  return [
    { ...out, isTransfer: true, transferId, transferRole: "out", categoryBeforeTransfer: out.category, category: TRANSFER_CATEGORY },
    { ...inn, isTransfer: true, transferId, transferRole: "in", categoryBeforeTransfer: inn.category, category: TRANSFER_CATEGORY },
  ];
}

/** Reverts a transfer row to a normal one, restoring the category it had before (else `fallback`). */
export function clearTransfer<T extends TxLike>(t: T, fallback = "Other"): T {
  const { isTransfer: _a, transferId: _b, transferRole: _c, categoryBeforeTransfer, ...rest } = t;
  return { ...(rest as T), category: categoryBeforeTransfer || fallback };
}

/** Money that left and arrived in a period without counting — for the "why isn't this counted?" sheet. */
export function transferTotals(txs: Array<Pick<TxLike, "amount" | "isTransfer" | "transferRole">>) {
  let moved = 0;
  let count = 0;
  for (const t of txs) {
    if (!isTransfer(t) || t.transferRole === "in") continue;
    moved += Math.abs(t.amount);
    count++;
  }
  return { moved, count };
}
