import { describe, expect, it } from "vitest";
import {
  alreadyRecorded, applyInstallment, buildInstallmentTx, calcEmi, currentInstallment, dueInstallments, nextMonthDue, preEmiAmount,
} from "../src/app/lib/loanEngine";
import type { StructuredLoan } from "../src/app/store";

const base: StructuredLoan = {
  id: "L1", loanType: "home_loan", lenderName: "HDFC", principalAmount: 5_000_000, outstandingPrincipal: 1_000_000,
  interestRatePA: 9, tenureMonths: 240, emiAmount: calcEmi(5_000_000, 9, 240), disbursementDate: "2026-06-01",
  nextEmiDueDate: "2026-09-05", emisPaid: 0, totalEmis: 240, isRegistrationLoan: false,
};
const preEmi: StructuredLoan = { ...base, phase: "pre_emi", disbursedAmount: 1_000_000, autoDebit: true, autoDebitBankAccountId: "acc1" };

describe("Pre-EMI vs EMI", () => {
  it("pre-EMI is interest only on the amount disbursed", () => {
    expect(preEmiAmount(1_000_000, 9)).toBe(7500);
    expect(currentInstallment(preEmi)).toEqual({ kind: "pre_emi", amount: 7500 });
  });
  it("regular EMI uses the full EMI", () => {
    expect(currentInstallment(base)).toEqual({ kind: "emi", amount: base.emiAmount });
    expect(base.emiAmount).toBeGreaterThan(40000); // ₹50L @9% / 20y ≈ ₹44.9k
  });
  it("paying a pre-EMI does not count as an EMI or reduce principal", () => {
    const after = applyInstallment(preEmi, "pre_emi");
    expect(after.emisPaid).toBe(0);
    expect(after.outstandingPrincipal).toBe(1_000_000);
    expect(after.preEmiPaidTotal).toBe(7500);
    expect(after.nextEmiDueDate).toBe("2026-10-05");
    expect(after.phase).toBe("pre_emi");
  });
  it("switches to full EMI once the start date is reached", () => {
    const l = { ...preEmi, nextEmiDueDate: "2026-11-05", fullEmiStartDate: "2026-12-05" };
    // paying the Nov pre-EMI makes Dec 5 the next due date — that one is the first full EMI
    expect(applyInstallment(l, "pre_emi").phase).toBe("emi");
    expect(applyInstallment({ ...l, nextEmiDueDate: "2026-10-05" }, "pre_emi").phase).toBe("pre_emi");
  });
  it("a real EMI advances count, principal and due date, and closes at the last one", () => {
    const after = applyInstallment(base, "emi");
    expect(after.emisPaid).toBe(1);
    expect(after.outstandingPrincipal).toBeLessThan(base.principalAmount);
    expect(applyInstallment({ ...base, emisPaid: 239 }, "emi").closed).toBe(true);
  });
});

describe("auto-debit scheduling", () => {
  it("does nothing when off, closed, or not yet due", () => {
    expect(dueInstallments({ ...preEmi, autoDebit: false }, "2026-10-09")).toEqual([]);
    expect(dueInstallments({ ...preEmi, closed: true }, "2026-10-09")).toEqual([]);
    expect(dueInstallments(preEmi, "2026-09-04")).toEqual([]);
  });
  it("records the instalment due today", () => {
    const due = dueInstallments(preEmi, "2026-09-05");
    expect(due).toEqual([{ dueDate: "2026-09-05", kind: "pre_emi", amount: 7500 }]);
  });
  it("back-fills every missed month while the app was closed", () => {
    const due = dueInstallments(preEmi, "2026-11-20");
    expect(due.map((d) => d.dueDate)).toEqual(["2026-09-05", "2026-10-05", "2026-11-05"]);
  });
  it("switches kind mid back-fill when the full EMI start passes", () => {
    const l = { ...preEmi, fullEmiStartDate: "2026-11-05" };
    const due = dueInstallments(l, "2026-11-20");
    expect(due.map((d) => d.kind)).toEqual(["pre_emi", "pre_emi", "emi"]);
    expect(due[2].amount).toBe(base.emiAmount);
  });
  it("never back-fills more than 24 months", () => {
    expect(dueInstallments(preEmi, "2036-01-01").length).toBe(24);
  });
  it("keeps the 31st anchor across short months", () => {
    expect(nextMonthDue("2026-01-31")).toBe("2026-02-28");
    expect(nextMonthDue("2026-02-28", 31)).toBe("2026-03-31");
  });
});

describe("expense entry", () => {
  it("is a negative expense on the linked account, marked as auto-debited", () => {
    const tx = buildInstallmentTx(preEmi, { dueDate: "2026-09-05", kind: "pre_emi", amount: 7500 }, { auto: true });
    expect(tx).toMatchObject({ amount: -7500, type: "expense", category: "EMI", accountId: "acc1", loanId: "L1", loanPaymentType: "pre_emi", autoDebited: true, date: "2026-09-05" });
    expect(tx.title).toContain("Pre-EMI");
  });
  it("is idempotent: an already-recorded due date is detected", () => {
    const ledger = [{ loanId: "L1", date: "2026-09-05", loanPaymentType: "pre_emi" as const }];
    expect(alreadyRecorded(ledger, "L1", "2026-09-05")).toBe(true);
    expect(alreadyRecorded(ledger, "L1", "2026-10-05")).toBe(false);
    expect(alreadyRecorded(ledger, "L2", "2026-09-05")).toBe(false);
  });
});
