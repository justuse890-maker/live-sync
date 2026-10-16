import { describe, expect, it } from "vitest";
import { buildCaPack, documentChecklist, taxEntriesCsv } from "../src/app/lib/caPack";
import { buildLens } from "../src/app/lib/caLens";
import { fyFromStartYear } from "../src/app/lib/fy";

const t = (o: any) => ({ id: Math.random().toString(36), type: "expense", amount: 1000, date: "2026-10-05", category: "Other", title: "x", ...o });
const txs = [
  t({ type: "income", amount: 1_200_000, date: "2026-05-01", category: "Salary", title: "Salary" }),
  t({ amount: 30_000, title: "LIC premium", taxTag: "80C", date: "2026-06-10" }),
  t({ amount: 12_000, title: 'Star "Health" premium', taxTag: "80D", date: "2026-07-10" }),
  t({ amount: 5_000, title: "Old", taxTag: "80C", date: "2026-03-01" }),               // previous year
  t({ amount: 9_000, title: "Transfer", taxTag: "80C", isTransfer: true }),
];
const lens = buildLens({
  fy: fyFromStartYear(2026), today: "2026-10-10", transactions: txs as any,
  assetLines: [{ label: "Nifty fund", detail: "Mutual Fund", value: 400_000 }],
  liabilityLines: [{ label: "SBI", detail: "home loan", value: 2_000_000 }],
  liquidAssets: 100_000, monthlyEmi: 20_000, lifeCover: 0, persona: "salaried",
});
const loans = [{ lenderName: "SBI", loanType: "home_loan", outstandingPrincipal: 2_000_000, emiAmount: 20_000, interestRatePA: 8.5, nextEmiDueDate: "2026-11-05" }];
const fmt = (n: number) => `₹${Math.round(n)}`;

describe("documentChecklist", () => {
  it("lists only what this user's records make relevant, ticking what the vault has", () => {
    const items = documentChecklist(lens, [{ name: "Form 16 FY26.pdf", category: "tax" }, { name: "LIC receipt.jpg" }], loans);
    const by = Object.fromEntries(items.map((i) => [i.id, i.have]));
    expect(Object.keys(by).sort()).toEqual(["80c", "80d", "ais", "bankint", "capgains", "form16", "homeloan"]);
    expect(by.form16).toBe(true);
    expect(by["80c"]).toBe(true);
    expect(by.ais).toBe(false);
    expect(by["80d"]).toBe(false);
  });

  it("no salary, no loans → a short list", () => {
    const bare = buildLens({ fy: fyFromStartYear(2026), today: "2026-10-10", transactions: [t({ amount: 5 })] as any, assetLines: [], liabilityLines: [], liquidAssets: 0, monthlyEmi: 0, lifeCover: 0, persona: "other" });
    expect(documentChecklist(bare, [], []).map((i) => i.id)).toEqual(["ais", "bankint"]);
  });
});

describe("taxEntriesCsv", () => {
  const csv = taxEntriesCsv(txs as any, lens.fy);
  it("has one quoted row per tagged entry in the year, grouped by section, with quotes escaped", () => {
    const lines = csv.split("\n");
    expect(lines[0]).toBe('"Section","Date","Description","Amount"');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('"80C","2026-06-10","LIC premium","30000.00"');
    expect(lines[2]).toContain('"Star ""Health"" premium"');
  });
});

describe("buildCaPack", () => {
  const pack = buildCaPack({ lens, txs: txs as any, loans, docs: [], fmt, now: new Date("2026-10-10T00:00:00Z") });
  it("contains every section and the disclaimers", () => {
    for (const h of ["CA PACK — FY 2026-27", "1. STATEMENTS", "2. HEALTH CHECK", "3. TAX-TAGGED ENTRIES", "4. LOANS & EMIs", "5. DOCUMENT CHECKLIST", "Not audited", "Not a tax return"]) expect(pack).toContain(h);
  });
  it("itemises tagged entries within the year only, never transfers", () => {
    expect(pack).toContain("LIC premium");
    expect(pack).not.toContain("Old");
    expect(pack).toContain("Section 80C — total ₹30000 of usual limit ₹150000");
  });
  it("lists open loans and an honest checklist", () => {
    expect(pack).toContain("SBI (home loan): outstanding ₹2000000, EMI ₹20000, 8.5% p.a., next due 2026-11-05");
    expect(pack).toContain("[ ] Form 16");
  });
});
