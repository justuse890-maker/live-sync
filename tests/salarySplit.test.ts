import { describe, expect, it } from "vitest";
import { planSalarySplit, suggestedSalary } from "../src/app/lib/salarySplit";

const b = (id: string, allocPct?: number) => ({ id, name: id, allocPct });

describe("planSalarySplit", () => {
  it("splits by percentage and reports the unallocated rest", () => {
    const p = planSalarySplit(120_000, [b("rent", 30), b("sip", 20), b("fun", 15), b("none")]);
    expect(p.problem).toBeNull();
    expect(p.rows.map((r) => r.amount)).toEqual([36_000, 24_000, 18_000]);
    expect(p.allocatedPct).toBe(65);
    expect(p.unallocated).toBe(42_000);
  });

  it("whole rupees always add up exactly (largest remainder)", () => {
    const p = planSalarySplit(100, [b("a", 33.34), b("b", 33.33), b("c", 33.33)]);
    expect(p.rows.reduce((s, r) => s + r.amount, 0)).toBe(100);
    expect(p.unallocated).toBe(0);
  });

  it("never creates money: rows + unallocated equals the salary", () => {
    const p = planSalarySplit(99_999, [b("a", 12.5), b("b", 7.25), b("c", 40)]);
    expect(p.allocatedAmount + p.unallocated).toBe(99_999);
  });

  it("rejects totals over 100%", () => {
    const p = planSalarySplit(50_000, [b("a", 70), b("b", 40)]);
    expect(p.problem).toBe("over_100");
    expect(p.rows).toEqual([]);
    expect(p.unallocated).toBe(50_000);
  });

  it("explains an unusable plan instead of guessing", () => {
    expect(planSalarySplit(0, [b("a", 10)]).problem).toBe("no_salary");
    expect(planSalarySplit(10_000, [b("a")]).problem).toBe("no_allocations");
  });

  it("exactly 100% leaves nothing unallocated", () => {
    const p = planSalarySplit(75_000, [b("a", 60), b("b", 40)]);
    expect(p.unallocated).toBe(0);
    expect(p.rows.map((r) => r.amount)).toEqual([45_000, 30_000]);
  });
});

describe("suggestedSalary", () => {
  const txs = [
    { type: "income", amount: 120_000, date: "2026-10-01", category: "Salary" },
    { type: "income", amount: 5_000, date: "2026-10-03", title: "Salary arrears" },
    { type: "income", amount: 900_000, date: "2026-10-02", category: "Other", title: "Gift" },
    { type: "income", amount: 70_000, date: "2026-09-01", category: "Salary" },
    { type: "income", amount: 120_000, date: "2026-10-04", category: "Salary", isTransfer: true },
  ];
  it("picks the largest salary-like credit in that month, ignoring transfers and non-salary", () => {
    expect(suggestedSalary(txs, "2026-10")).toBe(120_000);
  });
  it("returns null when no salary was recorded", () => {
    expect(suggestedSalary(txs, "2026-08")).toBeNull();
  });
});
