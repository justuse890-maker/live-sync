import { describe, expect, it } from "vitest";
import { calcEmi } from "../src/app/lib/loanEngine";
import { bnplBurden, emiBurden, emiOutflowTimeline, prepaymentImpact, simulateRepayment, typicalMonthlyIncome } from "../src/app/lib/emiPlanner";

describe("simulateRepayment", () => {
  it("matches the textbook EMI schedule", () => {
    const emi = calcEmi(1_000_000, 9, 120);
    const s = simulateRepayment(1_000_000, 9, emi)!;
    expect(s.months).toBe(120);
    // total interest ≈ emi*n − principal (EMI is rounded to the rupee, so allow a small drift)
    expect(Math.abs(s.interest - (emi * 120 - 1_000_000))).toBeLessThan(120);
  });

  it("handles zero-interest loans", () => {
    expect(simulateRepayment(12_000, 0, 1_000)).toMatchObject({ months: 12, interest: 0 });
  });

  it("returns null when the EMI cannot even cover interest", () => {
    expect(simulateRepayment(1_000_000, 12, 5_000)).toBeNull(); // interest is 10,000/month
  });

  it("returns an empty schedule for a cleared loan", () => {
    expect(simulateRepayment(0, 9, 1000)).toEqual({ months: 0, interest: 0, finalPayment: 0 });
  });
});

describe("prepaymentImpact", () => {
  const input = { balance: 1_000_000, ratePA: 9, emi: calcEmi(1_000_000, 9, 120) };

  it("a lump sum shortens the loan and saves interest when the EMI is kept", () => {
    const r = prepaymentImpact({ ...input, extra: 200_000 })!;
    expect(r.reduceTenure!.monthsSaved).toBeGreaterThan(18);
    expect(r.reduceTenure!.interestSaved).toBeGreaterThan(150_000);
    expect(r.reduceTenure!.months).toBeLessThan(r.baseline.months);
  });

  it("alternatively lowers the EMI while keeping the end date", () => {
    const r = prepaymentImpact({ ...input, extra: 200_000 })!;
    expect(r.reduceEmi!.emi).toBeLessThan(input.emi);
    expect(r.reduceEmi!.months).toBe(120);
    expect(r.reduceEmi!.interestSaved).toBeGreaterThan(0);
  });

  it("shortening the tenure always saves at least as much interest as lowering the EMI", () => {
    const r = prepaymentImpact({ ...input, extra: 200_000 })!;
    expect(r.reduceTenure!.interestSaved).toBeGreaterThanOrEqual(r.reduceEmi!.interestSaved);
  });

  it("extra = 0 saves nothing", () => {
    const r = prepaymentImpact({ ...input, extra: 0 })!;
    expect(r.reduceTenure!.interestSaved).toBe(0);
    expect(r.reduceTenure!.monthsSaved).toBe(0);
  });

  it("paying off the whole balance closes the loan", () => {
    const r = prepaymentImpact({ ...input, extra: 5_000_000 })!;
    expect(r.reduceTenure!.months).toBe(0);
    expect(r.reduceTenure!.interestSaved).toBeCloseTo(r.baseline.interest, 0);
    expect(r.reduceEmi!.emi).toBe(0);
  });

  it("returns null for an impossible loan (EMI below interest)", () => {
    expect(prepaymentImpact({ balance: 1_000_000, ratePA: 12, emi: 5_000, extra: 1000 })).toBeNull();
  });
});

describe("emiBurden", () => {
  it("bands: healthy ≤25%, watch ≤35%, high >35% (default alert)", () => {
    expect(emiBurden(100_000, 20_000).level).toBe("healthy");
    expect(emiBurden(100_000, 30_000).level).toBe("watch");
    expect(emiBurden(100_000, 36_000).level).toBe("high");
    expect(emiBurden(100_000, 35_000).level).toBe("watch"); // exactly at the line is not a breach
  });

  it("alert line is user-configurable", () => {
    expect(emiBurden(100_000, 30_000, 40).level).toBe("watch");
    expect(emiBurden(100_000, 45_000, 40).level).toBe("high");
  });

  it("reports headroom, never negative", () => {
    expect(emiBurden(100_000, 20_000).headroom).toBe(15_000);
    expect(emiBurden(100_000, 50_000).headroom).toBe(0);
  });

  it("no income → cannot judge, no divide-by-zero", () => {
    expect(emiBurden(0, 10_000)).toMatchObject({ level: "no_income", ratioPct: null });
  });

  it("no EMIs → none", () => {
    expect(emiBurden(80_000, 0).level).toBe("none");
  });
});

describe("emiOutflowTimeline", () => {
  const loans = [
    { id: "a", lenderName: "HDFC", emiAmount: 20_000, emisPaid: 10, totalEmis: 12 },       // 2 left
    { id: "b", lenderName: "Axis", emiAmount: 5_000, emisPaid: 0, totalEmis: 36 },
    { id: "c", lenderName: "Old", emiAmount: 9_000, emisPaid: 5, totalEmis: 10, closed: true },
    { id: "d", lenderName: "Builder", emiAmount: 0, emisPaid: 0, totalEmis: 240, phase: "pre_emi" as const, interestRatePA: 9, disbursedAmount: 2_000_000 },
  ];
  const t = emiOutflowTimeline(loans, 4, new Date(2026, 9, 9));

  it("starts at the current month and spans the requested horizon", () => {
    expect(t.map((m) => m.monthKey)).toEqual(["2026-10", "2026-11", "2026-12", "2027-01"]);
  });

  it("drops a loan after its last EMI, skips closed loans, counts pre-EMI interest only", () => {
    expect(t[0].total).toBe(20_000 + 5_000 + 15_000); // pre-EMI = 2,000,000 × 9% ÷ 12
    expect(t[1].total).toBe(20_000 + 5_000 + 15_000);
    expect(t[2].total).toBe(5_000 + 15_000); // HDFC finished
    expect(t.every((m) => !m.items.some((i) => i.loanId === "c"))).toBe(true);
  });
});

describe("typicalMonthlyIncome", () => {
  const now = new Date(2026, 9, 9);
  it("averages the last three months that have income, ignoring empty ones", () => {
    const txs = [
      { type: "income", amount: 100_000, date: "2026-08-01" },
      { type: "income", amount: 120_000, date: "2026-09-01" },
      { type: "expense", amount: 5_000, date: "2026-10-02" },
    ];
    expect(typicalMonthlyIncome(txs, now)).toBe(110_000);
  });
  it("ignores months older than three and returns 0 with no income", () => {
    expect(typicalMonthlyIncome([{ type: "income", amount: 9_999, date: "2026-05-01" }], now)).toBe(0);
    expect(typicalMonthlyIncome([], now)).toBe(0);
  });
});

describe("bnplBurden", () => {
  const loans = [
    { loanType: "home_loan", emiAmount: 40_000 },
    { loanType: "bnpl", emiAmount: 6_000 },
    { loanType: "bnpl", emiAmount: 7_000 },
    { loanType: "bnpl", emiAmount: 99_000, closed: true },
  ];
  it("sums only open BNPL dues and flags above 10% of income", () => {
    expect(bnplBurden(100_000, loans)).toMatchObject({ monthly: 13_000, flagged: true, hasAny: true });
    expect(bnplBurden(200_000, loans).flagged).toBe(false);
  });
  it("no income or no BNPL never flags", () => {
    expect(bnplBurden(0, loans)).toMatchObject({ ratioPct: null, flagged: false });
    expect(bnplBurden(100_000, [{ loanType: "home_loan", emiAmount: 1 }]).hasAny).toBe(false);
  });
});
