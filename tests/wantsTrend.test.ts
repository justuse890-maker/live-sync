import { describe, expect, it } from "vitest";
import { wantsSeries, wantsVerdict } from "../src/app/lib/wantsTrend";

const NOW = new Date(2026, 9, 10);
const key = (back: number) => { const d = new Date(2026, 9 - back, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const month = (back: number, income: number, wants: number) => [
  { type: "income", amount: income, date: `${key(back)}-01`, category: "Salary", title: "Salary" },
  { type: "expense", amount: -wants, date: `${key(back)}-10`, category: "Entertainment", title: "Fun" },
];
const build = (rows: Array<[number, number]>) => rows.flatMap(([inc, w], i) => month(11 - i, inc, w)); // oldest → newest

describe("wantsSeries", () => {
  it("returns twelve months ending now, with the wants share of income", () => {
    const s = wantsSeries(build(Array.from({ length: 12 }, () => [100_000, 20_000] as [number, number])), NOW);
    expect(s).toHaveLength(12);
    expect(s[11].key).toBe("2026-10");
    expect(s[0].key).toBe("2025-11");
    expect(s.every((m) => m.sharePct === 20)).toBe(true);
  });

  it("only wants count — rent and EMIs don't — and transfers are ignored", () => {
    const rows = [
      { type: "income", amount: 100_000, date: "2026-10-01", category: "Salary" },
      { type: "expense", amount: -30_000, date: "2026-10-02", category: "Rent", title: "Rent" },
      { type: "expense", amount: -20_000, date: "2026-10-03", category: "EMI", title: "EMI" },
      { type: "expense", amount: -5_000, date: "2026-10-04", category: "Entertainment", title: "Movies" },
      { type: "expense", amount: -9_000, date: "2026-10-05", category: "Entertainment", title: "x", isTransfer: true },
    ];
    expect(wantsSeries(rows, NOW)[11]).toMatchObject({ wants: 5_000, sharePct: 5 });
  });

  it("a month with no income has no share (never a divide-by-zero)", () => {
    expect(wantsSeries([{ type: "expense", amount: -500, date: "2026-10-04", category: "Food" }], NOW)[11].sharePct).toBeNull();
  });
});

describe("wantsVerdict", () => {
  it("flags wants growing >15 points faster than income", () => {
    // first six: income 100k, wants 20k. last six: income 105k (+5%), wants 30k (+50%)
    const rows = build([...Array(6).fill([100_000, 20_000]), ...Array(6).fill([105_000, 30_000])]);
    const v = wantsVerdict(wantsSeries(rows, NOW));
    expect(v.verdict).toBe("outpacing");
    expect(v.incomeGrowthPct).toBeCloseTo(5, 5);
    expect(v.wantsGrowthPct).toBeCloseTo(50, 5);
    expect(v.gapPct).toBeCloseTo(45, 5);
  });

  it("is quiet when they move together, and notes when wants are easing", () => {
    expect(wantsVerdict(wantsSeries(build([...Array(6).fill([100_000, 20_000]), ...Array(6).fill([110_000, 23_000])]), NOW)).verdict).toBe("in_step");
    expect(wantsVerdict(wantsSeries(build([...Array(6).fill([100_000, 30_000]), ...Array(6).fill([100_000, 20_000])]), NOW)).verdict).toBe("easing");
  });

  it("won't judge on thin data", () => {
    expect(wantsVerdict(wantsSeries(build([[100_000, 20_000]]), NOW)).verdict).toBe("not_enough_data");
  });
});
