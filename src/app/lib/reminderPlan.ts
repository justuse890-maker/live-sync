/**
 * reminderPlan.ts — turns a note/bill reminder into the exact device alerts to schedule.
 *
 * Why this is its own file: alerts are scheduled on the phone (not by a server), so the plan must cover
 * several upcoming cycles of a repeating bill. That way a monthly rent reminder still rings next month even if
 * the app stays closed for weeks. The app re-plans every time it opens or anything changes.
 *
 * For a bill the user gets:
 *   • a heads-up `leadDays` before the due date (default 1) at the chosen time (default 09:00), and
 *   • a "due today" alert on the day.
 * If leadDays is 0 there is just the one alert on the day.
 */
import { addRepeat, anchorDay, isBill, Repeat } from "./notes";
import type { Note } from "./notes";

export const DEFAULT_TIMING = { leadDays: 1, time: "09:00" } as const;
export const LEAD_CHOICES = [0, 1, 2, 3, 7] as const;

/** Upcoming cycles planned per reminder. Phones cap pending alerts (~64), so repeating items get a short runway. */
export const CYCLES_AHEAD: Record<Repeat, number> = { none: 1, daily: 7, weekly: 5, monthly: 3, yearly: 1 };

export type PlannedAlert = {
  at: Date;
  /** Stable per (reminder, due date, kind) — used to derive a stable notification id. */
  key: string;
  title: string;
  body: string;
  /** 0 = the next due date, 1 = the one after… Lets the scheduler keep every reminder's next alert if it must trim. */
  cycle: number;
};

export function parseTime(time: string | undefined, fallback: string = DEFAULT_TIMING.time): { h: number; m: number } {
  for (const t of [time, fallback]) {
    const m = (t ?? "").match(/^(\d{1,2}):(\d{2})$/);
    if (m && +m[1] < 24 && +m[2] < 60) return { h: +m[1], m: +m[2] };
  }
  return { h: 9, m: 0 };
}

const at = (d: Date, h: number, m: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export const leadLabel = (days: number) => (days <= 0 ? "On the day" : days === 1 ? "1 day before" : `${days} days before`);

export function planForNote(n: Pick<Note, "id" | "title" | "body" | "amount" | "reminder" | "dueDay" | "archived">, now = new Date()): PlannedAlert[] {
  if (n.archived || !n.reminder) return [];
  const start = new Date(n.reminder.at);
  if (isNaN(start.getTime())) return [];

  const bill = isBill(n as Note);
  const repeat = n.reminder.repeat ?? "none";
  const lead = bill ? Math.max(0, Math.min(30, Math.round(n.reminder.leadDays ?? DEFAULT_TIMING.leadDays))) : 0;
  const custom = n.reminder.time ? parseTime(n.reminder.time) : null;
  const dueClock = custom ?? { h: start.getHours(), m: start.getMinutes() };   // the time the user picked for the due moment
  const headsUpClock = custom ?? parseTime(DEFAULT_TIMING.time);
  const anchor = n.dueDay ?? anchorDay(n as Note);
  const title = (n.title || n.body.slice(0, 40) || "Reminder").trim();
  const amt = bill && n.amount ? rupees(n.amount) : "";

  const out: PlannedAlert[] = [];
  let due = new Date(start);
  let planned = 0;
  for (let guard = 0; guard < 400 && planned < CYCLES_AHEAD[repeat]; guard++) {
    const dueAt = at(due, dueClock.h, dueClock.m);
    const cycleAlerts: Omit<PlannedAlert, "cycle">[] = [];

    if (lead > 0) {
      const d = new Date(due); d.setDate(d.getDate() - lead);
      cycleAlerts.push({
        at: at(d, headsUpClock.h, headsUpClock.m),
        key: `note:${n.id}:${ymd(due)}:pre`,
        title: `Due ${lead === 1 ? "tomorrow" : `in ${lead} days`} · ${title}`,
        body: amt ? `${amt} is due ${lead === 1 ? "tomorrow" : `in ${lead} days`}. Tap to review.` : `Due ${lead === 1 ? "tomorrow" : `in ${lead} days`}. Tap to review.`,
      });
    }
    cycleAlerts.push({
      at: dueAt,
      key: `note:${n.id}:${ymd(due)}:due`,
      title: bill ? `Due today · ${title}` : `⏰ ${title}`,
      body: bill ? (amt ? `Pay ${amt} today.` : "Due today.") : "Reminder from your notes",
    });

    const future = cycleAlerts.filter((a) => a.at.getTime() > now.getTime());
    if (future.length) { future.forEach((a) => out.push({ ...a, cycle: planned })); planned++; }
    if (repeat === "none") break;
    due = addRepeat(due, repeat, anchor);
  }
  return out;
}
