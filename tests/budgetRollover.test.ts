import { describe, expect, it } from "vitest";
import { budgetView, rolloverCarry } from "../src/app/lib/budgetRollover";

describe("rolloverCarry", () => {
  it("carries last month's unspent amount", () => {
    expect(rolloverCarry([{ limit: 5000, spent: 3000 }])).toBe(2000);
  });

  it("compounds across consecutive underspent months", () => {
    // m1: 5000-3000=2000 ; m2: 5000+2000-4000=3000
    expect(rolloverCarry([{ limit: 5000, spent: 3000 }, { limit: 5000, spent: 4000 }])).toBe(3000);
  });

  it("overspending never goes negative and clears the surplus", () => {
    expect(rolloverCarry([{ limit: 5000, spent: 2000 }, { limit: 5000, spent: 9000 }])).toBe(0);
  });

  it("a month with no budget resets the carry", () => {
    expect(rolloverCarry([{ limit: 5000, spent: 1000 }, { limit: null, spent: 0 }, { limit: 5000, spent: 4000 }])).toBe(1000);
  });

  it("only looks back six months", () => {
    const old = { limit: 10_000, spent: 0 };
    const recent = Array.from({ length: 6 }, () => ({ limit: 1000, spent: 1000 }));
    expect(rolloverCarry([old, ...recent])).toBe(0);
  });

  it("empty history carries nothing", () => {
    expect(rolloverCarry([])).toBe(0);
  });
});

describe("budgetView", () => {
  it("adds the carry to the limit and measures spend against it", () => {
    expect(budgetView(5000, 4000, 2000)).toEqual({ effectiveLimit: 7000, carry: 2000, remaining: 3000, pct: (4000 / 7000) * 100 });
  });
  it("zero limit and carry is safe", () => {
    expect(budgetView(0, 100, 0).pct).toBe(0);
  });
});
