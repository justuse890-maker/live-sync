import { describe, expect, it } from "vitest";
import { computeRatios, ratioSummary, type RatioInput } from "../src/app/lib/ratios";
import { balanceSheet, incomeExpenditure } from "../src/app/lib/statements";

const r = { from: "2026-04-01", to: "2027-03-31" };
const t = (o: any) => ({ type: "expense", amount: 1000, date: "2026-10-05", category: "Other", title: "x", ...o });

function input(over: Partial<RatioInput> = {}, rows: any[] = []): RatioInput {
  const base = rows.length ? rows : [
    t({ type: "income", amount: 1_200_000, category: "Salary", title: "Salary" }),
    t({ amount: 480_000, category: "Rent", title: "Rent" }),       // needs: 40%
    t({ amount: 240_000, category: "Food", title: "Swiggy" }),      // wants: 20%
    t({ amount: 180_000, category: "EMI", title: "EMI", loanId: "L" }), // 15%
    t({ amount: 180_000, category: "SIP", title: "SIP" }),          // invest 15%
  ];
  return {
    ie: incomeExpenditure(base, r),
    bs: balanceSheet([{ label: "FD", detail: "Fixed Deposit", value: 600_000 }, { label: "Flat", detail: "Property", value: 4_000_000 }], [{ label: "Loan", detail: "home loan", value: 1_000_000 }]),
    monthsWithData: 12, liquidAssets: 600_000, monthlyEmi: 15_000, monthlyIncome: 100_000, lifeCover: 12_000_000, ...over,
  };
}
const get = (rs: ReturnType<typeof computeRatios>, k: string) => rs.find((x) => x.key === k)!;

describe("computeRatios", () => {
  const rs = computeRatios(input());

  it("returns the eight ratios in order", () => {
    expect(rs.map((x) => x.key)).toEqual(["surplus", "needs", "wants", "emi", "emergency", "debt", "cover", "investing"]);
  });

  it("surplus rate is income − needs − wants − EMIs over income", () => {
    expect(get(rs, "surplus").value).toBeCloseTo(25, 5);    // 1.2M − .48 − .24 − .18 = .3M → 25%
    expect(get(rs, "surplus").band).toBe("good");
  });

  it("applies the 50/30/20 bands", () => {
    expect(get(rs, "needs")).toMatchObject({ band: "good", display: "40%" });
    expect(get(rs, "wants")).toMatchObject({ band: "good", display: "20%" });
    expect(get(rs, "investing")).toMatchObject({ band: "good", display: "15%" });
  });

  it("emergency fund = liquid ÷ monthly (needs + EMIs)", () => {
    // essentials per month = (480k + 180k)/12 = 55k ; 600k / 55k = 10.9 months
    expect(get(rs, "emergency").value).toBeCloseTo(600_000 / 55_000, 5);
    expect(get(rs, "emergency").band).toBe("good");
  });

  it("self-employed people need a bigger cushion", () => {
    const biz = computeRatios(input({ persona: "business", liquidAssets: 400_000 }));
    const sal = computeRatios(input({ persona: "salaried", liquidAssets: 400_000 })); // 7.3 months
    expect(get(sal, "emergency").band).toBe("good");
    expect(get(biz, "emergency").band).toBe("watch");   // < 9 months
  });

  it("EMI band follows the user's limit", () => {
    expect(get(computeRatios(input({ monthlyEmi: 30_000 })), "emi").band).toBe("watch");
    expect(get(computeRatios(input({ monthlyEmi: 30_000, emiAlertPct: 25 })), "emi").band).toBe("low");
  });

  it("debt-to-assets and life-cover bands", () => {
    expect(get(rs, "debt").value).toBeCloseTo((1_000_000 / 4_600_000) * 100, 5);
    expect(get(rs, "debt").band).toBe("good");
    expect(get(rs, "cover")).toMatchObject({ band: "good", display: "10.0×" });
    expect(get(computeRatios(input({ lifeCover: 0 })), "cover").band).toBe("low");
  });

  it("with no data, every ratio is 'unknown' — never a made-up number", () => {
    const empty = computeRatios({ ie: incomeExpenditure([], r), bs: balanceSheet([], []), monthsWithData: 0, liquidAssets: 0, monthlyEmi: 0, monthlyIncome: 0, lifeCover: 0 });
    expect(empty.filter((x) => x.band === "unknown").map((x) => x.key)).toHaveLength(8);
  });
});

describe("ratioSummary", () => {
  it("counts bands and lists the top priorities (low before watch)", () => {
    const rs = computeRatios(input({ lifeCover: 0, liquidAssets: 100_000 }));
    const s = ratioSummary(rs);
    expect(s.scored).toBe(8);
    expect(s.good + s.watch + s.low).toBe(8);
    expect(s.priorities.length).toBeLessThanOrEqual(3);
    expect(s.priorities[0].band).toBe("low");
  });
});
