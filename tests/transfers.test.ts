import { describe, expect, it } from "vitest";
import {
  applyTransferPair, buildTransferLegs, clearTransfer, countable, looksLikeSelfTransfer,
  suggestTransferPairs, transferTotals,
} from "../src/app/lib/transfers";
import { monthlyFlow } from "../src/app/lib/intelligence";

const tx = (o: Partial<any>) => ({ id: "x", title: "t", amount: 1000, type: "expense", date: "2026-10-05", category: "Other", ...o });

describe("transfers: classification", () => {
  it("recognises self-transfer wording", () => {
    expect(looksLikeSelfTransfer("Self transfer to HDFC")).toBe(true);
    expect(looksLikeSelfTransfer("Transfer to my savings")).toBe(true);
    expect(looksLikeSelfTransfer("Swiggy order")).toBe(false);
    expect(looksLikeSelfTransfer(undefined)).toBe(false);
  });

  it("countable() drops transfer rows only", () => {
    const rows = [tx({ id: "a" }), tx({ id: "b", isTransfer: true })];
    expect(countable(rows).map((r) => r.id)).toEqual(["a"]);
  });
});

describe("transfers: pair suggestion", () => {
  it("pairs equal amounts across two different recorded accounts within the window", () => {
    const s = suggestTransferPairs([
      tx({ id: "o", type: "expense", accountId: "A", amount: 10000, date: "2026-10-05" }),
      tx({ id: "i", type: "income", accountId: "B", amount: 10000, date: "2026-10-06" }),
    ]);
    expect(s).toEqual([{ outId: "o", inId: "i", amount: 10000, confidence: "certain", dayGap: 1 }]);
  });

  it("does NOT pair on amount alone (a salary and a rent bill can match)", () => {
    const s = suggestTransferPairs([
      tx({ id: "o", type: "expense", title: "Rent", amount: 30000 }),
      tx({ id: "i", type: "income", title: "Salary", amount: 30000 }),
    ]);
    expect(s).toEqual([]);
  });

  it("pairs without accounts only when the wording hints at a self-transfer", () => {
    const s = suggestTransferPairs([
      tx({ id: "o", type: "expense", title: "Self transfer", amount: 5000 }),
      tx({ id: "i", type: "income", title: "Credit", amount: 5000 }),
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].confidence).toBe("likely");
  });

  it("never pairs a row with the same account, outside the window, or already-transfer / loan rows", () => {
    expect(suggestTransferPairs([
      tx({ id: "o", type: "expense", accountId: "A" }), tx({ id: "i", type: "income", accountId: "A" }),
    ])).toEqual([]);
    expect(suggestTransferPairs([
      tx({ id: "o", type: "expense", accountId: "A", date: "2026-10-01" }), tx({ id: "i", type: "income", accountId: "B", date: "2026-10-09" }),
    ])).toEqual([]);
    expect(suggestTransferPairs([
      tx({ id: "o", type: "expense", accountId: "A", isTransfer: true }), tx({ id: "i", type: "income", accountId: "B" }),
    ])).toEqual([]);
    expect(suggestTransferPairs([
      tx({ id: "o", type: "expense", accountId: "A", loanId: "L1" }), tx({ id: "i", type: "income", accountId: "B" }),
    ])).toEqual([]);
  });

  it("is one-to-one and prefers the closest date", () => {
    const s = suggestTransferPairs([
      tx({ id: "o1", type: "expense", accountId: "A", date: "2026-10-05" }),
      tx({ id: "i1", type: "income", accountId: "B", date: "2026-10-07" }),
      tx({ id: "i2", type: "income", accountId: "C", date: "2026-10-05" }),
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].inId).toBe("i2");
  });

  it("matches paise-exact amounts without float drift", () => {
    const s = suggestTransferPairs([
      tx({ id: "o", type: "expense", accountId: "A", amount: 1234.1 }),
      tx({ id: "i", type: "income", accountId: "B", amount: 1234.10 }),
    ]);
    expect(s).toHaveLength(1);
  });
});

describe("transfers: legs and reversal", () => {
  it("buildTransferLegs makes an out/in pair sharing one id and the Transfer category", () => {
    const { out, in: inn } = buildTransferLegs({ transferId: "T1", amount: -2500, date: "2026-10-05", fromAccountId: "A", toAccountId: "B", fromLabel: "HDFC", toLabel: "SBI" });
    expect(out).toMatchObject({ type: "expense", amount: -2500, accountId: "A", transferId: "T1", isTransfer: true, transferRole: "out", category: "Transfer" });
    expect(inn).toMatchObject({ type: "income", amount: 2500, accountId: "B", transferId: "T1", isTransfer: true, transferRole: "in", category: "Transfer" });
  });

  it("applyTransferPair then clearTransfer round-trips", () => {
    const o = tx({ id: "o", category: "Food" });
    const i = tx({ id: "i", type: "income", category: "Salary" });
    const [to, ti] = applyTransferPair(o, i, "T9");
    expect(to.isTransfer && ti.isTransfer).toBe(true);
    expect(to.category).toBe("Transfer");
    const back = clearTransfer(to);
    expect(back.isTransfer).toBeUndefined();
    expect(back.transferId).toBeUndefined();
    expect(back.categoryBeforeTransfer).toBeUndefined();
    expect(back.category).toBe("Food"); // restored, not "Other"
    expect(clearTransfer({ ...to, categoryBeforeTransfer: undefined }).category).toBe("Other");
  });

  it("transferTotals counts each transfer once", () => {
    const { out, in: inn } = buildTransferLegs({ transferId: "T", amount: 700, date: "2026-10-05" });
    expect(transferTotals([out, inn])).toEqual({ moved: 700, count: 1 });
  });
});

describe("transfers: the whole point — they never inflate income or expense", () => {
  it("monthlyFlow over countable() ignores a ₹50,000 own-account move", () => {
    const now = new Date();
    const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-05`;
    const { out, in: inn } = buildTransferLegs({ transferId: "T", amount: 50000, date: d, fromAccountId: "A", toAccountId: "B" });
    const rows: any[] = [
      tx({ id: "sal", type: "income", amount: 80000, date: d, category: "Salary" }),
      tx({ id: "food", type: "expense", amount: 5000, date: d, category: "Food" }),
      { ...out, id: "o" }, { ...inn, id: "i" },
    ];
    const withLegs = monthlyFlow(rows, 0);
    const counted = monthlyFlow(countable(rows), 0);
    expect(withLegs.income).toBe(130000); // what the bug looked like
    expect(counted).toMatchObject({ income: 80000, expense: 5000, savings: 75000 });
  });
});
