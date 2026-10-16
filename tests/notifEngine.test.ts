import { describe, expect, it } from "vitest";
import { generateSmartNotifications } from "../src/app/lib/notifEngine";

const base = { transactions: [] as any[], budgets: [] as any[], buckets: [], bucketContributions: [], subscriptions: [], insurance: [], structuredLoans: [], creditCards: [] };
const spend = (date: string, amount: number, category = "Food", title = "x") => ({ type: "expense", amount: -amount, date, category, title });

describe("budget alerts follow the user's level and the pace", () => {
  const now = new Date(2026, 9, 12); // day 12 of 31

  it("uses the user's warning level instead of a fixed 85%", () => {
    const input = { ...base, budgets: [{ category: "Food", limit: 10_000, spent: 0 }], transactions: [spend("2026-10-05", 7_200)] };
    expect(generateSmartNotifications(input, { now }).some((n) => n.kind === "budget_alert")).toBe(false);          // 72% < default 85
    expect(generateSmartNotifications(input, { now, prefs: { budgetWarnPct: 70 } }).some((n) => n.kind === "budget_alert")).toBe(true);
  });

  it("warns early when the pace will pass the limit, before the percentage alert would fire", () => {
    // 5,000 of 10,000 used by day 12 → on pace for ~12,900 by month end
    const input = { ...base, budgets: [{ category: "Food", limit: 10_000, spent: 0 }], transactions: [spend("2026-10-05", 5_000)] };
    const n = generateSmartNotifications(input, { now }).find((x) => x.kind === "budget_pace");
    expect(n).toBeTruthy();
    expect(n!.severity).toBe("info");
    expect(n!.body).toMatch(/pace/i);
    expect(n!.body).not.toMatch(/!/);
  });

  it("stays quiet when spending is comfortably within pace, or too early in the month to judge", () => {
    const calm = { ...base, budgets: [{ category: "Food", limit: 10_000, spent: 0 }], transactions: [spend("2026-10-05", 2_000)] };
    expect(generateSmartNotifications(calm, { now }).some((x) => x.kind === "budget_pace")).toBe(false);
    const early = { ...base, budgets: [{ category: "Food", limit: 10_000, spent: 0 }], transactions: [spend("2026-10-02", 4_000)] };
    expect(generateSmartNotifications(early, { now: new Date(2026, 9, 3) }).some((x) => x.kind === "budget_pace")).toBe(false);
  });

  it("pace alerts can be switched off", () => {
    const input = { ...base, budgets: [{ category: "Food", limit: 10_000, spent: 0 }], transactions: [spend("2026-10-05", 5_000)] };
    expect(generateSmartNotifications(input, { now, prefs: { paceAlerts: false } }).some((x) => x.kind === "budget_pace")).toBe(false);
  });
});

describe("recurring bill rises", () => {
  const now = new Date(2026, 9, 16);
  it("tells the user when a fixed monthly bill went up", () => {
    const input = { ...base, transactions: [spend("2026-07-05", 649, "Subscriptions", "Netflix"), spend("2026-08-05", 649, "Subscriptions", "Netflix"), spend("2026-09-05", 649, "Subscriptions", "Netflix"), spend("2026-10-05", 799, "Subscriptions", "Netflix")] };
    const n = generateSmartNotifications(input, { now }).find((x) => x.kind === "bill_rise");
    expect(n).toBeTruthy();
    expect(n!.title).toMatch(/Netflix/);
    expect(n!.body).toMatch(/649/);
    expect(n!.body).toMatch(/799/);
  });
});
