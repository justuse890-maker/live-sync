/**
 * cardDue.ts — wording and severity for a credit-card payment reminder.
 *
 * Grounded in RBI's credit-card FAQ: if the full amount due is not paid by the due date, the interest-free period is
 * lost and interest runs from the transaction date. We say exactly that and nothing stronger. We do not know the
 * card's interest rate, so we never quote a rupee cost of paying late — only the amounts the user has entered.
 *
 * Every warning has: what is due (title), why it matters (body), one next step (primaryAction), and a text label so the
 * severity never depends on colour alone.
 */
export type CardDueLevel = "info" | "watch" | "action";

export type CardDueWarning = {
  level: CardDueLevel;
  label: string;
  title: string;
  body: string;
  primaryAction: "Mark paid" | "Add statement amount";
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

export function cardDueWarning({ daysLeft, statementDue, minDue, cardLabel }: {
  daysLeft: number;
  statementDue?: number;
  minDue?: number;
  cardLabel: string;
}): CardDueWarning {
  const level: CardDueLevel = daysLeft <= 2 ? "action" : daysLeft <= 7 ? "watch" : "info";
  const label = level === "action" ? (daysLeft < 0 ? "Overdue" : "Act now") : level === "watch" ? "Coming up" : "Heads-up";

  const title = daysLeft < 0
    ? `${cardLabel} bill is ${plural(-daysLeft, "day")} overdue`
    : daysLeft === 0
      ? `${cardLabel} bill is due today`
      : `${cardLabel} bill due in ${plural(daysLeft, "day")}`;

  const hasAmount = typeof statementDue === "number" && statementDue > 0;
  if (!hasAmount) {
    return {
      level, label, title,
      body: "Enter the amount from your latest statement so we can show what to pay. Paying the full amount by the due date keeps your interest-free period.",
      primaryAction: "Add statement amount",
    };
  }

  const showMin = typeof minDue === "number" && minDue > 0 && minDue < (statementDue as number);
  const late = daysLeft < 0 ? " Pay as soon as you can; interest may already apply from each purchase date." : "";
  const body = `${inr(statementDue as number)} is due. Paying the full amount by the due date keeps your interest-free period.`
    + (showMin ? ` Paying only the minimum (${inr(minDue as number)}) means interest is charged from each purchase date.` : "")
    + late;
  return { level, label, title, body, primaryAction: "Mark paid" };
}
