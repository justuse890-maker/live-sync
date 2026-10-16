/**
 * notes.ts — Keep-style notes with reminders and recurring bills.
 *
 * A Note can be a plain note, a checklist, or a *bill* (has an amount). Any
 * note can carry a reminder. Repeating reminders behave like Google Keep:
 *  - plain notes roll forward automatically once the reminder time passes;
 *  - bills stay "overdue" until the user marks them Paid (which logs the
 *    expense and rolls the bill to its next due date) or Skips the cycle.
 */

export type Repeat = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type NoteColor =
  | "default" | "coral" | "peach" | "sand" | "mint" | "sage" | "fog" | "storm" | "dusk" | "blossom";

export const NOTE_COLORS: Record<NoteColor, { bg: string; border: string; label: string }> = {
  default: { bg: "#FFFFFF", border: "#E2E8F0", label: "Default" },
  coral: { bg: "#FAAFA8", border: "#F28B82", label: "Coral" },
  peach: { bg: "#F39F76", border: "#F28B5B", label: "Peach" },
  sand: { bg: "#FFF8B8", border: "#F5E58A", label: "Sand" },
  mint: { bg: "#E2F6D3", border: "#C4E8AC", label: "Mint" },
  sage: { bg: "#B4DDD3", border: "#8FC9BA", label: "Sage" },
  fog: { bg: "#D4E4ED", border: "#B3CFDE", label: "Fog" },
  storm: { bg: "#AECCDC", border: "#8DB6CC", label: "Storm" },
  dusk: { bg: "#D3BFDB", border: "#BFA3CB", label: "Dusk" },
  blossom: { bg: "#F6E2DD", border: "#EBCBC3", label: "Blossom" },
};

export type ChecklistItem = { id: string; text: string; done: boolean };

export type NoteReminder = {
  /** ISO datetime of the next occurrence */
  at: string;
  repeat: Repeat;
  /** Bills: how many days before the due date to alert (0 = only on the day). Default 1. */
  leadDays?: number;
  /** Time of day for the alerts, "HH:MM" (24h). Default: 09:00 for the heads-up, the due time on the day. */
  time?: string;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  color: NoteColor;
  pinned: boolean;
  archived: boolean;
  labels: string[];
  checklist?: ChecklistItem[];
  /** If set, the note is a bill / payment. */
  amount?: number;
  category?: string;
  reminder?: NoteReminder;
  /** For bills: history of paid cycles (ISO date of the due date that was paid). */
  paidCycles?: string[];
  lastPaidAt?: string;
  /** Day of month a monthly bill is due — keeps "31st" stable across short months. */
  dueDay?: number;
  createdAt: string;
  updatedAt: string;
};

export const BILL_TEMPLATES: Array<{ title: string; category: string; emoji: string; day: number }> = [
  { title: "Home loan EMI", category: "EMI", emoji: "🏦", day: 5 },
  { title: "Home rent", category: "Rent", emoji: "🏠", day: 1 },
  { title: "Electricity bill", category: "Utilities", emoji: "⚡", day: 10 },
  { title: "Credit card bill", category: "Credit Card", emoji: "💳", day: 15 },
  { title: "Mobile / Internet", category: "Utilities", emoji: "📶", day: 20 },
  { title: "Maid salary", category: "Maid Salary", emoji: "🧹", day: 1 },
  { title: "School fees", category: "Tuition", emoji: "🎒", day: 10 },
  { title: "Insurance premium", category: "Insurance", emoji: "🛡️", day: 25 },
];

export function addRepeat(d: Date, repeat: Repeat, originalDay?: number): Date {
  const n = new Date(d);
  switch (repeat) {
    case "daily": n.setDate(n.getDate() + 1); break;
    case "weekly": n.setDate(n.getDate() + 7); break;
    case "monthly": {
      const day = originalDay ?? d.getDate();
      n.setDate(1);
      n.setMonth(n.getMonth() + 1);
      const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
      n.setDate(Math.min(day, last)); // 31st → 30th/28th in short months
      break;
    }
    case "yearly": n.setFullYear(n.getFullYear() + 1); break;
    default: break;
  }
  return n;
}

export const isBill = (n: Note) => typeof n.amount === "number" && n.amount > 0;

/** Day-of-month the user originally chose (kept across short months). */
export function anchorDay(n: Note): number | undefined {
  if (n.dueDay) return n.dueDay;
  return n.reminder ? new Date(n.reminder.at).getDate() : undefined;
}

/**
 * Keep-style auto-roll for non-bill repeating reminders. Returns an updated
 * note if the reminder moved, otherwise null.
 */
export function rollForwardIfDue(n: Note, now = new Date()): Note | null {
  if (!n.reminder || n.reminder.repeat === "none" || isBill(n) || n.archived) return null;
  let at = new Date(n.reminder.at);
  if (at > now) return null;
  const day = anchorDay(n);
  let guard = 0;
  while (at <= now && guard++ < 500) at = addRepeat(at, n.reminder.repeat, day);
  return { ...n, reminder: { ...n.reminder, at: at.toISOString() }, updatedAt: new Date().toISOString() };
}

/** Bill paid → record the cycle and move to the next due date (or archive one-offs). */
export function markBillPaid(n: Note, now = new Date()): Note {
  const paidCycles = [...(n.paidCycles ?? [])];
  if (n.reminder) paidCycles.push(n.reminder.at.slice(0, 10));
  if (!n.reminder || n.reminder.repeat === "none") {
    return { ...n, paidCycles, lastPaidAt: now.toISOString(), archived: true, updatedAt: now.toISOString() };
  }
  const next = addRepeat(new Date(n.reminder.at), n.reminder.repeat, anchorDay(n));
  return {
    ...n,
    paidCycles: paidCycles.slice(-24),
    lastPaidAt: now.toISOString(),
    reminder: { ...n.reminder, at: next.toISOString() },
    updatedAt: now.toISOString(),
  };
}

export function skipCycle(n: Note): Note {
  if (!n.reminder || n.reminder.repeat === "none") return { ...n, reminder: undefined, updatedAt: new Date().toISOString() };
  const next = addRepeat(new Date(n.reminder.at), n.reminder.repeat, anchorDay(n));
  return { ...n, reminder: { ...n.reminder, at: next.toISOString() }, updatedAt: new Date().toISOString() };
}

export function formatReminder(at: string, now = new Date()): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(now)) / 86400000);
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Tomorrow, ${time}`;
  if (diffDays === -1) return `Yesterday, ${time}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })}, ${time}`;
}

export const REPEAT_LABEL: Record<Repeat, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function emptyNote(partial: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return {
    id: "",
    title: "",
    body: "",
    color: "default",
    pinned: false,
    archived: false,
    labels: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}
