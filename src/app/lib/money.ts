/**
 * money.ts — one place that turns a number into rupees for display.
 *
 *   formatInr          ₹12,34,567        Indian (lakh/crore) digit grouping, true minus sign for negatives
 *   formatSignedInr    +₹500 / −₹500     for gains and losses: the sign carries the meaning, not only the colour
 *   formatCompactInr   ₹1.25 L / ₹3.4 Cr for tight spaces (chart labels, small cards, notifications)
 *
 * Intl's own "compact" output for en-IN is not reliable across Android WebView versions, so the lakh/crore
 * wording is done here by hand and covered by tests.
 */
const MINUS = "−"; // U+2212, not a hyphen: it lines up with digits and is read as "minus" by screen readers

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

const group = (n: number, maxFractionDigits = 0) => n.toLocaleString("en-IN", { maximumFractionDigits: maxFractionDigits });

export function formatInr(v: unknown): string {
  const n = num(v);
  const rounded = Math.round(Math.abs(n));
  return `${n < 0 && rounded > 0 ? MINUS : ""}₹${group(rounded)}`;
}

export function formatSignedInr(v: unknown): string {
  const n = num(v);
  const rounded = Math.round(Math.abs(n));
  if (rounded === 0) return "₹0";
  return `${n < 0 ? MINUS : "+"}₹${group(rounded)}`;
}

/** Up to two decimals, no trailing zeros: 1.25, 3.4, 1. */
const trim2 = (n: number) => String(Math.round(n * 100) / 100);

export function formatCompactInr(v: unknown): string {
  const n = num(v);
  const abs = Math.abs(n);
  const sign = n < 0 && Math.round(abs) > 0 ? MINUS : "";
  if (abs < 100_000) return `${sign}₹${group(Math.round(abs))}`;

  const lakhs = Math.round((abs / 100_000) * 100) / 100;
  if (lakhs < 100) return `${sign}₹${trim2(lakhs)} L`;

  const crores = Math.round((abs / 10_000_000) * 100) / 100;
  return `${sign}₹${crores >= 1000 ? group(crores, 2) : trim2(crores)} Cr`;
}
