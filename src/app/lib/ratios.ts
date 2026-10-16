/**
 * ratios.ts — the "CA health check": eight standard personal-finance ratios, each with a benchmark band.
 *
 * The bands are widely used planning rules of thumb, not regulations or advice, and every one is a
 * single constant below so a CA (or the user) can adjust them in one place:
 *
 *   Surplus rate        ≥20% good · 10–20% watch · <10% low     (the "20" in the 50/30/20 rule)
 *   Needs share         ≤50% good · ≤60% watch · >60% high      (50/30/20)
 *   Wants share         ≤30% good · ≤40% watch · >40% high      (50/30/20)
 *   EMI to income       ≤25% good · ≤ user limit (35%) watch · above = high
 *   Emergency fund      ≥6 months good · 3–6 watch · <3 low     (self-employed: 9 / 4.5)
 *   Debt to assets      ≤30% good · ≤50% watch · >50% high
 *   Life cover          ≥10× yearly income good · 5–10× watch · <5× low   (relevant if others depend on you)
 *   Investing rate      ≥15% good · 10–15% watch · <10% low
 */
import type { IncomeExpenditure, BalanceSheet } from "./statements";
import { emiBurden, DEFAULT_EMI_ALERT_PCT, EMI_CAUTION_PCT } from "./emiPlanner";

export type Band = "good" | "watch" | "low" | "unknown";
export type Persona = "salaried" | "business" | "homemaker" | "student" | "retired" | "other";

export type Ratio = {
  key: "surplus" | "needs" | "wants" | "emi" | "emergency" | "debt" | "cover" | "investing";
  label: string;
  value: number | null;
  display: string;
  band: Band;
  benchmark: string;
  /** One plain sentence on what the number means. */
  meaning: string;
  /** What to do next, and where. */
  action: { label: string; screen: string };
};

export type RatioInput = {
  ie: IncomeExpenditure;
  bs: BalanceSheet;
  /** Months of the period that actually have entries — used to turn period totals into monthly figures. */
  monthsWithData: number;
  /** Cash, savings and deposits that can be used within days. */
  liquidAssets: number;
  /** Sum of current monthly EMIs. */
  monthlyEmi: number;
  /** Typical monthly income (average of recent months with income). */
  monthlyIncome: number;
  lifeCover: number;
  persona?: Persona;
  emiAlertPct?: number;
};

const pct = (n: number) => `${n.toFixed(0)}%`;
const inrShort = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function higherIsBetter(v: number, good: number, watch: number): Band {
  return v >= good ? "good" : v >= watch ? "watch" : "low";
}
function lowerIsBetter(v: number, good: number, watch: number): Band {
  return v <= good ? "good" : v <= watch ? "watch" : "low";
}

export function computeRatios(i: RatioInput): Ratio[] {
  const inc = i.ie.income.total;
  const months = Math.max(1, i.monthsWithData);
  const persona = i.persona ?? "salaried";
  const selfEmployed = persona === "business";
  const out: Ratio[] = [];

  // 1. Surplus rate
  {
    const v = i.ie.surplusRatePct;
    out.push({
      key: "surplus", label: "Surplus rate", value: v, display: v === null ? "—" : pct(v),
      band: v === null ? "unknown" : higherIsBetter(v, 20, 10), benchmark: "20% or more of income",
      meaning: v === null ? "Needs income entries for this period." : `After living costs and EMIs you kept ${pct(v)} of what came in.`,
      action: { label: "See where money went", screen: "spending-patterns" },
    });
  }
  // 2. Needs share
  {
    const v = inc > 0 ? (i.ie.needs.total / inc) * 100 : null;
    out.push({
      key: "needs", label: "Essentials share", value: v, display: v === null ? "—" : pct(v),
      band: v === null ? "unknown" : lowerIsBetter(v, 50, 60), benchmark: "50% of income or less",
      meaning: v === null ? "Needs income entries." : `Rent, groceries, bills, health and school took ${pct(v)} of income.`,
      action: { label: "Review essentials", screen: "reports" },
    });
  }
  // 3. Wants share
  {
    const v = inc > 0 ? (i.ie.wants.total / inc) * 100 : null;
    out.push({
      key: "wants", label: "Lifestyle share", value: v, display: v === null ? "—" : pct(v),
      band: v === null ? "unknown" : lowerIsBetter(v, 30, 40), benchmark: "30% of income or less",
      meaning: v === null ? "Needs income entries." : `Dining, shopping, travel and fun took ${pct(v)} of income.`,
      action: { label: "Find leaks", screen: "leakage" },
    });
  }
  // 4. EMI to income
  {
    const limit = i.emiAlertPct ?? DEFAULT_EMI_ALERT_PCT;
    const b = emiBurden(i.monthlyIncome, i.monthlyEmi, limit);
    const band: Band = b.level === "no_income" || (b.level === "none" && !(i.monthlyIncome > 0)) ? "unknown" : b.level === "none" || b.level === "healthy" ? "good" : b.level === "watch" ? "watch" : "low";
    out.push({
      key: "emi", label: "EMI to income", value: b.ratioPct, display: b.ratioPct === null ? "—" : pct(b.ratioPct),
      band, benchmark: `${Math.min(EMI_CAUTION_PCT, limit)}% comfortable · ${limit}% your limit`,
      meaning: b.ratioPct === null ? "Needs a typical monthly income." : b.level === "none" ? "No EMIs recorded." : `${inrShort(b.totalEmi)} of ${inrShort(i.monthlyIncome)} a month is already promised to EMIs.`,
      action: { label: "Open EMI centre", screen: "loans" },
    });
  }
  // 5. Emergency fund
  {
    const monthlyEssential = (i.ie.needs.total + i.ie.debtService.total) / months;
    const v = i.liquidAssets > 0 && monthlyEssential > 0 ? i.liquidAssets / monthlyEssential : null;
    const good = selfEmployed ? 9 : 6, watch = selfEmployed ? 4.5 : 3;
    out.push({
      key: "emergency", label: "Emergency fund", value: v, display: v === null ? "—" : `${v.toFixed(1)} mo`,
      band: v === null ? "unknown" : higherIsBetter(v, good, watch), benchmark: `${good} months of essentials${selfEmployed ? " (irregular income)" : ""}`,
      meaning: v === null ? "Add cash, savings or FD balances and some expenses." : `Liquid money covers ${v.toFixed(1)} months of essentials and EMIs.`,
      action: { label: "Plan emergency fund", screen: "emergency" },
    });
  }
  // 6. Debt to assets
  {
    const v = i.bs.debtToAssetPct;
    out.push({
      key: "debt", label: "Debt to assets", value: v, display: v === null ? "—" : pct(v),
      band: v === null ? "unknown" : lowerIsBetter(v, 30, 50), benchmark: "30% or less",
      meaning: v === null ? "Add assets and loans to see this." : `Every ₹100 you own carries ₹${v.toFixed(0)} of debt.`,
      action: { label: "Open net worth", screen: "networth" },
    });
  }
  // 7. Life cover
  {
    const annual = (i.monthlyIncome || 0) * 12;
    const v = annual > 0 ? i.lifeCover / annual : null;
    out.push({
      key: "cover", label: "Life cover", value: v, display: v === null ? "—" : `${v.toFixed(1)}×`,
      band: v === null ? "unknown" : higherIsBetter(v, 10, 5), benchmark: "10× yearly income if others depend on you",
      meaning: v === null ? "Needs a typical monthly income." : i.lifeCover === 0 ? "No life cover recorded." : `Cover is ${v.toFixed(1)}× your yearly income.`,
      action: { label: "Review insurance", screen: "insurance" },
    });
  }
  // 8. Investing rate
  {
    const v = inc > 0 ? (i.ie.savings.total / inc) * 100 : null;
    out.push({
      key: "investing", label: "Investing rate", value: v, display: v === null ? "—" : pct(v),
      band: v === null ? "unknown" : higherIsBetter(v, 15, 10), benchmark: "15% of income or more",
      meaning: v === null ? "Needs income entries." : `You put ${pct(v)} of income into savings and investments.`,
      action: { label: "Open SIP tracker", screen: "sip" },
    });
  }
  return out;
}

export function ratioSummary(r: Ratio[]) {
  const scored = r.filter((x) => x.band !== "unknown");
  return {
    scored: scored.length,
    good: scored.filter((x) => x.band === "good").length,
    watch: scored.filter((x) => x.band === "watch").length,
    low: scored.filter((x) => x.band === "low").length,
    /** The ratios most worth fixing first: low before watch, in their listed order. */
    priorities: [...scored.filter((x) => x.band === "low"), ...scored.filter((x) => x.band === "watch")].slice(0, 3),
  };
}
