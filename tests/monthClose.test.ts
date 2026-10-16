import { describe, expect, it } from "vitest";
import { buildChecklist, closedStreak, driftSince, makeCloseRecord, openItems } from "../src/app/lib/monthClose";

const tx = (o: any) => ({ id: Math.random().toString(36), type: "expense", amount: 100, date: "2026-09-10", category: "Food", ...o });
const base = { month: "2026-09", transferSuggestions: [], loans: [], overBudgetCount: 0 };
const get = (items: ReturnType<typeof buildChecklist>, id: string) => items.find((x) => x.id === id)!;

describe("buildChecklist", () => {
  it("a tidy month has nothing open", () => {
    const items = buildChecklist({ ...base, transactions: [tx({ type: "income", category: "Salary" }), tx({})] });
    expect(openItems(items)).toEqual([]);
  });

  it("flags missing income and uncategorised expenses (this month only, transfers ignored)", () => {
    const items = buildChecklist({ ...base, transactions: [
      tx({ category: "Other" }), tx({ category: "" }), tx({ category: "Other", isTransfer: true }), tx({ category: "Other", date: "2026-08-10" }),
    ] });
    expect(get(items, "income").count).toBe(1);
    expect(get(items, "uncategorised").count).toBe(2);
  });

  it("counts only transfer suggestions that touch this month", () => {
    const a = tx({ id: "a" }), b = tx({ id: "b", type: "income" }), c = tx({ id: "c", date: "2026-07-01" }), d = tx({ id: "d", type: "income", date: "2026-07-01" });
    const items = buildChecklist({ ...base, transactions: [a, b, c, d], transferSuggestions: [{ outId: "a", inId: "b" }, { outId: "c", inId: "d" }] });
    expect(get(items, "transfers").count).toBe(1);
  });

  it("flags a started, open loan with no instalment that month — but not closed, future, or paid ones", () => {
    const items = buildChecklist({ ...base, transactions: [tx({ loanId: "paid" })], loans: [
      { id: "paid", lenderName: "A" }, { id: "miss", lenderName: "B" },
      { id: "closed", lenderName: "C", closed: true }, { id: "future", lenderName: "D", disbursementDate: "2026-10-05" },
    ] });
    expect(get(items, "loans").count).toBe(1);
    expect(get(items, "loans").detail).toMatch(/B/);
  });

  it("reports over-budget count", () => {
    expect(get(buildChecklist({ ...base, transactions: [], overBudgetCount: 2 }), "budgets").count).toBe(2);
  });
});

describe("close record and drift", () => {
  const rec = makeCloseRecord("2026-09", { income: 100_000.4, expense: 60_000, entries: 20 }, new Date("2026-10-01T00:00:00Z"));

  it("rounds the figures it stores", () => {
    expect(rec).toMatchObject({ month: "2026-09", income: 100_000, expense: 60_000, entries: 20 });
  });

  it("no drift when nothing changed", () => {
    expect(driftSince(rec, { income: 100_000, expense: 60_000, entries: 20 })).toBeNull();
  });

  it("reports what changed since closing", () => {
    expect(driftSince(rec, { income: 100_000, expense: 62_500, entries: 22 })).toEqual({ income: 0, expense: 2_500, entries: 2 });
  });
});

describe("closedStreak", () => {
  it("counts consecutive closed months before the current one", () => {
    expect(closedStreak(["2026-09", "2026-08", "2026-07", "2026-05"], "2026-10")).toBe(3);
  });
  it("crosses the year boundary and is zero when last month is open", () => {
    expect(closedStreak(["2026-12", "2026-11"], "2027-01")).toBe(2);
    expect(closedStreak(["2026-08"], "2026-10")).toBe(0);
  });
});
