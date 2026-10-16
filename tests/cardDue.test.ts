import { describe, expect, it } from "vitest";
import { cardDueWarning } from "../src/app/lib/cardDue";

const base = { cardLabel: "HDFC card ••4321" };

describe("cardDueWarning", () => {
  it("states what, why and one action, and ties the full payment to the interest-free period", () => {
    const w = cardDueWarning({ ...base, daysLeft: 2, statementDue: 18_400, minDue: 920 });
    expect(w.level).toBe("action");
    expect(w.title).toMatch(/2 days/);
    expect(w.body).toMatch(/18,400/);
    expect(w.body).toMatch(/interest-free/i);
    expect(w.body).toMatch(/920/);
    expect(w.primaryAction).toBe("Mark paid");
  });

  it("does not invent a cost: with no statement amount it asks for it", () => {
    const w = cardDueWarning({ ...base, daysLeft: 5 });
    expect(w.body).not.toMatch(/₹\s?\d/);
    expect(w.body).toMatch(/enter .*statement/i);
    expect(w.primaryAction).toBe("Add statement amount");
  });

  it("escalates by days left and never relies on wording alone", () => {
    expect(cardDueWarning({ ...base, daysLeft: 12, statementDue: 5_000 }).level).toBe("info");
    expect(cardDueWarning({ ...base, daysLeft: 6, statementDue: 5_000 }).level).toBe("watch");
    expect(cardDueWarning({ ...base, daysLeft: 1, statementDue: 5_000 }).level).toBe("action");
    expect(cardDueWarning({ ...base, daysLeft: 0, statementDue: 5_000 }).title).toMatch(/today/i);
    const late = cardDueWarning({ ...base, daysLeft: -3, statementDue: 5_000 });
    expect(late.level).toBe("action");
    expect(late.title).toMatch(/3 days (late|overdue)/i);
    for (const d of [12, 6, 1, 0, -3]) expect(cardDueWarning({ ...base, daysLeft: d, statementDue: 5_000 }).label).toMatch(/\w/);
  });

  it("uses plain, non-shaming, non-urgent-manufacturing wording", () => {
    for (const d of [3, 0, -2]) {
      const w = cardDueWarning({ ...base, daysLeft: d, statementDue: 9_000, minDue: 450 });
      expect(`${w.title} ${w.body}`).not.toMatch(/hurry|last chance|don't miss out|irresponsible|careless|!{2,}/i);
    }
  });

  it("omits the minimum when it is larger than or equal to the full amount or unknown", () => {
    expect(cardDueWarning({ ...base, daysLeft: 3, statementDue: 400, minDue: 400 }).body).not.toMatch(/minimum/i);
    expect(cardDueWarning({ ...base, daysLeft: 3, statementDue: 4_000 }).body).not.toMatch(/minimum/i);
  });
});

import { buildObligations, cardDueMonthKey } from "../src/app/lib/obligations";

describe("card obligations carry the statement amount only for the month it belongs to", () => {
  const now = new Date(2026, 9, 16, 10, 0, 0); // 16 Oct 2026
  const empty = { notes: [], structuredLoans: [], subscriptions: [], insurance: [], householdReminders: [], societyNotices: [], loans: [] };
  const card = { id: "c1", bankName: "HDFC", cardName: "Regalia", last4Digits: "4321", dueDate: 20, cardType: "credit" };

  it("includes amount and minimum when stamped for the upcoming due month", () => {
    const key = cardDueMonthKey(20, now);
    expect(key).toBe("2026-10");
    const o = buildObligations({ ...empty, creditCards: [{ ...card, statementDue: 18_400, minDue: 920, statementDueFor: key }] }, 35, 10, now).find((x) => x.id === "card:c1");
    expect(o?.amount).toBe(18_400);
    expect(o?.minDue).toBe(920);
  });

  it("ignores an old statement amount for a later month", () => {
    const o = buildObligations({ ...empty, creditCards: [{ ...card, statementDue: 18_400, minDue: 920, statementDueFor: "2026-09" }] }, 35, 10, now).find((x) => x.id === "card:c1");
    expect(o?.amount).toBeUndefined();
    expect(o?.minDue).toBeUndefined();
  });

  it("rolls the key forward once this month's due date has passed", () => {
    expect(cardDueMonthKey(5, now)).toBe("2026-11");
  });

  it("drops the card from obligations once this month's bill is marked paid", () => {
    const key = cardDueMonthKey(20, now);
    const list = buildObligations({ ...empty, creditCards: [{ ...card, statementDue: 18_400, statementDueFor: key, statementPaidFor: key }] }, 35, 10, now);
    expect(list.find((x) => x.id === "card:c1")).toBeUndefined();
  });
});
