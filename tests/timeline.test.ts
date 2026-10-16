import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTimeline, localISO } from "../src/app/lib/intelligence";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 9, 2, 0, 0)); }); // 9 Oct 2026, 02:00 local
afterEach(() => vi.useRealTimers());

const find = (events: ReturnType<typeof buildTimeline>, id: string) => events.find((e) => e.id === id);

describe("timeline logic", () => {
  it("uses the local calendar day, not UTC", () => {
    expect(localISO()).toBe("2026-10-09");
  });

  it("rolls a stale subscription renewal forward to its next occurrence", () => {
    const ev = buildTimeline({ subscriptions: [{ id: "s1", name: "Netflix", cost: 649, renewal: "2026-07-20", status: "active", period: "monthly" }] });
    expect(find(ev, "sub-s1")?.date).toBe("2026-10-20");
  });

  it("clamps month-end when rolling forward", () => {
    const ev = buildTimeline({ subscriptions: [{ id: "s2", name: "X", cost: 1, renewal: "2026-08-31", status: "active", period: "monthly" }] });
    expect(find(ev, "sub-s2")?.date).toBe("2026-10-31");
    const feb = buildTimeline({ subscriptions: [{ id: "s3", name: "Y", cost: 1, renewal: "2026-01-31", status: "active", period: "monthly" }] });
    expect(find(feb, "sub-s3")?.date >= "2026-10-09").toBe(true);
  });

  it("drops cancelled subscriptions", () => {
    const ev = buildTimeline({ subscriptions: [{ id: "s4", name: "Old", cost: 99, renewal: "2026-10-20", status: "cancelled" }] });
    expect(find(ev, "sub-s4")).toBeUndefined();
  });

  it("treats money you lent as inflow and money you borrowed as outflow", () => {
    const ev = buildTimeline({ loans: [
      { id: "a", person: "Ravi", amount: 5000, direction: "lent", repayBy: "2026-10-15" },
      { id: "b", person: "Sita", amount: 2000, direction: "borrowed", repayBy: "2026-10-16" },
    ] });
    expect(find(ev, "loan-a")?.inflow).toBe(true);
    expect(find(ev, "loan-b")?.inflow).toBe(false);
  });

  it("estimates a card bill from real card spend and never invents one", () => {
    const card = { id: "c1", bankName: "HDFC", cardName: "Regalia", cardType: "credit", dueDate: 5, statementDate: 15, creditLimit: 500000, last4Digits: "1234" };
    const tx = (id: string, date: string, amount: number, creditCardId?: string) => ({ id, title: id, category: "x", amount, type: "expense" as const, date, creditCardId });
    const ev = buildTimeline({
      creditCards: [card],
      transactions: [tx("in", "2026-09-20", 1000, "c1"), tx("old", "2026-08-20", 7777, "c1"), tx("other", "2026-09-20", 500, "zz")],
    });
    expect(find(ev, "card-c1")?.amount).toBe(1000);
    const none = buildTimeline({ creditCards: [card], transactions: [] });
    expect(find(none, "card-c1")?.amount).toBeUndefined();
  });

  it("generates tax deadlines for the current and next year", () => {
    const ev = buildTimeline({});
    expect(find(ev, "tax-2026-12-15")).toBeDefined();
    expect(find(ev, "tax-2027-03-15")).toBeDefined();
  });
});
