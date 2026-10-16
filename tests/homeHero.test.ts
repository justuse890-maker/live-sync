import { describe, expect, it } from "vitest";
import { buildHero } from "../src/app/lib/homeHero";

describe("buildHero", () => {
  it("free = money in − spent − still to pay", () => {
    const h = buildHero({ income: 120_000, expense: 40_000, dueAmounts: [25_000, 5_000], isCurrentMonth: true });
    expect(h).toMatchObject({ moneyIn: 120_000, spent: 40_000, stillToPay: 30_000, free: 50_000, overcommitted: false });
    expect(Math.round(h.spentPct + h.duePct + h.freePct)).toBe(100);
  });

  it("past months have nothing still to pay", () => {
    const h = buildHero({ income: 100_000, expense: 60_000, dueAmounts: [10_000], isCurrentMonth: false });
    expect(h.stillToPay).toBe(0);
    expect(h.free).toBe(40_000);
  });

  it("flags overcommitment and keeps the bar within 100%", () => {
    const h = buildHero({ income: 50_000, expense: 45_000, dueAmounts: [20_000], isCurrentMonth: true });
    expect(h.free).toBe(-15_000);
    expect(h.overcommitted).toBe(true);
    expect(h.spentPct + h.duePct + h.freePct).toBeLessThanOrEqual(100.0001);
    expect(h.freePct).toBe(0);
  });

  it("no income recorded: no division by zero, bar empty", () => {
    const h = buildHero({ income: 0, expense: 5_000, dueAmounts: [], isCurrentMonth: true });
    expect(h).toMatchObject({ spentPct: 0, duePct: 0, freePct: 0 });
    expect(h.free).toBe(-5_000);
  });

  it("ignores negative / junk due amounts", () => {
    expect(buildHero({ income: 10_000, expense: 0, dueAmounts: [-500, 0, 1_000], isCurrentMonth: true }).stillToPay).toBe(1_000);
  });
});
