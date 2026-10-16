/**
 * caLens.ts — assembles everything the CA Lens screen shows for one financial year, from plain inputs.
 * No React, no storage: easy to test, and the screen stays a thin view.
 */
import { FY, fyMonthKeys, upcomingDeadlines } from "./fy";
import { balanceSheet, cashFlow, incomeExpenditure, monthlySeries, StmtTx, SnapLine } from "./statements";
import { computeRatios, ratioSummary, Persona } from "./ratios";
import { typicalMonthlyIncome } from "./emiPlanner";
import { taxTotals, untaggedSuggestions, TaxTag } from "./taxTags";

export type LensInput = {
  fy: FY;
  /** YYYY-MM-DD, used to cut the year at "now" and to find upcoming deadlines. */
  today: string;
  /** Counted ledger (own-account transfers excluded). */
  transactions: Array<StmtTx & { id: string; taxTag?: TaxTag }>;
  assetLines: SnapLine[];
  liabilityLines: SnapLine[];
  liquidAssets: number;
  monthlyEmi: number;
  lifeCover: number;
  persona: Persona;
  emiAlertPct?: number;
  seniorCitizen?: boolean;
};

export function buildLens(i: LensInput) {
  const to = i.today < i.fy.to ? i.today : i.fy.to;
  const range = { from: i.fy.from, to };
  const ie = incomeExpenditure(i.transactions, range);
  const cf = cashFlow(ie);
  const bs = balanceSheet(i.assetLines, i.liabilityLines);

  const monthKeys = fyMonthKeys(i.fy).filter((k) => `${k}-01` <= to);
  const series = monthlySeries(i.transactions, monthKeys);
  const monthsWithData = series.filter((m) => m.income > 0 || m.expense > 0).length;

  const monthlyIncome = typicalMonthlyIncome(i.transactions, new Date(`${to}T12:00:00`));
  const ratios = computeRatios({
    ie, bs, monthsWithData,
    liquidAssets: i.liquidAssets, monthlyEmi: i.monthlyEmi, monthlyIncome,
    lifeCover: i.lifeCover, persona: i.persona, emiAlertPct: i.emiAlertPct,
  });

  return {
    fy: i.fy, range, ie, cf, bs, series, monthsWithData, monthlyIncome,
    ratios, ratioSummary: ratioSummary(ratios),
    tax: taxTotals(i.transactions, { from: i.fy.from, to: i.fy.to }, i.seniorCitizen),
    taxSuggestions: untaggedSuggestions(i.transactions, { from: i.fy.from, to: i.fy.to }),
    deadlines: upcomingDeadlines(i.today, 3, new Date(`${i.today}T12:00:00`)),
    hasData: ie.entryCount > 0,
  };
}

export type Lens = ReturnType<typeof buildLens>;

/** Plain-text version of the three statements, for copying/sharing when printing isn't available. */
export function statementsAsText(l: Lens, fmt: (n: number) => string): string {
  const row = (label: string, v: number) => `${label.padEnd(34)}${fmt(v).padStart(16)}`;
  const grp = (title: string, g: { total: number; lines: Array<{ label: string; amount: number }> }) => [
    title.toUpperCase(), ...g.lines.map((x) => row(`  ${x.label}`, x.amount)), row("  Total", g.total), "",
  ];
  const out: string[] = [
    `LIVESYNC — ${l.fy.label} (${l.range.from} to ${l.range.to})`,
    "Prepared from the user's own records. Not audited. Not a bank or tax-authority statement.", "",
    "STATEMENT OF INCOME & EXPENDITURE", "",
    ...grp("Income", l.ie.income), ...grp("Essentials", l.ie.needs), ...grp("Lifestyle", l.ie.wants), ...grp("Loan & card repayments", l.ie.debtService),
    row("SURPLUS (income − costs − repayments)", l.ie.surplus),
    ...grp("Savings & investments deployed", l.ie.savings),
    row("CASH RETAINED", l.ie.cashRetained), "",
    "CASH-FLOW STATEMENT", "",
    row("Operating (income − living costs)", l.cf.operating), row("Financing (repayments)", l.cf.financing), row("Investing (savings)", l.cf.investing), row("NET CHANGE IN CASH", l.cf.net), "",
    "STATEMENT OF ASSETS & LIABILITIES (today)", "",
    ...l.bs.assets.flatMap((g) => [g.label, ...g.lines.map((x) => row(`  ${x.label}`, x.value))]),
    row("TOTAL ASSETS", l.bs.totalAssets), "",
    ...l.bs.liabilities.flatMap((g) => [g.label, ...g.lines.map((x) => row(`  ${x.label}`, x.value))]),
    row("TOTAL LIABILITIES", l.bs.totalLiabilities), "",
    row("NET WORTH", l.bs.netWorth),
  ];
  return out.join("\n");
}
