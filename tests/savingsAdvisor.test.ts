import { describe, expect, it } from "vitest";
import { inferGoalKind, monthlyNeeded, monthsUntil, recommend, VEHICLES } from "../src/app/lib/savingsAdvisor";

const ids = (r: ReturnType<typeof recommend>) => r.map((x) => x.vehicle.id);

describe("savings advisor", () => {
  it("classifies goals from their name", () => {
    expect(inferGoalKind("Emergency Fund")).toBe("emergency");
    expect(inferGoalKind("Daughter's education")).toBe("child_education");
    expect(inferGoalKind("House down payment")).toBe("home");
    expect(inferGoalKind("Goa trip")).toBe("travel");
    expect(inferGoalKind("Something else")).toBe("general");
  });
  it("keeps emergency money liquid", () => {
    const r = recommend({ name: "Emergency fund", targetAmount: 300000, monthsLeft: 12 });
    expect(ids(r)[0]).toBe("bank_savings");
    expect(r.every((x) => x.vehicle.id !== "index_sip" && x.vehicle.id !== "ppf")).toBe(true);
  });
  it("recommends SSY first for a daughter's long-term education goal", () => {
    expect(ids(recommend({ name: "Daughter's education", targetAmount: 2000000, monthsLeft: 120 }))[0]).toBe("ssy");
  });
  it("never puts a short-term home goal into equity", () => {
    const r = recommend({ name: "House down payment", targetAmount: 800000, monthsLeft: 48 });
    expect(ids(r)).not.toContain("index_sip");
    expect(r.every((x) => x.vehicle.risk === "Guaranteed" || x.vehicle.id === "debt_fund")).toBe(true);
  });
  it("matches the instrument to the horizon", () => {
    expect(ids(recommend({ name: "Vacation", targetAmount: 50000, monthsLeft: 4 }))[0]).toBe("bank_savings");
    expect(ids(recommend({ name: "Vacation", targetAmount: 50000, monthsLeft: 10 }))[0]).toBe("bank_fd");
    expect(ids(recommend({ name: "Car", targetAmount: 500000, monthsLeft: 30 }))[0]).toBe("po_td");
    expect(ids(recommend({ name: "Retirement", targetAmount: 5e6, monthsLeft: 240 }))[0]).toBe("ppf");
  });
  it("offers SCSS only to seniors", () => {
    expect(ids(recommend({ name: "Retirement", targetAmount: 5e6, monthsLeft: 120 }))).not.toContain("scss");
    expect(ids(recommend({ name: "Retirement", targetAmount: 5e6, monthsLeft: 120, senior: true }))).toContain("scss");
  });
  it("a higher rate needs a smaller monthly deposit, and the maths is right", () => {
    expect(monthlyNeeded(120000, 12, 0)).toBe(10000);
    expect(monthlyNeeded(120000, 12, 7)).toBeLessThan(10000);
    const r = recommend({ name: "Vacation", targetAmount: 120000, monthsLeft: 12 });
    expect(r[0].monthlyNeeded).toBeLessThan(10000);
    expect(r[0].extraEarned).toBeGreaterThan(0);
  });
  it("labels market-linked products honestly and always returns something", () => {
    expect(VEHICLES.index_sip.risk).toBe("Market-linked");
    expect(recommend({ name: "x", targetAmount: 1000, monthsLeft: null }).length).toBeGreaterThan(0);
  });
  it("computes months until a date", () => {
    const now = new Date(2026, 9, 9);
    expect(monthsUntil("2027-10-09", now)).toBe(12);
    expect(monthsUntil("2026-01-01", now)).toBeNull();
    expect(monthsUntil(undefined, now)).toBeNull();
  });
});
