import { describe, expect, it } from "vitest";
import { answer, monthFacts, monthlyGreeting, parseAmount, recap, resolveMonth } from "../src/app/lib/sparrow";

const NOW = new Date(2026, 9, 10); // 10 Oct 2026
const t = (date: string, type: string, title: string, category: string, amount: number, extra: any = {}) => ({ date, type, title, category, amount: type === "expense" ? -amount : amount, ...extra });
const txs = [
  // September
  t("2026-09-01", "income", "Salary", "Salary", 100_000),
  t("2026-09-03", "expense", "Rent", "Rent", 30_000),
  t("2026-09-05", "expense", "HDFC EMI", "EMI", 20_000, { loanId: "L1" }),
  t("2026-09-08", "expense", "Swiggy", "Food", 6_000),
  t("2026-09-10", "expense", "SIP", "SIP", 10_000),
  t("2026-09-12", "expense", "Self transfer", "Transfer", 50_000, { isTransfer: true }),
  // August
  t("2026-08-01", "income", "Salary", "Salary", 100_000),
  t("2026-08-03", "expense", "Rent", "Rent", 30_000),
  t("2026-08-08", "expense", "Swiggy", "Food", 3_000),
  // October
  t("2026-10-01", "income", "Salary", "Salary", 100_000),
  t("2026-10-04", "expense", "Petrol", "Travel", 2_500),
  t("2026-10-06", "expense", "Zomato", "Food", 1_500),
];
const ask = (q: string, extra: any = {}) => answer(q, { txs, now: NOW, ...extra });

describe("monthFacts", () => {
  const f = monthFacts(txs, "2026-09");
  it("totals the month and never counts transfers", () => {
    expect(f).toMatchObject({ income: 100_000, expense: 66_000, invested: 10_000, emis: 20_000, net: 34_000, entries: 5 });
  });
  it("ranks categories and finds the biggest real spend (not an investment)", () => {
    expect(f.categories[0]).toEqual({ name: "Rent", amount: 30_000 });
    expect(f.biggest).toMatchObject({ title: "Rent", amount: 30_000 });
  });
});

describe("resolveMonth", () => {
  it("understands last month in English and Hinglish, and month names", () => {
    expect(resolveMonth("what happened last month", NOW)).toBe("2026-09");
    expect(resolveMonth("pichle mahine kitna kharch hua", NOW)).toBe("2026-09");
    expect(resolveMonth("how was august", NOW)).toBe("2026-08");
    expect(resolveMonth("show me December", NOW)).toBe("2025-12"); // not a future month
    expect(resolveMonth("how much did I spend", NOW)).toBe("2026-10");
  });
});

describe("parseAmount", () => {
  it("reads Indian ways of writing money", () => {
    expect(parseAmount("8,000 for a trip")).toBe(8000);
    expect(parseAmount("15k phone")).toBe(15000);
    expect(parseAmount("1.5 lakh bike")).toBe(150000);
    expect(parseAmount("₹ 2 lac")).toBe(200000);
    expect(parseAmount("a phone")).toBeNull();
  });
});

describe("recap", () => {
  const r = recap(txs, "2026-09");
  it("explains the month from the real figures", () => {
    expect(r.text).toContain("September 2026");
    expect(r.text).toContain("₹1,00,000 came in and ₹66,000 went out");
    expect(r.text).toContain("You kept ₹34,000 — that's 34%");
    expect(r.text).toContain("₹10,000 of the spending went into savings");
    expect(r.text).toContain("EMIs and repayments took ₹20,000 (20% of income)");
    expect(r.mood).toBe("happy");
  });
  it("compares with the month before and names what moved most", () => {
    expect(r.text).toContain("up 100% on August 2026");
    expect(r.text).toMatch(/EMI changed the most: up ₹20,000/);
  });
  it("is honest about an empty month and worried about overspending", () => {
    expect(recap(txs, "2026-01").text).toMatch(/don't have anything recorded/);
    const over = recap([t("2026-07-01", "income", "S", "Salary", 10_000), t("2026-07-02", "expense", "X", "Shopping", 15_000)], "2026-07");
    expect(over.text).toContain("₹5,000 more than you earned");
    expect(over.mood).toBe("concerned");
  });
});

describe("answer", () => {
  it("what happened last month → the recap", () => {
    expect(ask("What happened last month?")!.text).toContain("September 2026");
    expect(ask("pichle mahine kya hua")!.text).toContain("September 2026");
  });

  it("category questions, with a comparison", () => {
    const r = ask("How much did I spend on food last month?")!;
    expect(r.text).toContain("₹6,000 on food in September 2026");
    expect(r.text).toContain("up ₹3,000 on August 2026");
    expect(ask("petrol pe kitna kharch")!.text).toContain("₹2,500 on fuel in October 2026");
    expect(ask("how much on medical")!.text).toMatch(/Nothing recorded for medical/);
  });

  it("savings, income, EMI, biggest, breakdown, total", () => {
    expect(ask("How much did I save last month?")!.text).toContain("kept ₹34,000 of ₹1,00,000 — 34%");
    expect(ask("how much did I earn in august")!.text).toContain("₹1,00,000 came in during August 2026");
    expect(ask("emi last month")!.text).toContain("₹20,000 in September 2026 — 20% of income");
    expect(ask("biggest expense last month")!.text).toContain("Rent: ₹30,000");
    expect(ask("where did my money go last month")!.text).toContain("• Rent: ₹30,000 (45%)");
    expect(ask("how much did I spend this month")!.text).toContain("₹4,000 in October 2026");
  });

  it("can I afford — shows the maths and counts bills still due", () => {
    const yes = ask("Can I afford 8,000 for a trip?", { stillToPay: 30_000 })!;
    expect(yes.text).toContain("₹1,00,000 in − ₹4,000 spent − ₹30,000 still to pay = ₹66,000 free");
    expect(yes.text).toContain("still have ₹58,000");
    expect(yes.mood).toBe("happy");
    const no = ask("can I afford 1.5 lakh bike", { stillToPay: 30_000 })!;
    expect(no.text).toContain("₹84,000 short");
    expect(no.mood).toBe("concerned");
    expect(ask("can I afford a phone")!.text).toMatch(/Tell me the amount/);
  });

  it("returns null for things it cannot work out, so the caller can use the user's own AI", () => {
    expect(ask("should I invest in gold or mutual funds?")).toBeNull();
    expect(ask("")).toBeNull();
  });
});

describe("monthlyGreeting", () => {
  it("greets with last month's result in the first week only", () => {
    const g = monthlyGreeting(txs, new Date(2026, 9, 3))!;
    expect(g).toMatchObject({ key: "2026-09", mood: "happy" });
    expect(g.text).toContain("September is done: you kept ₹34,000 of ₹1,00,000 (34%)");
    expect(monthlyGreeting(txs, new Date(2026, 9, 8))).toBeNull();
  });
  it("stays quiet with no data, and is honest about overspending or missing income", () => {
    expect(monthlyGreeting([], new Date(2026, 9, 3))).toBeNull();
    const over = [t("2026-09-01", "income", "S", "Salary", 10_000), t("2026-09-02", "expense", "X", "Shopping", 15_000)];
    expect(monthlyGreeting(over, new Date(2026, 9, 2))).toMatchObject({ mood: "concerned" });
    expect(monthlyGreeting([over[1]], new Date(2026, 9, 2))!.text).toContain("you spent ₹15,000");
  });
});
