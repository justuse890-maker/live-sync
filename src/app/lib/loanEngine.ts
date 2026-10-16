/**
 * loanEngine.ts — pure logic for loan instalments: Pre-EMI vs full EMI and auto-debit.
 *
 * Pre-EMI (under-construction homes, staged disbursement): the bank has released only part of the loan
 * and the borrower pays INTEREST ONLY on the amount disbursed so far:  disbursed × annual rate ÷ 12.
 * It is not an EMI: no principal is repaid, the outstanding principal does not fall and "EMIs paid"
 * does not move. Once the loan is fully disbursed / possession is taken, the real EMI (principal + interest
 * on the full amount, over the full tenure) starts.
 *
 * Auto-debit: the bank pulls each instalment through an e-mandate (NACH/ECS). The app can't move money, so on each
 * due date it RECORDS what the bank debited — an expense on the linked account — keeping spending history right.
 */
import type { StructuredLoan, Tx } from "../store";

export type InstallmentKind = "pre_emi" | "emi";
export type Installment = { kind: InstallmentKind; amount: number };

export const MAX_CATCH_UP = 24; // never back-fill more than two years of missed debits in one go

export function calcEmi(principal: number, ratePA: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = ratePA / 12 / 100;
  if (r === 0) return Math.round(principal / months);
  const f = Math.pow(1 + r, months);
  return Math.round((principal * r * f) / (f - 1));
}

export function outstandingAfter(principal: number, ratePA: number, months: number, paid: number): number {
  const r = ratePA / 12 / 100;
  if (paid <= 0) return principal;
  if (r === 0) return Math.max(0, principal - (principal / months) * paid);
  const emi = calcEmi(principal, ratePA, months);
  const f = Math.pow(1 + r, paid);
  return Math.max(0, Math.round(principal * f - (emi * (f - 1)) / r));
}

export const isPreEmi = (loan: Pick<StructuredLoan, "phase">) => loan.phase === "pre_emi";

/** Interest-only instalment on the amount disbursed so far. */
export function preEmiAmount(disbursed: number, ratePA: number): number {
  return Math.max(0, Math.round((disbursed * ratePA) / 12 / 100));
}

/** What the next debit will be for this loan right now. */
export function currentInstallment(loan: StructuredLoan): Installment {
  if (isPreEmi(loan)) return { kind: "pre_emi", amount: preEmiAmount(loan.disbursedAmount ?? 0, loan.interestRatePA) };
  return { kind: "emi", amount: loan.emiAmount };
}

// ── dates (local calendar, YYYY-MM-DD) ──────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** Same day next month; keeps the original day (31st → 28th/29th → back to 31st) via `anchorDay`. */
export function nextMonthDue(iso: string, anchorDay?: number): string {
  const d = parse(iso) ?? new Date();
  const day = anchorDay ?? d.getDate();
  const first = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return toISO(new Date(first.getFullYear(), first.getMonth(), Math.min(day, last)));
}

/** Instalments that have fallen due on or before `todayISO` and should be auto-recorded. */
export function dueInstallments(loan: StructuredLoan, todayISO: string): Array<{ dueDate: string; kind: InstallmentKind; amount: number }> {
  if (!loan.autoDebit || loan.closed || !loan.nextEmiDueDate) return [];
  const out: Array<{ dueDate: string; kind: InstallmentKind; amount: number }> = [];
  let sim: StructuredLoan = { ...loan };
  for (let i = 0; i < MAX_CATCH_UP && sim.nextEmiDueDate && sim.nextEmiDueDate <= todayISO && !sim.closed; i++) {
    const inst = currentInstallment(sim);
    if (inst.amount <= 0) break;
    out.push({ dueDate: sim.nextEmiDueDate, ...inst });
    sim = applyInstallment(sim, inst.kind);
  }
  return out;
}

/** Loan state after one instalment has been paid. */
export function applyInstallment(loan: StructuredLoan, kind: InstallmentKind): StructuredLoan {
  const nextDue = nextMonthDue(loan.nextEmiDueDate, loan.emiDay);
  if (kind === "pre_emi") {
    const switchToEmi = !!loan.fullEmiStartDate && nextDue >= loan.fullEmiStartDate;
    return {
      ...loan,
      nextEmiDueDate: nextDue,
      preEmiPaidTotal: (loan.preEmiPaidTotal ?? 0) + preEmiAmount(loan.disbursedAmount ?? 0, loan.interestRatePA),
      phase: switchToEmi ? "emi" : "pre_emi",
      // principal untouched while only interest is being paid
      outstandingPrincipal: loan.disbursedAmount ?? loan.outstandingPrincipal,
    };
  }
  const paid = Math.min(loan.emisPaid + 1, loan.totalEmis);
  return {
    ...loan,
    emisPaid: paid,
    outstandingPrincipal: outstandingAfter(loan.principalAmount, loan.interestRatePA, loan.tenureMonths, paid),
    nextEmiDueDate: nextDue,
    closed: paid >= loan.totalEmis,
  };
}

const KIND_LABEL: Record<InstallmentKind, string> = { pre_emi: "Pre-EMI (interest only)", emi: "EMI" };

/** The expense transaction that mirrors a bank debit. Expenses are stored negative in this app. */
export function buildInstallmentTx(
  loan: StructuredLoan,
  due: { dueDate: string; kind: InstallmentKind; amount: number },
  opts: { auto: boolean },
): Omit<Tx, "id"> {
  return {
    date: due.dueDate,
    title: `${loan.lenderName} ${KIND_LABEL[due.kind]}`,
    merchant: loan.lenderName,
    amount: -Math.abs(due.amount),
    type: "expense",
    category: "EMI",
    payments: [{ mode: "debit", amount: Math.abs(due.amount) }],
    accountId: loan.autoDebitBankAccountId || undefined,
    loanId: loan.id,
    loanPaymentType: due.kind,
    autoDebited: opts.auto || undefined,
    notes: opts.auto
      ? `Auto-debit recorded on the due date. ${due.kind === "pre_emi" ? "Interest only — principal is not reduced." : ""}`.trim()
      : undefined,
  };
}

/** True when a debit for this loan on this due date is already in the ledger (makes auto-recording idempotent). */
export function alreadyRecorded(transactions: Pick<Tx, "loanId" | "date" | "loanPaymentType">[], loanId: string, dueDate: string): boolean {
  return transactions.some((t) => t.loanId === loanId && t.date === dueDate && t.loanPaymentType !== "prepayment");
}
