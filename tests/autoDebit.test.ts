import { describe, expect, it } from "vitest";
import { autoDebitNotices } from "../src/app/lib/autoDebit";
import type { Obligation } from "../src/app/lib/obligations";

const now = new Date(2026, 9, 16, 10, 0, 0);
const ob = (over: Partial<Obligation>): Obligation => ({ id: "x", source: "subscription", title: "Netflix", amount: 649, dueAt: new Date(2026, 9, 17, 9, 0, 0), overdue: false, screen: "subscriptions", ...over });

describe("autoDebitNotices", () => {
  it("lists payments that may be auto-debited in the next three days with merchant, amount, date and how to stop it", () => {
    const [n] = autoDebitNotices([ob({})], now);
    expect(n.title).toMatch(/Netflix/);
    expect(n.amountText).toBe("₹649");
    expect(n.whenText).toMatch(/tomorrow/i);
    expect(n.stopHint).toMatch(/AutoPay|mandate/i);
    expect(n.body).toMatch(/24 hours/);
  });
  it("only covers things that can be a mandate: subscriptions, EMIs and insurance premiums", () => {
    const list = autoDebitNotices([ob({ id: "s" }), ob({ id: "e", source: "emi", title: "HDFC EMI" }), ob({ id: "i", source: "insurance", title: "LIC" }), ob({ id: "n", source: "note" }), ob({ id: "c", source: "card" }), ob({ id: "h", source: "household" })], now);
    expect(list.map((n) => n.id).sort()).toEqual(["e", "i", "s"]);
  });
  it("ignores anything further than three days away, already overdue, or without an amount", () => {
    const far = ob({ id: "far", dueAt: new Date(2026, 9, 25) });
    const late = ob({ id: "late", overdue: true, dueAt: new Date(2026, 9, 14) });
    const none = ob({ id: "none", amount: undefined });
    expect(autoDebitNotices([far, late, none], now)).toEqual([]);
  });
  it("never claims the payment IS an auto-debit; it says 'if'", () => {
    const [n] = autoDebitNotices([ob({})], now);
    expect(n.body).toMatch(/\bif\b/i);
  });
  it("sorts by date then amount, soonest first", () => {
    const a = ob({ id: "a", dueAt: new Date(2026, 9, 18, 9), amount: 100 });
    const b = ob({ id: "b", dueAt: new Date(2026, 9, 17, 9), amount: 50 });
    expect(autoDebitNotices([a, b], now).map((n) => n.id)).toEqual(["b", "a"]);
  });
  it("the stop hint differs by what is being paid, and an EMI hint warns that stopping the mandate does not cancel the loan", () => {
    const e = autoDebitNotices([ob({ source: "emi", title: "HDFC EMI" })], now)[0];
    expect(e.stopHint).toMatch(/does not cancel the loan|doesn't cancel the loan/i);
  });
});
