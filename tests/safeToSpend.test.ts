import { describe, expect, it } from "vitest";
import { buildHero } from "../src/app/lib/homeHero";
import { safeToSpendBreakdown } from "../src/app/lib/safeToSpend";

const hero = (income: number, expense: number, due: number[]) => buildHero({ income, expense, dueAmounts: due, isCurrentMonth: true });

describe("safeToSpendBreakdown", () => {
  it("lines add up to the hero's free figure", () => {
    const items = [{ title: "Home loan EMI", amount: 25_000, overdue: false }, { title: "Netflix", amount: 649, overdue: false }];
    const b = safeToSpendBreakdown({ hero: hero(100_000, 30_000, [25_000, 649]), dueItems: items, isCurrentMonth: true });
    expect(b.result).toBe(100_000 - 30_000 - 25_649);
    const signed = b.lines.reduce((s, l) => s + (l.kind === "plus" ? l.amount : -l.amount), 0);
    expect(signed).toBe(b.result);
  });

  it("lists each priced due item and names the unpriced ones instead of silently ignoring them", () => {
    const items = [{ title: "HDFC card bill", overdue: false }, { title: "Rent", amount: 20_000, overdue: true }];
    const b = safeToSpendBreakdown({ hero: hero(80_000, 10_000, [20_000]), dueItems: items, isCurrentMonth: true });
    expect(b.dueLines.map((l) => l.label)).toEqual(["Rent"]);
    expect(b.unpriced).toEqual(["HDFC card bill"]);
    expect(b.notes.join(" ")).toMatch(/HDFC card bill/);
    expect(b.notes.join(" ")).toMatch(/no amount/i);
  });

  it("always says unreceived salary is not counted for the current month", () => {
    const b = safeToSpendBreakdown({ hero: hero(0, 5_000, []), dueItems: [], isCurrentMonth: true });
    expect(b.notes.join(" ")).toMatch(/not (yet )?(arrived|received)/i);
    expect(b.result).toBe(-5_000);
    expect(b.short).toBe(true);
  });

  it("past months have no due lines and no unreceived-salary note", () => {
    const h = buildHero({ income: 90_000, expense: 50_000, dueAmounts: [10_000], isCurrentMonth: false });
    const b = safeToSpendBreakdown({ hero: h, dueItems: [{ title: "x", amount: 10_000, overdue: false }], isCurrentMonth: false });
    expect(b.dueLines).toEqual([]);
    expect(b.result).toBe(40_000);
    expect(b.notes.join(" ")).not.toMatch(/salary/i);
  });

  it("collapses a long list of due items into the largest few plus a rest line that still adds up", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ title: `Bill ${i}`, amount: (i + 1) * 1000, overdue: false }));
    const total = items.reduce((s, i) => s + i.amount, 0);
    const b = safeToSpendBreakdown({ hero: hero(200_000, 0, items.map((i) => i.amount)), dueItems: items, isCurrentMonth: true, maxDueLines: 4 });
    expect(b.dueLines).toHaveLength(4);
    expect(b.dueLines[3].label).toMatch(/5 more/);
    expect(b.dueLines.reduce((s, l) => s + l.amount, 0)).toBe(total);
  });
});
