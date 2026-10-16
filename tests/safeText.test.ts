import { describe, expect, it } from "vitest";
import { safeText, normKey } from "../src/app/lib/safeText";
import { txKey } from "../src/app/store";

// Real data seen on a phone: one saved transaction had numeric title/merchant (453453). Every list that builds a key from
// a title used to call .trim() on it, which threw and left the whole app looking empty.
describe("text fields that are not strings", () => {
  it("safeText never throws and always returns a string", () => {
    expect(safeText(453453)).toBe("453453");
    expect(safeText(undefined)).toBe("");
    expect(safeText(null)).toBe("");
    expect(safeText("  hi ")).toBe("  hi ");
    expect(safeText({ a: 1 })).toBe("");
  });
  it("normKey trims and lower-cases any value", () => {
    expect(normKey(" Rent ")).toBe("rent");
    expect(normKey(453453)).toBe("453453");
    expect(normKey(undefined)).toBe("");
  });
  it("txKey tolerates a numeric title", () => {
    const t: any = { date: "Aug 29", amount: -5, title: 453453, category: "Food", type: "expense" };
    expect(() => txKey(t)).not.toThrow();
    expect(txKey(t)).toContain("453453");
  });
});
