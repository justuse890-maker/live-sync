import { describe, expect, it } from "vitest";
import { planForNote, parseTime, CYCLES_AHEAD } from "../src/app/lib/reminderPlan";

const NOW = new Date(2026, 9, 10, 12, 0); // 10 Oct 2026, 12:00
const bill = (o: any = {}) => ({
  id: "n1", title: "Electricity", body: "", amount: 1240, archived: false, dueDay: undefined as number | undefined,
  reminder: { at: new Date(2026, 10, 12, 9, 0).toISOString(), repeat: "monthly" as const, ...o.reminder }, ...o.note,
});
const stamp = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

describe("parseTime", () => {
  it("reads HH:MM and falls back safely", () => {
    expect(parseTime("18:30")).toEqual({ h: 18, m: 30 });
    expect(parseTime("7:05")).toEqual({ h: 7, m: 5 });
    expect(parseTime("25:00")).toEqual({ h: 9, m: 0 });
    expect(parseTime(undefined)).toEqual({ h: 9, m: 0 });
  });
});

describe("planForNote — bills", () => {
  it("default: a heads-up the day before at 9 AM and a due-day alert, for three monthly cycles", () => {
    const p = planForNote(bill(), NOW);
    expect(p).toHaveLength(CYCLES_AHEAD.monthly * 2);
    expect(p.slice(0, 2).map((a) => stamp(a.at))).toEqual(["2026-11-11 09:00", "2026-11-12 09:00"]);
    expect(p[0].title).toBe("Due tomorrow · Electricity");
    expect(p[0].body).toBe("₹1,240 is due tomorrow. Tap to review.");
    expect(p[1].title).toBe("Due today · Electricity");
    expect(p[1].body).toBe("Pay ₹1,240 today.");
  });

  it("the next cycles keep the same day of month, clamped in short months", () => {
    const p = planForNote(bill({ reminder: { at: new Date(2026, 9, 31, 9, 0).toISOString() }, note: { dueDay: 31 } }), new Date(2026, 9, 1));
    const dues = p.filter((a) => a.key.endsWith(":due")).map((a) => stamp(a.at).slice(0, 10));
    expect(dues).toEqual(["2026-10-31", "2026-11-30", "2026-12-31"]);
  });

  it("honours the lead days and the time of day the user chose", () => {
    const p = planForNote(bill({ reminder: { leadDays: 3, time: "18:30" } }), NOW);
    expect(stamp(p[0].at)).toBe("2026-11-09 18:30");
    expect(p[0].title).toBe("Due in 3 days · Electricity");
    expect(stamp(p[1].at)).toBe("2026-11-12 18:30");
  });

  it("lead 0 means a single alert on the day", () => {
    const p = planForNote(bill({ reminder: { leadDays: 0 } }), NOW);
    expect(p).toHaveLength(CYCLES_AHEAD.monthly);
    expect(p.every((a) => a.key.endsWith(":due"))).toBe(true);
  });

  it("weekly and daily bills plan their own number of cycles", () => {
    const daily = planForNote(bill({ reminder: { repeat: "daily", at: new Date(2026, 9, 11, 9, 0).toISOString() } }), NOW);
    expect(new Set(daily.map((a) => a.cycle)).size).toBe(CYCLES_AHEAD.daily);
    const weekly = planForNote(bill({ reminder: { repeat: "weekly", at: new Date(2026, 9, 14, 9, 0).toISOString() } }), NOW);
    expect(new Set(weekly.map((a) => a.cycle)).size).toBe(CYCLES_AHEAD.weekly);
    expect(stamp(weekly.filter((a) => a.key.endsWith(":due"))[1].at).slice(0, 10)).toBe("2026-10-21");
  });

  it("a one-off bill alerts once; a past due date alerts never; cancelled/archived never", () => {
    expect(planForNote(bill({ reminder: { repeat: "none" } }), NOW)).toHaveLength(2);
    expect(planForNote(bill({ reminder: { repeat: "none", at: new Date(2026, 9, 1).toISOString() } }), NOW)).toHaveLength(0);
    expect(planForNote(bill({ note: { archived: true } }), NOW)).toHaveLength(0);
  });

  it("an overdue unpaid repeating bill still schedules its FUTURE cycles", () => {
    const p = planForNote(bill({ reminder: { at: new Date(2026, 9, 5, 9, 0).toISOString() } }), NOW);
    expect(stamp(p.find((a) => a.key.endsWith(":due"))!.at).slice(0, 10)).toBe("2026-11-05");
  });

  it("skips a heads-up that is already in the past but keeps the due alert", () => {
    const p = planForNote(bill({ reminder: { at: new Date(2026, 9, 11, 9, 0).toISOString() } }), NOW); // due tomorrow 9:00, heads-up was today 9:00 (past)
    expect(stamp(p[0].at)).toBe("2026-10-11 09:00");
    expect(p[0].key.endsWith(":due")).toBe(true);
  });

  it("keys are stable and unique", () => {
    const a = planForNote(bill(), NOW), b = planForNote(bill(), NOW);
    expect(a.map((x) => x.key)).toEqual(b.map((x) => x.key));
    expect(new Set(a.map((x) => x.key)).size).toBe(a.length);
  });
});

describe("planForNote — plain reminders", () => {
  it("alerts at the exact time chosen, with no heads-up", () => {
    const p = planForNote({ id: "r1", title: "Call CA", body: "", amount: undefined, archived: false, dueDay: undefined, reminder: { at: new Date(2026, 9, 12, 17, 45).toISOString(), repeat: "none" } }, NOW);
    expect(p).toHaveLength(1);
    expect(stamp(p[0].at)).toBe("2026-10-12 17:45");
    expect(p[0].title).toBe("⏰ Call CA");
  });
});
