import { describe, expect, it } from "vitest";
import { buildLens, statementsAsText } from "../src/app/lib/caLens";
import { fyFromStartYear } from "../src/app/lib/fy";

const t = (o: any) => ({ id: Math.random().toString(36), type: "expense", amount: 1000, date: "2026-10-05", category: "Other", title: "x", ...o });
const input = (over: any = {}) => ({
  fy: fyFromStartYear(2026), today: "2026-10-10",
  transactions: [
    t({ type: "income", amount: 100_000, date: "2026-08-01", category: "Salary", title: "Salary" }),
    t({ type: "income", amount: 100_000, date: "2026-09-01", category: "Salary", title: "Salary" }),
    t({ amount: 30_000, category: "Rent", title: "Rent", date: "2026-09-02" }),
    t({ amount: 5_000, category: "Food", date: "2026-10-03" }),
    t({ amount: 20_000, category: "SIP", title: "SIP", date: "2026-09-05" }),
    t({ amount: 9_999, title: "LIC premium", date: "2026-09-06", category: "Insurance" }),
    t({ amount: 1_000, title: "Future entry", date: "2027-01-05" }),   // beyond today — outside the statement window
  ],
  assetLines: [{ label: "FD", detail: "Fixed Deposit", value: 300_000 }],
  liabilityLines: [{ label: "SBI", detail: "home loan", value: 100_000 }],
  liquidAssets: 300_000, monthlyEmi: 0, lifeCover: 0, persona: "salaried", ...over,
});

describe("buildLens", () => {
  const l = buildLens(input());

  it("cuts the statement window at today", () => {
    expect(l.range).toEqual({ from: "2026-04-01", to: "2026-10-10" });
    expect(l.ie.income.total).toBe(200_000);
    expect(l.ie.needs.total + l.ie.wants.total + l.ie.savings.total + l.ie.debtService.total).toBe(30_000 + 5_000 + 20_000 + 9_999);
  });

  it("only months up to today appear in the series, and data months are counted", () => {
    expect(l.series.map((m) => m.key)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(l.monthsWithData).toBe(3);
  });

  it("past the end of the year the whole year is shown", () => {
    const full = buildLens(input({ today: "2027-06-01" }));
    expect(full.range.to).toBe("2027-03-31");
    expect(full.series).toHaveLength(12);
  });

  it("carries ratios, deadlines and tax suggestions", () => {
    expect(l.ratios).toHaveLength(8);
    expect(l.deadlines[0].date).toBe("2026-12-15");
    expect(l.taxSuggestions.map((s) => s.tag).sort()).toEqual(["80C", "HRA"]);
    expect(l.hasData).toBe(true);
  });

  it("an empty book says so and invents nothing", () => {
    const e = buildLens(input({ transactions: [], assetLines: [], liabilityLines: [], liquidAssets: 0 }));
    expect(e.hasData).toBe(false);
    expect(e.ratioSummary.scored).toBe(0);
  });
});

describe("statementsAsText", () => {
  it("contains the key totals and the 'not audited' disclaimer", () => {
    const l = buildLens(input());
    const text = statementsAsText(l, (n) => `₹${Math.round(n)}`);
    expect(text).toContain("FY 2026-27");
    expect(text).toContain("Not audited");
    expect(text).toContain("SURPLUS");
    expect(text).toContain("NET WORTH");
    expect(text).toContain("₹200000");
  });
});
