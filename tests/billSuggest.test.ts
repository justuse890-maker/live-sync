import { describe, expect, it } from "vitest";
import { firstDueDate, noteFromOffer, reminderOfferFor, suggestRepeat } from "../src/app/lib/billSuggest";

const NOW = new Date(2026, 9, 10, 12, 0);
const stamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const spend = (o: any = {}) => ({ type: "expense", amount: -1240, date: "2026-10-10", title: "Electricity", category: "Utilities", ...o });

describe("reminderOfferFor", () => {
  it("offers a reminder for an ordinary expense, with a monthly suggestion", () => {
    expect(reminderOfferFor(spend(), [])).toEqual({ title: "Electricity", amount: 1240, category: "Utilities", paidOn: "2026-10-10", suggestedRepeat: "monthly" });
  });

  it("prefers the merchant as the title and falls back to the category", () => {
    expect(reminderOfferFor(spend({ merchant: "BESCOM" }), [])!.title).toBe("BESCOM");
    expect(reminderOfferFor(spend({ title: "", merchant: "" }), [])!.title).toBe("Utilities");
  });

  it("does not ask for income, transfers, loan EMIs, or zero amounts", () => {
    expect(reminderOfferFor(spend({ type: "income" }), [])).toBeNull();
    expect(reminderOfferFor(spend({ isTransfer: true }), [])).toBeNull();
    expect(reminderOfferFor(spend({ loanId: "L1" }), [])).toBeNull();
    expect(reminderOfferFor(spend({ amount: 0 }), [])).toBeNull();
  });

  it("does not ask again when a reminder for it already exists (same title, or same category and amount)", () => {
    const existing = (o: any) => [{ title: "Electricity", amount: 1240, category: "Utilities", archived: false, reminder: { at: "2026-11-10T09:00:00", repeat: "monthly" as const }, ...o }];
    expect(reminderOfferFor(spend(), existing({}))).toBeNull();
    expect(reminderOfferFor(spend({ title: "Power bill" }), existing({ title: "Other name" }))).toBeNull();      // same category + amount
    expect(reminderOfferFor(spend({ amount: -9000 }), existing({ title: "Other name" }))).not.toBeNull();         // different amount
    expect(reminderOfferFor(spend(), existing({ archived: true }))).not.toBeNull();                               // archived doesn't count
  });
});

describe("suggestRepeat", () => {
  it("monthly by default, and respects words that say otherwise", () => {
    expect(suggestRepeat("Rent", "Home rent")).toBe("monthly");
    expect(suggestRepeat("SIP", "Nifty SIP")).toBe("monthly");
    expect(suggestRepeat("Insurance", "Annual premium")).toBe("yearly");
    expect(suggestRepeat("Other", "Weekly vegetables")).toBe("weekly");
    expect(suggestRepeat("Other", "Daily newspaper")).toBe("daily");
  });
});

describe("firstDueDate", () => {
  it("is one period after the payment, at the chosen time", () => {
    expect(stamp(firstDueDate("2026-10-10", "monthly", "09:00", NOW))).toBe("2026-11-10 09:00");
    expect(stamp(firstDueDate("2026-10-10", "weekly", "18:30", NOW))).toBe("2026-10-17 18:30");
    expect(stamp(firstDueDate("2026-10-10", "daily", "08:00", NOW))).toBe("2026-10-11 08:00");
    expect(stamp(firstDueDate("2026-10-10", "yearly", "09:00", NOW))).toBe("2027-10-10 09:00");
  });
  it("clamps the 31st in short months and rolls past dates forward", () => {
    expect(stamp(firstDueDate("2026-10-31", "monthly", "09:00", NOW))).toBe("2026-11-30 09:00");
    expect(stamp(firstDueDate("2026-01-15", "monthly", "09:00", NOW))).toBe("2026-10-15 09:00"); // backdated entry: rolls forward to the first date still ahead
  });
});

describe("noteFromOffer", () => {
  it("builds a bill reminder carrying the user's choices", () => {
    const draft = reminderOfferFor(spend(), [])!;
    const n = noteFromOffer(draft, { repeat: "monthly", leadDays: 2, time: "18:30" }, NOW);
    expect(n).toMatchObject({ title: "Electricity", amount: 1240, category: "Utilities", dueDay: 10, id: "" });
    expect(n.reminder).toMatchObject({ repeat: "monthly", leadDays: 2, time: "18:30" });
    expect(stamp(new Date(n.reminder!.at))).toBe("2026-11-10 18:30");
  });
  it("only monthly bills carry a due day", () => {
    const draft = reminderOfferFor(spend(), [])!;
    expect(noteFromOffer(draft, { repeat: "weekly", leadDays: 1, time: "09:00" }, NOW).dueDay).toBeUndefined();
  });
});
