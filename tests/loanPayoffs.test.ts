import { describe, expect, it } from "vitest";
import { loanPayoffs } from "../src/app/lib/emiPlanner";

const now = new Date(2026, 9, 16);
const loan = (over: Record<string, unknown> = {}) => ({ id: "l1", lenderName: "HDFC Home", emiAmount: 20_000, emisPaid: 10, totalEmis: 24, nextEmiDueDate: "2026-11-05", ...over });

describe("loanPayoffs", () => {
  it("counts remaining EMIs and dates the last one from the next due date", () => {
    const [p] = loanPayoffs([loan()], now);
    expect(p.remaining).toBe(14);
    expect(p.lastEmiMonth).toBe("2027-12");      // Nov 2026 is #1 of 14 → Dec 2027 is #14
    expect(p.totalLeft).toBe(14 * 20_000);
  });
  it("falls back to counting from this month when no due date is stored", () => {
    const [p] = loanPayoffs([loan({ nextEmiDueDate: undefined })], now);
    expect(p.lastEmiMonth).toBe("2027-11");      // Oct 2026 is #1 of 14
  });
  it("skips closed and fully paid loans, and orders by soonest payoff", () => {
    const list = loanPayoffs([loan({ id: "a", closed: true }), loan({ id: "b", emisPaid: 24 }), loan({ id: "c", totalEmis: 14 }), loan({ id: "d" })], now);
    expect(list.map((x) => x.loanId)).toEqual(["c", "d"]);
  });
  it("pre-EMI loans are shown as interest-only with no end date", () => {
    const [p] = loanPayoffs([loan({ phase: "pre_emi", totalEmis: 0, emisPaid: 0 })], now);
    expect(p.preEmi).toBe(true);
    expect(p.lastEmiMonth).toBeNull();
  });
  it("the total of all remaining EMIs is exact, with no rate assumptions", () => {
    const a = loanPayoffs([loan({ id: "a" }), loan({ id: "b", emiAmount: 5_000, totalEmis: 12, emisPaid: 6 })], now);
    expect(a.reduce((s, x) => s + x.totalLeft, 0)).toBe(14 * 20_000 + 6 * 5_000);
  });
});
