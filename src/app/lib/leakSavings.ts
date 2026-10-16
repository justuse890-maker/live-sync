/**
 * leakSavings.ts — "money I stopped losing". When the user sorts out a recurring leak (cancels a subscription,
 * drops a duplicate service) they can mark it fixed; its yearly cost is then counted as saved, and the leak
 * stops being listed as open.
 *
 * Only subscription-type leaks can be marked fixed. Behavioural leaks (food delivery, cabs) vary month to month,
 * so a "fixed" tick would be a guess, and we do not count guesses as savings.
 */
import type { Leak } from "./intelligence";

export type LeakFix = { title: string; annual: number; at: string };
export type LeakFixes = Record<string, LeakFix>;

export const canMarkFixed = (id: string) => /^(sub|dup)-/.test(id);

export function applyFixes(leaks: Leak[], fixes: LeakFixes) {
  const open = leaks.filter((l) => !fixes[l.id]);
  const fixed = Object.entries(fixes).map(([id, f]) => ({ id, ...f })).sort((a, b) => (a.at < b.at ? 1 : -1));
  const savedAnnual = fixed.reduce((s, f) => s + f.annual, 0);
  return { open, fixed, savedAnnual, savedMonthly: savedAnnual / 12, openAnnual: open.reduce((s, l) => s + l.annual, 0) };
}

export function markFixed(fixes: LeakFixes, leak: Pick<Leak, "id" | "title" | "annual">, now = new Date()): LeakFixes {
  if (!canMarkFixed(leak.id) || !(leak.annual > 0)) return fixes;
  return { ...fixes, [leak.id]: { title: leak.title, annual: Math.round(leak.annual), at: now.toISOString() } };
}

export function unmarkFixed(fixes: LeakFixes, id: string): LeakFixes {
  const { [id]: _gone, ...rest } = fixes;
  return rest;
}
