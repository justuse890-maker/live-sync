import { describe, expect, it } from "vitest";
import { txKind, KIND_BADGE } from "../src/app/lib/txKind";

describe("txKind", () => {
  it("own-account transfers are their own type, whatever their category", () => {
    expect(txKind({ type: "expense", category: "Other", title: "To savings", isTransfer: true })).toBe("transfer");
    expect(txKind({ type: "income", category: "Other", title: "From salary a/c", isTransfer: true })).toBe("transfer");
  });
  it("recognises a card bill payment by its category or title", () => {
    expect(txKind({ type: "expense", category: "Credit Card Bill", title: "x" })).toBe("card_bill");
    expect(txKind({ type: "expense", category: "Other", title: "HDFC card bill payment" })).toBe("card_bill");
    expect(txKind({ type: "expense", category: "Food", title: "Billing cycle snacks" })).toBe("spend");
  });
  it("a purchase made WITH a card is spend, not a card bill", () => {
    expect(txKind({ type: "expense", category: "Credit Card Bill", title: "x", creditCardId: "c1" })).toBe("spend");
  });
  it("income and ordinary spend", () => {
    expect(txKind({ type: "income", category: "Salary", title: "Oct salary" })).toBe("income");
    expect(txKind({ type: "expense", category: "Food", title: "Lunch" })).toBe("spend");
  });
  it("badges use a word and an icon name so colour is never the only cue, and only transfer says 'not counted'", () => {
    expect(KIND_BADGE.transfer.label).toMatch(/transfer/i);
    expect(KIND_BADGE.transfer.hint).toMatch(/not counted/i);
    expect(KIND_BADGE.card_bill.hint).not.toMatch(/not counted/i);
    for (const k of ["transfer", "card_bill", "income"] as const) expect(KIND_BADGE[k].icon).toMatch(/\w/);
    expect(KIND_BADGE.spend).toBeNull();
  });
});
