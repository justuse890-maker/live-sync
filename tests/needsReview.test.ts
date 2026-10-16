import { describe, expect, it } from "vitest";
import { needsReview } from "../src/app/lib/needsReview";

const now = new Date(2026, 9, 16);
const t = (id: string, over: Record<string, unknown> = {}) => ({ id, type: "expense", amount: -500, date: "2026-10-10", title: "Lunch", category: "Food", ...over });

describe("needsReview", () => {
  it("flags uncategorised spending but not income or transfers", () => {
    const out = needsReview([t("a", { category: "Other" }), t("b", { category: "" }), t("c", { type: "income", category: "Other", amount: 900 }), t("d", { category: "Other", isTransfer: true })], { now });
    expect(out.map((x) => x.tx.id).sort()).toEqual(["a", "b"]);
    expect(out[0].reasons).toContain("no_category");
  });
  it("flags an amount above the retail limit and a title that is only digits or not text", () => {
    const out = needsReview([t("big", { amount: -45_345_345_345, title: 453453, merchant: 453453 }), t("num", { title: "98765" })], { now });
    const big = out.find((x) => x.tx.id === "big")!;
    expect(big.reasons).toEqual(expect.arrayContaining(["odd_amount", "odd_text"]));
    expect(out.find((x) => x.tx.id === "num")!.reasons).toEqual(["odd_text"]);
  });
  it("flags a possible duplicate (same day, amount and title)", () => {
    const out = needsReview([t("a"), t("b")], { now });
    expect(out).toHaveLength(2);
    expect(out[0].reasons).toContain("possible_duplicate");
  });
  it("flags a date in the future", () => {
    const out = needsReview([t("f", { date: "2026-12-25" })], { now });
    expect(out[0].reasons).toContain("future_date");
  });
  it("puts the most worrying first and respects dismissals and the limit", () => {
    const rows = [t("cat", { category: "Other" }), t("big", { amount: -999_999_999_999 }), t("dup1", { title: "Tea" }), t("dup2", { title: "Tea" })];
    const out = needsReview(rows, { now });
    expect(out[0].tx.id).toBe("big");
    expect(needsReview(rows, { now, dismissed: new Set(["big"]) }).map((x) => x.tx.id)).not.toContain("big");
    expect(needsReview(rows, { now, limit: 2 })).toHaveLength(2);
  });
  it("a clean ledger needs no review", () => {
    expect(needsReview([t("a"), t("b", { title: "Bus", date: "2026-10-11" })], { now })).toEqual([]);
  });
});
