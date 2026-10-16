/**
 * fy.ts — the Indian financial year (1 April – 31 March) and its statutory dates.
 *
 * Dates here are the USUAL statutory dates. The Income Tax Department sometimes extends them, so the UI
 * always labels them "usual due date" and points to the official portal.
 */
export type FY = {
  /** Calendar year in which the FY starts: FY 2026-27 → 2026. */
  startYear: number;
  label: string; // "FY 2026-27"
  from: string;  // YYYY-MM-DD, 1 April
  to: string;    // YYYY-MM-DD, 31 March
};

const pad = (n: number) => String(n).padStart(2, "0");

export function fyFromStartYear(startYear: number): FY {
  return {
    startYear,
    label: `FY ${startYear}-${pad((startYear + 1) % 100)}`,
    from: `${startYear}-04-01`,
    to: `${startYear + 1}-03-31`,
  };
}

/** The FY containing an ISO date (or Date). Jan–Mar belong to the FY that started the previous April. */
export function fyOf(d: string | Date): FY {
  const [y, m] = typeof d === "string" ? [Number(d.slice(0, 4)), Number(d.slice(5, 7))] : [d.getFullYear(), d.getMonth() + 1];
  return fyFromStartYear(m >= 4 ? y : y - 1);
}

export const currentFY = (now = new Date()): FY => fyOf(now);

export const shiftFY = (fy: FY, by: number): FY => fyFromStartYear(fy.startYear + by);

/** Twelve "YYYY-MM" keys of the FY, April first. */
export function fyMonthKeys(fy: FY): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((3 + i) % 12) + 1;
    const y = fy.startYear + (m >= 4 ? 0 : 1);
    return `${y}-${pad(m)}`;
  });
}

export const inFY = (date: string, fy: FY): boolean => {
  const d = date.slice(0, 10);
  return d >= fy.from && d <= fy.to;
};

export type Deadline = { id: string; date: string; title: string; detail: string; kind: "advance_tax" | "itr" };

/**
 * Tax deadlines that matter to an individual during/after `fy`.
 * Advance tax (cumulative % of the year's tax): 15 Jun 15%, 15 Sep 45%, 15 Dec 75%, 15 Mar 100%.
 * It applies only if the year's tax after TDS is ₹10,000 or more (resident senior citizens without
 * business income are exempt). ITR for non-audit individuals: usually 31 July after the FY ends.
 */
export function fyDeadlines(fy: FY): Deadline[] {
  const y = fy.startYear;
  return [
    { id: `adv1-${y}`, date: `${y}-06-15`, title: "Advance tax · 1st instalment", detail: "15% of the year's estimated tax", kind: "advance_tax" },
    { id: `adv2-${y}`, date: `${y}-09-15`, title: "Advance tax · 2nd instalment", detail: "45% cumulative", kind: "advance_tax" },
    { id: `adv3-${y}`, date: `${y}-12-15`, title: "Advance tax · 3rd instalment", detail: "75% cumulative", kind: "advance_tax" },
    { id: `adv4-${y}`, date: `${y + 1}-03-15`, title: "Advance tax · final instalment", detail: "100% cumulative", kind: "advance_tax" },
    { id: `itr-${y}`, date: `${y + 1}-07-31`, title: `ITR for ${fy.label}`, detail: "Usual due date for individuals not needing an audit", kind: "itr" },
  ];
}

/** Deadlines still ahead of `today` (YYYY-MM-DD), soonest first, with days remaining. */
export function upcomingDeadlines(today: string, count = 3, now = new Date()): Array<Deadline & { daysLeft: number }> {
  const base = Date.parse(`${today}T00:00:00Z`);
  const fy = fyOf(now);
  const all = [...fyDeadlines(shiftFY(fy, -1)), ...fyDeadlines(fy)];
  return all
    .map((d) => ({ ...d, daysLeft: Math.round((Date.parse(`${d.date}T00:00:00Z`) - base) / 86_400_000) }))
    .filter((d) => d.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, count);
}
