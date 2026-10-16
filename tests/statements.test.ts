import { describe, expect, it } from "vitest";
import { balanceSheet, cashFlow, classifyIncome, incomeExpenditure, monthlySeries } from "../src/app/lib/statements";

const r = { from: "2026-04-01", to: "2027-03-31" };
const t = (o: any) => ({ type: "expense", amount: 1000, date: "2026-10-05", category: "Other", title: "x", ...o });

const rows = [
  t({ type: "income", amount: 1_200_000, date: "2026-05-01", category: "Salary", title: "Salary" }),
  t({ type: "income", amount: 60_000, date: "2026-07-10", title: "FD interest" }),
  t({ type: "income", amount: 40_000, date: "2026-08-01", title: "Freelance invoice #12" }),
  t({ amount: 360_000, category: "Rent", title: "Rent" }),
  t({ amount: 120_000, category: "Food", title: "Swiggy" }),
  t({ amount: 240_000, category: "EMI", title: "HDFC EMI", loanId: "L1" }),
  t({ amount: 180_000, category: "SIP", title: "SIP" }),
  t({ amount: 50_000, category: "Rent", title: "old", date: "2026-03-31" }),       // outside the year
  t({ amount: 70_000, category: "Rent", title: "move", isTransfer: true }),        // transfer
];

describe("classifyIncome", () => {
  it("sorts income into heads", () => {
    expect(classifyIncome({ category: "Salary", title: "x" })).toBe("salary");
    expect(classifyIncome({ title: "FD interest" })).toBe("interest");
    expect(classifyIncome({ title: "Freelance invoice" })).toBe("business");
    expect(classifyIncome({ title: "Rent received from tenant" })).toBe("rent");
    expect(classifyIncome({ title: "Gift" })).toBe("other");
  });
});

describe("incomeExpenditure", () => {
  const ie = incomeExpenditure(rows, r);

  it("counts only the period and ignores transfers", () => {
    expect(ie.income.total).toBe(1_300_000);
    expect(ie.needs.total).toBe(360_000);           // the March rent and the transfer are excluded
  });

  it("splits expenditure into needs / wants / debt service / savings", () => {
    expect(ie).toMatchObject({ wants: { total: 120_000 }, debtService: { total: 240_000 }, savings: { total: 180_000 } });
  });

  it("surplus = income − needs − wants − debt service; cash retained is after savings", () => {
    expect(ie.surplus).toBe(1_300_000 - 360_000 - 120_000 - 240_000);
    expect(ie.cashRetained).toBe(ie.surplus - 180_000);
    expect(ie.surplusRatePct).toBeCloseTo((580_000 / 1_300_000) * 100, 5);
  });

  it("every group's lines add up to its total", () => {
    for (const g of [ie.income, ie.needs, ie.wants, ie.debtService, ie.savings]) {
      expect(g.lines.reduce((s, l) => s + l.amount, 0)).toBe(g.total);
    }
  });

  it("no income → no rate, no divide-by-zero", () => {
    expect(incomeExpenditure([t({ amount: 5 })], r).surplusRatePct).toBeNull();
  });

  it("folds long tails into 'Other items' without losing money", () => {
    const many = Array.from({ length: 9 }, (_, i) => t({ amount: 100 + i, category: `Cat${i}`, title: `shop ${i}` }));
    const g = incomeExpenditure(many, r).wants;
    expect(g.lines.at(-1)?.label).toBe("Other items");
    expect(g.lines.reduce((s, l) => s + l.amount, 0)).toBe(g.total);
  });
});

describe("cashFlow", () => {
  it("operating + financing + investing = net change, and agrees with cash retained", () => {
    const ie = incomeExpenditure(rows, r);
    const cf = cashFlow(ie);
    expect(cf.operating).toBe(1_300_000 - 360_000 - 120_000);
    expect(cf.financing).toBe(-240_000);
    expect(cf.investing).toBe(-180_000);
    expect(cf.net).toBe(ie.cashRetained);
  });
});

describe("balanceSheet", () => {
  const bs = balanceSheet(
    [
      { label: "HDFC", detail: "Savings", value: 200_000 },
      { label: "Bank FD", detail: "Fixed Deposit", value: 500_000 },
      { label: "EPF", detail: "EPF", value: 300_000 },
      { label: "Nifty fund", detail: "Mutual Fund", value: 400_000 },
      { label: "Gold coins", detail: "Gold (purchase price)", value: 100_000 },
      { label: "Flat", detail: "Property", value: 5_000_000 },
      { label: "Bike", detail: "Other", value: 50_000 },
      { label: "zero", detail: "Cash", value: 0 },
    ],
    [
      { label: "SBI", detail: "home loan", value: 3_000_000 },
      { label: "LazyPay", detail: "bnpl", value: 20_000 },
      { label: "HDFC Card", detail: "Credit Card", value: 30_000 },
      { label: "Car", detail: "car loan", value: 400_000 },
    ],
  );

  it("groups lines sensibly and in a fixed order", () => {
    expect(bs.assets.map((g) => g.key)).toEqual(["cash", "fd", "retirement", "market", "gold", "property", "other"]);
    expect(bs.liabilities.map((g) => g.key)).toEqual(["home", "bnpl", "cards", "personal"]);
  });

  it("totals and net worth reconcile with the groups", () => {
    expect(bs.totalAssets).toBe(6_550_000);
    expect(bs.totalLiabilities).toBe(3_450_000);
    expect(bs.netWorth).toBe(3_100_000);
    expect(bs.assets.reduce((s, g) => s + g.total, 0)).toBe(bs.totalAssets);
    expect(bs.debtToAssetPct).toBeCloseTo((3_450_000 / 6_550_000) * 100, 5);
  });

  it("empty book is safe", () => {
    const e = balanceSheet([], []);
    expect(e).toMatchObject({ netWorth: 0, debtToAssetPct: null });
  });
});

describe("monthlySeries", () => {
  it("returns a row per month key with income, expense and net", () => {
    const s = monthlySeries(rows, ["2026-05", "2026-10"]);
    expect(s[0]).toMatchObject({ key: "2026-05", income: 1_200_000 });
    expect(s[1].expense).toBe(360_000 + 120_000 + 240_000 + 180_000);
  });
});
