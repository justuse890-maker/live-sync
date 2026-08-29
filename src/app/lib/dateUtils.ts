/**
 * Universal date utilities for LiveSync AI.
 * Uses local calendar math (no UTC timezone shift bugs).
 */

const MONTH_MAP: Record<string, string> = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12",
};

const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Returns "YYYY-MM" from a local Date object.
 */
export function getMonthString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Returns the current month key in "YYYY-MM" format using local date.
 */
export function getCurrentMonthKey(): string {
  return getMonthString(new Date());
}

/**
 * Shifts a "YYYY-MM" string by delta months without UTC timezone distortion.
 * e.g. shiftMonth("2026-08", -1) -> "2026-07"
 */
export function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = (monthStr || getCurrentMonthKey()).split("-").map(Number);
  if (isNaN(y) || isNaN(m)) return getCurrentMonthKey();
  const d = new Date(y, m - 1 + delta, 1);
  return getMonthString(d);
}

/**
 * Converts any arbitrary date string into a consistent "YYYY-MM" key.
 */
export function getMonthKey(dateStr?: string | null, fallbackMonth?: string): string {
  if (!dateStr || typeof dateStr !== "string") {
    return fallbackMonth || getCurrentMonthKey();
  }
  const s = dateStr.trim();
  if (!s) return fallbackMonth || getCurrentMonthKey();

  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
  if (/^\d{4}\/\d{2}\/\d{2}/.test(s)) return s.slice(0, 7).replace(/\//g, "-");

  // DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    const [, , m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, "0")}`;
  }

  // Handle words like "Aug 17", "17 Aug", "Aug 17, 2026", "17 Aug 2026", "August 2026"
  const tokens = s.toLowerCase().replace(/[,/\\-]/g, " ").split(/\s+/).filter(Boolean);
  let foundMonth: string | undefined;
  let foundYear: string | undefined;

  for (const token of tokens) {
    const letters = token.replace(/[^a-z]/g, "");
    if (!foundMonth && letters) {
      if (MONTH_MAP[letters]) {
        foundMonth = MONTH_MAP[letters];
      } else if (MONTH_MAP[letters.slice(0, 3)]) {
        foundMonth = MONTH_MAP[letters.slice(0, 3)];
      }
    }
    if (/^\d{4}$/.test(token)) {
      foundYear = token;
    }
  }

  if (foundMonth) {
    const year = foundYear || String(new Date().getFullYear());
    return `${year}-${foundMonth}`;
  }

  // Fallback: Date.parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return getMonthString(parsed);
  }

  return fallbackMonth || getCurrentMonthKey();
}

/**
 * Formats a "YYYY-MM" key into a user-friendly month name string, e.g. "August 2026" or "Aug 2026".
 */
export function formatMonthName(monthStr?: string | null, format: "full" | "short" = "full"): string {
  if (!monthStr || typeof monthStr !== "string") return "";
  if (!monthStr.includes("-")) return monthStr;
  const [year, month] = monthStr.split("-");
  const idx = parseInt(month, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx > 11) return monthStr;
  const name = format === "short" ? SHORT_MONTH_NAMES[idx] : FULL_MONTH_NAMES[idx];
  return `${name} ${year}`;
}

/**
 * Extracts day of month (1-31) from date string.
 */
export function getDayOfMonth(dateStr?: string | null): number {
  if (!dateStr || typeof dateStr !== "string") return 1;
  const s = dateStr.trim();
  // Match ISO YYYY-MM-DD
  const iso = s.match(/^\d{4}-\d{2}-(\d{1,2})/);
  if (iso) return parseInt(iso[1], 10);
  // Match DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-]\d{1,2}[\/\-]\d{4}/);
  if (ddmmyyyy) return parseInt(ddmmyyyy[1], 10);
  // Match "Aug 17" or "17 Aug"
  const dayMatch = s.match(/\b([1-9]|[12]\d|3[01])\b/);
  if (dayMatch) return parseInt(dayMatch[1], 10);
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.getDate();
  return 1;
}

/**
 * Returns year string e.g. "2026" from "2026-08" or Date.
 */
export function getYearString(monthStr?: string | null): string {
  if (monthStr && /^\d{4}/.test(monthStr)) return monthStr.slice(0, 4);
  return String(new Date().getFullYear());
}

/**
 * Validates whether a date string is a plausible target date (between 2000 and 2099).
 */
export function isValidGoalDate(dateStr?: string | null): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!match) {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return false;
    const yr = parsed.getFullYear();
    return yr >= 2000 && yr <= 2099;
  }
  const yr = parseInt(match[1], 10);
  const mo = parseInt(match[2], 10);
  return yr >= 2000 && yr <= 2099 && mo >= 1 && mo <= 12;
}

/**
 * Returns formatted target date for goal buckets.
 * e.g. "28 Aug 2027", "Aug 2027", or "No deadline"
 */
export function formatGoalDeadline(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== "string" || !dateStr.trim()) {
    return "No deadline";
  }
  const s = dateStr.trim();
  
  // YYYY-MM-DD
  const isoFull = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoFull) {
    const yr = parseInt(isoFull[1], 10);
    const mo = parseInt(isoFull[2], 10) - 1;
    const day = parseInt(isoFull[3], 10);
    if (yr > 2099 || yr < 2000) {
      return `Invalid Year (${yr})`;
    }
    const monthName = SHORT_MONTH_NAMES[mo] || "M" + (mo + 1);
    return `${day} ${monthName} ${yr}`;
  }

  // YYYY-MM
  const isoMonth = s.match(/^(\d{4})-(\d{2})/);
  if (isoMonth) {
    const yr = parseInt(isoMonth[1], 10);
    const mo = parseInt(isoMonth[2], 10) - 1;
    if (yr > 2099 || yr < 2000) {
      return `Invalid Year (${yr})`;
    }
    const monthName = SHORT_MONTH_NAMES[mo] || "M" + (mo + 1);
    return `${monthName} ${yr}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const yr = parsed.getFullYear();
    if (yr > 2099 || yr < 2000) return `Invalid Year (${yr})`;
    return `${parsed.getDate()} ${SHORT_MONTH_NAMES[parsed.getMonth()]} ${yr}`;
  }

  return s;
}

/**
 * Calculates deadline metrics: remaining time, months left, overdue status, and suggested monthly savings.
 */
export function getGoalDeadlineMetrics(
  dateStr?: string | null,
  targetAmount: number = 0,
  savedAmount: number = 0
) {
  const remaining = Math.max(0, targetAmount - savedAmount);
  if (!dateStr || !isValidGoalDate(dateStr)) {
    return {
      hasDeadline: false,
      isInvalid: !!dateStr && !isValidGoalDate(dateStr),
      formattedDate: dateStr ? `Invalid Year` : "No deadline",
      isOverdue: false,
      monthsRemaining: 0,
      daysRemaining: 0,
      timeText: dateStr ? "Invalid deadline" : "No deadline set",
      suggestedMonthly: 0,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let target: Date;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    target = new Date(y, m - 1, d);
  } else if (/^\d{4}-\d{2}/.test(dateStr)) {
    const [y, m] = dateStr.split("-").map(Number);
    target = new Date(y, m, 0); // End of month
  } else {
    target = new Date(dateStr);
  }

  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    const timeText = overdueDays === 1 ? "Overdue by 1 day" : `Overdue by ${overdueDays} days`;
    return {
      hasDeadline: true,
      isInvalid: false,
      formattedDate: formatGoalDeadline(dateStr),
      isOverdue: true,
      monthsRemaining: 0,
      daysRemaining: diffDays,
      timeText,
      suggestedMonthly: remaining,
    };
  }

  // Calculate approximate months remaining
  const monthsRemaining = Math.max(1, Math.ceil(diffDays / 30.4375));
  let timeText = "";
  if (diffDays === 0) {
    timeText = "Due today!";
  } else if (diffDays <= 30) {
    timeText = `${diffDays} day${diffDays > 1 ? "s" : ""} left`;
  } else if (monthsRemaining < 12) {
    timeText = `${monthsRemaining} month${monthsRemaining > 1 ? "s" : ""} left`;
  } else {
    const yrs = (monthsRemaining / 12).toFixed(1).replace(/\.0$/, "");
    timeText = `${yrs} yr${Number(yrs) > 1 ? "s" : ""} left (${monthsRemaining} mos)`;
  }

  const suggestedMonthly = remaining > 0 ? Math.ceil(remaining / monthsRemaining) : 0;

  return {
    hasDeadline: true,
    isInvalid: false,
    formattedDate: formatGoalDeadline(dateStr),
    isOverdue: false,
    monthsRemaining,
    daysRemaining: diffDays,
    timeText,
    suggestedMonthly,
  };
}

/**
 * Returns date in YYYY-MM-DD format for +N months from today.
 */
export function getQuickDatePreset(monthsFromNow: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsFromNow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
