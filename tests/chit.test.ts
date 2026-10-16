import { describe, expect, it } from "vitest";
import { chitDueDate, nextChitDue, summarizeChit, validateEntry, type Chit } from "../src/app/lib/chit";

const base = (o: Partial<Chit> = {}): Chit => ({
  id: "c1", name: "Sharma Chit", instalment: 10_000, tenure: 20, dueDay: 5, startDate: "2026-04-01", entries: [], ...o,
});

describe("summarizeChit", () => {
  it("tracks paid, dividends and what is left", () => {
    const c = base({ entries: [
      { month: 1, paid: 10_000, date: "2026-04-05" },
      { month: 2, paid: 9_500, dividend: 500, date: "2026-05-05" },
    ] });
    const s = summarizeChit(c);
    expect(s).toMatchObject({ monthsPaid: 2, monthsLeft: 18, totalCommitted: 200_000, paidTotal: 19_500, dividendTotal: 500, nominalLeft: 180_000, status: "saving", nextMonth: 3, prizeHeld: null });
  });

  it("after winning, reports prize held versus what has been paid in", () => {
    const c = base({ entries: [{ month: 1, paid: 10_000, date: "2026-04-05" }], won: { month: 2, amount: 170_000, date: "2026-05-05" } });
    const s = summarizeChit(c);
    expect(s.status).toBe("won");
    expect(s.prizeHeld).toBe(160_000);
  });

  it("finishes when every month is paid", () => {
    const entries = Array.from({ length: 3 }, (_, i) => ({ month: i + 1, paid: 100, date: "2026-04-05" }));
    const s = summarizeChit(base({ tenure: 3, instalment: 100, entries }));
    expect(s).toMatchObject({ status: "done", nextMonth: null, monthsLeft: 0 });
  });

  it("skipped months are found, not assumed sequential", () => {
    const s = summarizeChit(base({ entries: [{ month: 1, paid: 1, date: "x" }, { month: 3, paid: 1, date: "x" }] }));
    expect(s.nextMonth).toBe(2);
  });
});

describe("due dates", () => {
  it("month 1 is the start month; later months advance by calendar month, across year end", () => {
    const c = base({ startDate: "2026-11-01", dueDay: 10 });
    expect(chitDueDate(c, 1)).toBe("2026-11-10");
    expect(chitDueDate(c, 3)).toBe("2027-01-10");
  });

  it("clamps the due day to 28 so short months never overflow", () => {
    expect(chitDueDate({ startDate: "2026-01-01", dueDay: 31 }, 2)).toBe("2026-02-28");
  });

  it("nextChitDue returns the first unpaid month, null when closed or done", () => {
    expect(nextChitDue(base({ entries: [{ month: 1, paid: 1, date: "x" }] }))).toEqual({ month: 2, dueDate: "2026-05-05", amount: 10_000 });
    expect(nextChitDue(base({ closed: true }))).toBeNull();
  });
});

describe("validateEntry", () => {
  const c = base({ entries: [{ month: 1, paid: 10_000, date: "x" }] });
  it("accepts a normal entry", () => {
    expect(validateEntry(c, { month: 2, paid: 9_500, dividend: 500, date: "x" })).toBeNull();
  });
  it("rejects duplicates, out-of-range months, zero, and absurd amounts", () => {
    expect(validateEntry(c, { month: 1, paid: 1, date: "x" })).toMatch(/already/);
    expect(validateEntry(c, { month: 21, paid: 1, date: "x" })).toMatch(/between/);
    expect(validateEntry(c, { month: 2, paid: 0, date: "x" })).toMatch(/Enter/);
    expect(validateEntry(c, { month: 2, paid: 99_999, date: "x" })).toMatch(/above/);
  });
});
