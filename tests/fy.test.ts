import { describe, expect, it } from "vitest";
import { currentFY, fyDeadlines, fyFromStartYear, fyMonthKeys, fyOf, inFY, shiftFY, upcomingDeadlines } from "../src/app/lib/fy";
import { classifyFlow, needsWantsSavings } from "../src/app/lib/intelligence";

describe("financial year", () => {
  it("Jan–Mar belong to the FY that started the previous April", () => {
    expect(fyOf("2027-03-31").label).toBe("FY 2026-27");
    expect(fyOf("2026-04-01").label).toBe("FY 2026-27");
    expect(fyOf("2026-03-31").label).toBe("FY 2025-26");
  });

  it("labels across the century boundary", () => {
    expect(fyFromStartYear(2099).label).toBe("FY 2099-00");
  });

  it("has April-first month keys that cross the year end", () => {
    const k = fyMonthKeys(fyFromStartYear(2026));
    expect(k[0]).toBe("2026-04");
    expect(k[8]).toBe("2026-12");
    expect(k[9]).toBe("2027-01");
    expect(k[11]).toBe("2027-03");
    expect(k).toHaveLength(12);
  });

  it("inFY is inclusive of both ends", () => {
    const fy = fyFromStartYear(2026);
    expect(inFY("2026-04-01", fy)).toBe(true);
    expect(inFY("2027-03-31", fy)).toBe(true);
    expect(inFY("2027-04-01", fy)).toBe(false);
    expect(inFY("2026-03-31", fy)).toBe(false);
  });

  it("currentFY / shiftFY", () => {
    expect(currentFY(new Date(2026, 9, 10)).label).toBe("FY 2026-27");
    expect(shiftFY(currentFY(new Date(2026, 9, 10)), -1).label).toBe("FY 2025-26");
  });
});

describe("deadlines", () => {
  it("gives four advance-tax dates and the ITR date", () => {
    const d = fyDeadlines(fyFromStartYear(2026));
    expect(d.map((x) => x.date)).toEqual(["2026-06-15", "2026-09-15", "2026-12-15", "2027-03-15", "2027-07-31"]);
  });

  it("upcoming lists what is still ahead, soonest first, with days left", () => {
    const u = upcomingDeadlines("2026-10-10", 3, new Date(2026, 9, 10));
    expect(u.map((x) => x.date)).toEqual(["2026-12-15", "2027-03-15", "2027-07-31"]);
    expect(u[0].daysLeft).toBe(66);
  });

  it("a deadline today still counts (0 days left)", () => {
    expect(upcomingDeadlines("2026-12-15", 1, new Date(2026, 11, 15))[0].daysLeft).toBe(0);
  });
});

describe("classifyFlow (shared classifier)", () => {
  it("keeps the previous monthly split behaviour", () => {
    const rows = [
      { type: "expense", amount: 30_000, date: "2026-10-02", category: "Rent", title: "Rent" },
      { type: "expense", amount: 20_000, date: "2026-10-03", category: "EMI", title: "HDFC EMI" },
      { type: "expense", amount: 10_000, date: "2026-10-04", category: "SIP", title: "SIP" },
      { type: "expense", amount: 4_000, date: "2026-10-05", category: "Entertainment", title: "Movie" },
    ] as any[];
    expect(needsWantsSavings(rows, "2026-10")).toEqual({ needs: 30_000, emis: 20_000, savings: 10_000, wants: 4_000 });
  });

  it("loan-linked rows and chit instalments are classified correctly", () => {
    expect(classifyFlow({ title: "x", category: "Other", loanId: "L1" })).toBe("emis");
    expect(classifyFlow({ title: "Chit instalment — Sharma", category: "Chit Fund" })).toBe("savings");
  });
});
