import { describe, expect, it } from "vitest";
import { capFor, suggestTaxTag, taxTotals, untaggedSuggestions } from "../src/app/lib/taxTags";

const r = { from: "2026-04-01", to: "2027-03-31" };
const e = (o: any) => ({ id: "i", type: "expense", amount: 1000, date: "2026-10-05", title: "x", ...o });

describe("suggestTaxTag", () => {
  it("offers the obvious tag from the wording", () => {
    expect(suggestTaxTag(e({ title: "LIC premium" }))).toBe("80C");
    expect(suggestTaxTag(e({ title: "PPF deposit" }))).toBe("80C");
    expect(suggestTaxTag(e({ title: "Star Health mediclaim" }))).toBe("80D");
    expect(suggestTaxTag(e({ title: "NPS contribution" }))).toBe("80CCD1B");
    expect(suggestTaxTag(e({ title: "Donation to trust" }))).toBe("80G");
    expect(suggestTaxTag(e({ category: "Rent", title: "Rent" }))).toBe("HRA");
    expect(suggestTaxTag({ type: "income", title: "Savings account interest" })).toBe("80TTA");
  });

  it("stays quiet when it isn't sure, or already tagged", () => {
    expect(suggestTaxTag(e({ title: "Swiggy" }))).toBeNull();
    expect(suggestTaxTag(e({ title: "LIC premium", taxTag: "80C" }))).toBeNull();
    expect(suggestTaxTag({ type: "income", title: "Salary" })).toBeNull();
  });
});

describe("taxTotals", () => {
  const rows = [
    e({ amount: 100_000, taxTag: "80C" }),
    e({ amount: 80_000, taxTag: "80C", date: "2027-02-10" }),
    e({ amount: 90_000, taxTag: "80C", date: "2026-03-31" }),   // previous year — excluded
    e({ amount: 20_000, taxTag: "80D" }),
    e({ amount: 15_000, taxTag: "80G" }),
    e({ amount: 77_000, taxTag: "80C", isTransfer: true }),     // transfers never count
  ];
  const t = taxTotals(rows, r);
  const by = (k: string) => t.find((x) => x.tag === k)!;

  it("totals per section within the year and shows the limit used", () => {
    expect(by("80C")).toMatchObject({ used: 180_000, cap: 150_000, remaining: 0, pct: 100, count: 2 });
    expect(by("80D")).toMatchObject({ used: 20_000, remaining: 5_000 });
  });

  it("sections without a flat cap report null limits", () => {
    expect(by("80G")).toMatchObject({ cap: null, remaining: null, pct: null, used: 15_000 });
  });

  it("senior citizens get the higher 80D limit", () => {
    expect(capFor("80D", true)).toBe(50_000);
    expect(capFor("80D")).toBe(25_000);
    expect(taxTotals(rows, r, true).find((x) => x.tag === "80D")!.remaining).toBe(30_000);
  });

  it("untagged sections are omitted", () => {
    expect(t.map((x) => x.tag)).toEqual(["80C", "80D", "80G"]);
  });
});

describe("untaggedSuggestions", () => {
  it("lists entries in range that deserve a tag, skipping tagged/transfer rows", () => {
    const s = untaggedSuggestions([
      e({ id: "a", title: "LIC premium" }),
      e({ id: "b", title: "PPF", taxTag: "80C" }),
      e({ id: "c", title: "PPF", isTransfer: true }),
      e({ id: "d", title: "PPF", date: "2025-01-01" }),
    ], r);
    expect(s.map((x) => x.tx.id)).toEqual(["a"]);
  });
});
