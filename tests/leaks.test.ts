import { describe, expect, it } from "vitest";
import { detectLeaks, detectOverlappingServices } from "../src/app/lib/intelligence";

const NOW = new Date(2026, 9, 10);
const tx = (o: any) => ({ id: Math.random().toString(36), type: "expense", amount: -100, date: "2026-10-05", category: "Other", title: "x", ...o });

describe("overlapping services", () => {
  const subs = [
    { id: "1", name: "Netflix", cost: 649, period: "monthly", status: "active" },
    { id: "2", name: "Amazon Prime Video", cost: 1499, period: "yearly", status: "active" },
    { id: "3", name: "Spotify", cost: 119, period: "monthly", status: "active" },
    { id: "4", name: "YouTube Music", cost: 99, period: "monthly", status: "cancelled" },
  ];

  it("flags two active services in one family, counting only the cost of the extras", () => {
    const l = detectOverlappingServices(subs);
    expect(l).toHaveLength(1);
    expect(l[0].id).toBe("dup-video");
    expect(l[0].annual).toBe(1499);               // Netflix ₹7,788/yr is kept, Prime ₹1,499 is the extra
    expect(l[0].tip).toContain("Netflix");
  });

  it("a cancelled service doesn't count, and a single service is fine", () => {
    expect(detectOverlappingServices(subs).some((x) => x.id === "dup-music")).toBe(false);
  });

  it("is part of detectLeaks, without double-counting anything already marked duplicate", () => {
    const { leaks } = detectLeaks([], [...subs, { id: "5", name: "Hotstar", cost: 299, period: "monthly", status: "duplicate" }], [], [], NOW);
    expect(leaks.some((l) => l.id === "dup-video")).toBe(true);
    expect(leaks.filter((l) => l.id === "sub-5")).toHaveLength(1);
  });
});

describe("spending leaks use a monthly average, not the whole history", () => {
  // Food spend of ₹8,000 a month for six months. The old code summed all six (₹48,000) and multiplied by 12.
  const history = [0, 1, 2, 3, 4, 5].map((m) => tx({ category: "Food", title: "Swiggy", amount: -8000, date: `2026-${String(10 - m).padStart(2, "0")}-05` }));

  it("food overspend is judged per month over the last three months", () => {
    const { leaks } = detectLeaks(history as any, [], [], [], NOW);
    const food = leaks.find((l) => l.id === "food-excess")!;
    expect(food.annual).toBe((8000 - 4500) * 12);   // ₹42,000/yr, not ₹5,04,000
  });

  it("a single month of data works the same", () => {
    const { leaks } = detectLeaks([history[0]] as any, [], [], [], NOW);
    expect(leaks.find((l) => l.id === "food-excess")!.annual).toBe(42000);
  });

  it("old months outside the window are ignored", () => {
    const { leaks } = detectLeaks([tx({ category: "Food", amount: -30000, date: "2026-03-05" })] as any, [], [], [], NOW);
    expect(leaks.some((l) => l.id === "food-excess")).toBe(false);
  });

  it("bank charges and cabs use the same monthly basis", () => {
    const rows = [0, 1, 2].flatMap((m) => [
      tx({ title: "ATM charge", amount: -300, date: `2026-${String(10 - m).padStart(2, "0")}-02` }),
      tx({ title: "Uber", amount: -5000, date: `2026-${String(10 - m).padStart(2, "0")}-03` }),
    ]);
    const { leaks } = detectLeaks(rows as any, [], [], [], NOW);
    expect(leaks.find((l) => l.id === "bank-fees")!.annual).toBe(300 * 12);
    expect(leaks.find((l) => l.id === "rides-excess")!.annual).toBe((5000 - 2500) * 12);
  });
});
