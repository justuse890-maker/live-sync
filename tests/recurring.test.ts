import { describe, expect, it } from "vitest";
import { detectRecurring, billRises } from "../src/app/lib/recurring";

const e = (date: string, amount: number, title: string, extra: Record<string, unknown> = {}) => ({ type: "expense", amount: -amount, date, title, category: "Subscriptions", ...extra });
const now = new Date(2026, 9, 16);

describe("detectRecurring", () => {
  it("finds a monthly fixed bill after three regular payments", () => {
    const s = detectRecurring([e("2026-08-05", 649, "Netflix"), e("2026-09-05", 649, "Netflix"), e("2026-10-05", 649, "Netflix")], now);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ label: "Netflix", status: "mature", count: 3 });
  });
  it("two payments is only an early guess", () => {
    const s = detectRecurring([e("2026-09-05", 649, "Netflix"), e("2026-10-05", 649, "Netflix")], now);
    expect(s[0].status).toBe("early");
  });
  it("marks a stream stale when the expected payment never came", () => {
    const s = detectRecurring([e("2026-05-05", 649, "Hotstar"), e("2026-06-05", 649, "Hotstar"), e("2026-07-05", 649, "Hotstar")], now);
    expect(s[0].status).toBe("stale");
  });
  it("does not treat frequent, irregular merchants as bills", () => {
    const rows = ["2026-10-01", "2026-10-03", "2026-10-06", "2026-10-09", "2026-10-12"].map((d, i) => e(d, 100 + i * 70, "Swiggy", { category: "Food" }));
    expect(detectRecurring(rows, now)).toHaveLength(0);
  });
  it("ignores transfers and income, and tolerates non-text titles", () => {
    const rows = [e("2026-08-05", 500, "Own", { isTransfer: true }), e("2026-09-05", 500, "Own", { isTransfer: true }), { type: "income", amount: 500, date: "2026-10-05", title: "Own", category: "x" }, { ...e("2026-09-05", 10, "x"), title: 453453, merchant: 453453 }];
    expect(() => detectRecurring(rows as any, now)).not.toThrow();
    expect(detectRecurring(rows as any, now)).toHaveLength(0);
  });
});

describe("billRises", () => {
  it("flags a fixed bill whose latest payment is clearly higher than usual", () => {
    const s = detectRecurring([e("2026-07-05", 649, "Netflix"), e("2026-08-05", 649, "Netflix"), e("2026-09-05", 649, "Netflix"), e("2026-10-05", 799, "Netflix")], now);
    const r = billRises(s);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ label: "Netflix", previous: 649, latest: 799 });
    expect(Math.round(r[0].risePct)).toBe(23);
  });
  it("ignores small changes and bills whose amount always varies", () => {
    const small = detectRecurring([e("2026-07-05", 649, "A"), e("2026-08-05", 649, "A"), e("2026-09-05", 649, "A"), e("2026-10-05", 660, "A")], now);
    expect(billRises(small)).toHaveLength(0);
    const varying = detectRecurring([e("2026-07-05", 800, "Electricity"), e("2026-08-05", 1500, "Electricity"), e("2026-09-05", 1100, "Electricity"), e("2026-10-05", 2000, "Electricity")], now);
    expect(billRises(varying)).toHaveLength(0);
  });
  it("needs a mature stream: two payments is not enough to call a rise", () => {
    const early = detectRecurring([e("2026-09-05", 649, "B"), e("2026-10-05", 999, "B")], now);
    expect(billRises(early)).toHaveLength(0);
  });
});
