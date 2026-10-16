import { describe, expect, it } from "vitest";
import { entriesToTable, parseStatementRows, type PdfRow } from "../src/app/lib/statementPdf";

// Helper: a row of cells at given x positions. Amount columns are right-aligned, so we give widths.
const c = (x: number, text: string, w = text.length * 5) => ({ x, w, text });
const row = (...cells: Array<[number, string]>): PdfRow => cells.map(([x, t]) => c(x, t));

const HEADER = row([20, "Date"], [90, "Narration"], [300, "Withdrawal Amt."], [380, "Deposit Amt."], [460, "Closing Balance"]);
// right edges: withdrawal ≈ 300+15*5=375 ; deposit ≈ 380+12*5=440 ; balance ≈ 460+15*5=535
const amtAt = (rightEdge: number, text: string) => c(rightEdge - text.length * 5, text);

describe("column-based statement (header present)", () => {
  const rows: PdfRow[] = [
    row([20, "Statement of Account"]),
    HEADER,
    [c(20, "01/10/26"), c(90, "NEFT CR-ACME CORP-SALARY"), amtAt(440, "1,20,000.00"), amtAt(535, "1,45,000.50")],
    [c(20, "02/10/26"), c(90, "UPI-SWIGGY-swiggy@icici-628199"), amtAt(375, "450.00"), amtAt(535, "1,44,550.50")],
    row([90, "-ORDER 4411 BANGALORE"]),                                   // wrapped narration
    [c(20, "05/10/26"), c(90, "POS 4321 AMAZON"), amtAt(375, "1,299.00"), amtAt(535, "1,43,251.50")],
    row([20, "Page 1 of 2"]),
  ];
  const p = parseStatementRows(rows);

  it("reads dates, amounts and direction from the column the amount sits in", () => {
    expect(p.headerFound).toBe(true);
    expect(p.entries.map((e) => [e.date, e.amount, e.type])).toEqual([
      ["2026-10-01", 120000, "income"], ["2026-10-02", 450, "expense"], ["2026-10-05", 1299, "expense"],
    ]);
  });

  it("joins wrapped narration but ignores page footers", () => {
    expect(p.entries[1].description).toContain("ORDER 4411 BANGALORE");
    expect(p.entries[2].description).not.toMatch(/page/i);
  });

  it("captures the running balance and counts rows it could not use", () => {
    expect(p.entries[0].balance).toBe(145000.5);
    expect(p.ignoredRows).toBeGreaterThan(0);
  });
});

describe("no header: running balance decides the direction", () => {
  const rows: PdfRow[] = [
    [c(20, "01-Oct-2026"), c(90, "Opening salary credit"), c(300, "50,000.00"), c(400, "50,000.00")],
    [c(20, "02-Oct-2026"), c(90, "Paid to shop"), c(300, "1,000.00"), c(400, "49,000.00")],
    [c(20, "03-Oct-2026"), c(90, "Received from friend"), c(300, "2,500.00"), c(400, "51,500.00")],
  ];
  it("compares each balance with the previous one", () => {
    const p = parseStatementRows(rows);
    expect(p.headerFound).toBe(false);
    expect(p.entries.map((e) => e.type)).toEqual(["income", "expense", "income"]);
  });
});

describe("fallbacks", () => {
  it("uses Cr/Dr suffixes", () => {
    const p = parseStatementRows([[c(20, "04/10/26"), c(90, "Something odd"), c(300, "700.00 Dr")], [c(20, "05/10/26"), c(90, "Another"), c(300, "300.00 Cr")]]);
    expect(p.entries.map((e) => e.type)).toEqual(["expense", "income"]);
  });

  it("leaves it 'unknown' rather than guessing when nothing tells", () => {
    const p = parseStatementRows([[c(20, "04/10/26"), c(90, "Xyz Ltd"), c(300, "700.00")]]);
    expect(p.entries[0].type).toBe("unknown");
  });

  it("rejects rows with impossible dates or no amount", () => {
    const p = parseStatementRows([[c(20, "31/02/26"), c(90, "Bad date"), c(300, "10.00")], [c(20, "05/10/26"), c(90, "No amount here")]]);
    expect(p.entries).toHaveLength(0);
  });

  it("reference numbers (no decimals) are not mistaken for amounts", () => {
    const p = parseStatementRows([[c(20, "05/10/26"), c(90, "UPI REF 628199301234"), c(300, "250.00 Dr")]]);
    expect(p.entries[0]).toMatchObject({ amount: 250, type: "expense" });
  });

  it("reads dates split across cells ('10', 'Oct', '2026')", () => {
    const p = parseStatementRows([[c(20, "10"), c(35, "Oct"), c(55, "2026"), c(90, "Grocery"), c(300, "80.00 Dr")]]);
    expect(p.entries[0].date).toBe("2026-10-10");
    expect(p.entries[0].description).toBe("Grocery");
  });
});

describe("entriesToTable", () => {
  it("feeds the existing importer's debit/credit columns; unknowns follow the chosen default", () => {
    const entries = [
      { date: "2026-10-01", description: "A", amount: 100, type: "income" as const },
      { date: "2026-10-02", description: "B", amount: 50, type: "expense" as const },
      { date: "2026-10-03", description: "C", amount: 20, type: "unknown" as const },
    ];
    const t = entriesToTable(entries);
    expect(t.headers).toEqual(["Date", "Description", "Debit", "Credit"]);
    expect(t.rows).toEqual([["2026-10-01", "A", "", "100.00"], ["2026-10-02", "B", "50.00", ""], ["2026-10-03", "C", "20.00", ""]]);
    expect(entriesToTable(entries, "income").rows[2]).toEqual(["2026-10-03", "C", "", "20.00"]);
  });
});
