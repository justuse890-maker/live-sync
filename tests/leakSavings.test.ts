import { describe, expect, it } from "vitest";
import { applyFixes, canMarkFixed, markFixed, unmarkFixed } from "../src/app/lib/leakSavings";

const leak = (id: string, annual: number) => ({ id, title: id, category: "Subscriptions" as const, annual, tip: "", severity: "low" as const });

describe("leak savings", () => {
  it("only subscription-type leaks can be counted as saved", () => {
    expect(canMarkFixed("sub-12")).toBe(true);
    expect(canMarkFixed("dup-video")).toBe(true);
    expect(canMarkFixed("food-excess")).toBe(false);
    expect(markFixed({}, leak("food-excess", 5000))).toEqual({});
  });

  it("marking fixed moves a leak from open to saved and totals the year", () => {
    const fixes = markFixed({}, leak("sub-1", 7788), new Date("2026-10-10T00:00:00Z"));
    const r = applyFixes([leak("sub-1", 7788), leak("sub-2", 1200), leak("food-excess", 42000)], fixes);
    expect(r.open.map((l) => l.id)).toEqual(["sub-2", "food-excess"]);
    expect(r.savedAnnual).toBe(7788);
    expect(r.savedMonthly).toBe(649);
    expect(r.openAnnual).toBe(43200);
  });

  it("a saving survives the leak disappearing (the user really cancelled it)", () => {
    const fixes = markFixed({}, leak("sub-1", 7788));
    expect(applyFixes([], fixes)).toMatchObject({ savedAnnual: 7788, open: [] });
  });

  it("undo removes it; zero-cost leaks are not recorded", () => {
    const fixes = markFixed({}, leak("sub-1", 100));
    expect(unmarkFixed(fixes, "sub-1")).toEqual({});
    expect(markFixed({}, leak("sub-2", 0))).toEqual({});
  });
});
