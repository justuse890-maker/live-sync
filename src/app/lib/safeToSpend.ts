/**
 * safeToSpend.ts — the arithmetic behind the Home "Safe to spend" figure, written out line by line.
 *
 * The number itself is buildHero().free (money in − spent − still to pay). This file only explains it, so the user can
 * see exactly what was subtracted and, just as important, what was NOT: income that has not arrived yet, and due items
 * the user never gave an amount for. A figure that says what it leaves out is one people can trust.
 */
import type { Hero } from "./homeHero";

export type DueItem = { title: string; amount?: number; overdue: boolean };
export type BreakdownLine = { label: string; amount: number; kind: "plus" | "minus"; overdue?: boolean };

export type Breakdown = {
  lines: BreakdownLine[];
  dueLines: BreakdownLine[];
  result: number;
  short: boolean;
  /** Due items with no amount: listed so the user knows they are not part of the subtraction. */
  unpriced: string[];
  notes: string[];
};

export function safeToSpendBreakdown({ hero, dueItems, isCurrentMonth, maxDueLines = 5 }: {
  hero: Hero;
  dueItems: DueItem[];
  isCurrentMonth: boolean;
  maxDueLines?: number;
}): Breakdown {
  const priced = isCurrentMonth ? dueItems.filter((d) => (d.amount ?? 0) > 0).sort((a, b) => (b.amount as number) - (a.amount as number)) : [];
  const unpriced = isCurrentMonth ? dueItems.filter((d) => !((d.amount ?? 0) > 0)).map((d) => d.title) : [];

  let dueLines: BreakdownLine[] = priced.map((d) => ({ label: d.title, amount: d.amount as number, kind: "minus", overdue: d.overdue }));
  if (dueLines.length > maxDueLines) {
    const keep = dueLines.slice(0, Math.max(0, maxDueLines - 1));
    const rest = dueLines.slice(keep.length);
    dueLines = [...keep, { label: `${rest.length} more bills`, amount: rest.reduce((s, l) => s + l.amount, 0), kind: "minus" }];
  }

  const lines: BreakdownLine[] = [
    { label: "Money in", amount: hero.moneyIn, kind: "plus" },
    { label: "Spent so far", amount: hero.spent, kind: "minus" },
    ...dueLines,
  ];
  const result = lines.reduce((s, l) => s + (l.kind === "plus" ? l.amount : -l.amount), 0);

  const notes: string[] = [];
  if (isCurrentMonth) notes.push("Income that has not arrived yet is not counted. Salary shows up here once you record it.");
  if (unpriced.length) {
    notes.push(`${unpriced.length} due ${unpriced.length === 1 ? "item has" : "items have"} no amount, so ${unpriced.length === 1 ? "it isn't" : "they aren't"} subtracted: ${unpriced.join(", ")}.`);
  }
  return { lines, dueLines, result, short: result < 0, unpriced, notes };
}
