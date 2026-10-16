import { describe, expect, it } from "vitest";
import { monthEndOutlook } from "../src/app/lib/outlook";

const tx = (date: string, amount: number, extra: Record<string, unknown> = {}) => ({ type: "expense", amount: -Math.abs(amount), date, category: "Food", ...extra });

describe("monthEndOutlook", () => {
  const now = new Date(2026, 9, 16); // 16 Oct 2026 → 15 days left (31-day month)

  it("keeps committed bills separate from the everyday-spending estimate", () => {
    const txs = [tx("2026-10-02", 3000), tx("2026-10-09", 3200), tx("2026-10-05", 25_000, { category: "EMI", loanId: "l1" })];
    const o = monthEndOutlook({ txs, incomeSoFar: 100_000, committedLeft: 10_000, now });
    expect(o.daysLeft).toBe(15);
    expect(o.spentSoFar).toBe(31_200);
    expect(o.everydaySoFar).toBe(6_200);          // EMI is a commitment, not everyday spend
    expect(o.committedLeft).toBe(10_000);
  });

  it("gives a range between this month's pace and the last three months' average, never a single guess", () => {
    const txs = [
      tx("2026-10-03", 1600),                       // 1600 over 16 days → 100/day this month
      tx("2026-09-10", 6000),                       // Sept: 6000/30 = 200/day
      tx("2026-08-10", 3100),                       // Aug: 3100/31 = 100/day  → history avg 150/day
    ];
    const o = monthEndOutlook({ txs, incomeSoFar: 0, committedLeft: 0, now });
    expect(o.dailyLow).toBeCloseTo(100, 5);
    expect(o.dailyHigh).toBeCloseTo(150, 5);
    expect(o.everydayLow).toBeCloseTo(1500, 5);
    expect(o.everydayHigh).toBeCloseTo(2250, 5);
    expect(o.basis).toBe("both");
  });

  it("projected free = money in − spent − committed − everyday estimate, as a low/high pair", () => {
    const txs = [tx("2026-10-03", 1600), tx("2026-09-10", 6000), tx("2026-08-10", 3100)];
    const o = monthEndOutlook({ txs, incomeSoFar: 50_000, committedLeft: 5_000, now });
    expect(o.freeHigh).toBeCloseTo(50_000 - 1_600 - 5_000 - 1_500, 5);
    expect(o.freeLow).toBeCloseTo(50_000 - 1_600 - 5_000 - 2_250, 5);
    expect(o.freeLow).toBeLessThanOrEqual(o.freeHigh);
  });

  it("with no history says so and does not invent an estimate", () => {
    const o = monthEndOutlook({ txs: [], incomeSoFar: 40_000, committedLeft: 2_000, now: new Date(2026, 9, 3) });
    expect(o.basis).toBe("none");
    expect(o.everydayLow).toBe(0);
    expect(o.everydayHigh).toBe(0);
    expect(o.notes.join(" ")).toMatch(/not enough/i);
  });

  it("ignores a too-early pace (first days of the month) and falls back to history", () => {
    const txs = [tx("2026-10-01", 900), tx("2026-09-10", 3000)];
    const o = monthEndOutlook({ txs, incomeSoFar: 0, committedLeft: 0, now: new Date(2026, 9, 2) });
    expect(o.basis).toBe("history");
  });

  it("income and transfers never count as spending", () => {
    const txs = [{ type: "income", amount: 90_000, date: "2026-10-01", category: "Salary" }, tx("2026-10-04", 500, { isTransfer: true }), tx("2026-10-06", 700)];
    const o = monthEndOutlook({ txs, incomeSoFar: 90_000, committedLeft: 0, now });
    expect(o.spentSoFar).toBe(700);
  });
});

import { describeFreeRange } from "../src/app/lib/outlook";

describe("describeFreeRange", () => {
  it("positive range", () => expect(describeFreeRange(12_000, 18_500)).toBe("₹12,000 – ₹18,500 left"));
  it("collapses an identical low and high into one figure", () => expect(describeFreeRange(5_000, 5_000)).toBe("about ₹5,000 left"));
  it("fully short", () => expect(describeFreeRange(-9_000, -3_000)).toBe("short by ₹3,000 – ₹9,000"));
  it("straddling zero says so plainly", () => expect(describeFreeRange(-2_000, 4_000)).toBe("anywhere from ₹2,000 short to ₹4,000 left"));
});
