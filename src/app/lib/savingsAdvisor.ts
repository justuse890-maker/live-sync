/**
 * savingsAdvisor.ts — "where should this goal's money live?"
 *
 * Rule-based and fully on-device (no API, no cost). Rates are the PUBLISHED rates for Oct–Dec 2026
 * (government small-savings rates are reset every quarter; bank rates move whenever the bank decides) and are
 * shown to the user as indicative. This is general information, not personalised investment advice.
 *
 * Sources (checked 9 Oct 2026):
 *  • Small-savings rates unchanged for Oct–Dec 2026 (PPF 7.1, NSC 7.7, SSY 8.2, SCSS 8.2, PO savings 4.0,
 *    PO TD 6.9/7.0/7.1/7.5, 5-yr RD 6.7) — Finance Ministry notification as reported by Angel One / Free Press Journal.
 *  • SBI savings 2.50 %, SBI FD 1-yr 6.80 % / 2-yr 7.00 % / 5-yr 6.50 % — bank rate cards via aggregators.
 *  • RBI repo rate raised to 5.50 % on 7 Oct 2026 — FD rates may drift up; confirm current rate before locking.
 */

export const RATES_AS_OF = "Oct–Dec 2026";

export type Provider = "Bank" | "Post Office" | "Government scheme" | "Mutual fund";
export type Risk = "Guaranteed" | "Market-linked";

export type Vehicle = {
  id: string;
  name: string;
  provider: Provider;
  /** Indicative annual rate in %. For market-linked products this is illustrative, never a promise. */
  ratePA: number;
  risk: Risk;
  liquidity: "Instant" | "Days" | "Penalty on early exit" | "Locked (partial exit later)";
  lockIn: string;
  safety: string;
  tax: string;
  minMonths: number;
  maxMonths?: number;
  note?: string;
};

export const VEHICLES: Record<string, Vehicle> = {
  bank_savings: {
    id: "bank_savings", name: "Bank savings account", provider: "Bank", ratePA: 2.5, risk: "Guaranteed",
    liquidity: "Instant", lockIn: "None", safety: "Insured up to ₹5 lakh per depositor per bank (DICGC)",
    tax: "Interest is taxable; ₹10,000/yr is deductible under 80TTA", minMonths: 0, maxMonths: 6,
    note: "Rates vary by bank (SBI 2.5%); some private/small-finance banks pay more — compare before opening.",
  },
  po_savings: {
    id: "po_savings", name: "Post Office savings account", provider: "Post Office", ratePA: 4.0, risk: "Guaranteed",
    liquidity: "Days", lockIn: "None", safety: "Government of India backed", tax: "Interest taxable; ₹10,000/yr deductible under 80TTA",
    minMonths: 0, maxMonths: 6,
  },
  bank_fd: {
    id: "bank_fd", name: "Bank fixed deposit (FD)", provider: "Bank", ratePA: 6.8, risk: "Guaranteed",
    liquidity: "Penalty on early exit", lockIn: "Your chosen tenure", safety: "Insured up to ₹5 lakh per depositor per bank (DICGC)",
    tax: "Interest taxable at your slab (TDS may apply)", minMonths: 3, maxMonths: 60,
    note: "SBI 1-yr 6.80%. Repo rate was raised on 7 Oct 2026, so ask your bank for today's rate before locking.",
  },
  po_td: {
    id: "po_td", name: "Post Office time deposit (1–5 yr)", provider: "Post Office", ratePA: 7.0, risk: "Guaranteed",
    liquidity: "Penalty on early exit", lockIn: "1, 2, 3 or 5 years", safety: "Government of India backed",
    tax: "Interest taxable (5-yr TD qualifies for 80C deduction)", minMonths: 12, maxMonths: 60,
    note: "1 yr 6.9% · 2 yr 7.0% · 3 yr 7.1% · 5 yr 7.5%.",
  },
  po_rd: {
    id: "po_rd", name: "Post Office recurring deposit (5 yr)", provider: "Post Office", ratePA: 6.7, risk: "Guaranteed",
    liquidity: "Penalty on early exit", lockIn: "5 years (partial withdrawal after 1 yr)", safety: "Government of India backed",
    tax: "Interest taxable", minMonths: 12, maxMonths: 60,
    note: "Builds a monthly habit — deposit the same amount each month.",
  },
  nsc: {
    id: "nsc", name: "National Savings Certificate (NSC)", provider: "Government scheme", ratePA: 7.7, risk: "Guaranteed",
    liquidity: "Penalty on early exit", lockIn: "5 years", safety: "Government of India backed",
    tax: "Qualifies for 80C; interest taxable", minMonths: 60, maxMonths: 72,
  },
  ppf: {
    id: "ppf", name: "Public Provident Fund (PPF)", provider: "Government scheme", ratePA: 7.1, risk: "Guaranteed",
    liquidity: "Locked (partial exit later)", lockIn: "15 years (partial withdrawal from year 7)", safety: "Government of India backed",
    tax: "Tax-free interest and 80C deduction under current rules; max ₹1.5 lakh/yr", minMonths: 84,
  },
  ssy: {
    id: "ssy", name: "Sukanya Samriddhi (for a daughter)", provider: "Government scheme", ratePA: 8.2, risk: "Guaranteed",
    liquidity: "Locked (partial exit later)", lockIn: "Until she is 21 (partial withdrawal at 18 for education)", safety: "Government of India backed",
    tax: "Tax-free interest and 80C deduction under current rules; max ₹1.5 lakh/yr", minMonths: 60,
    note: "Only for a girl child under 10, opened by a parent/guardian.",
  },
  scss: {
    id: "scss", name: "Senior Citizens Savings Scheme", provider: "Government scheme", ratePA: 8.2, risk: "Guaranteed",
    liquidity: "Penalty on early exit", lockIn: "5 years", safety: "Government of India backed",
    tax: "80C deduction; interest taxable", minMonths: 36, maxMonths: 60, note: "Only if you are 60+ (or 55+ retired). Max ₹30 lakh.",
  },
  debt_fund: {
    id: "debt_fund", name: "Liquid / short-duration debt mutual fund", provider: "Mutual fund", ratePA: 6.5, risk: "Market-linked",
    liquidity: "Days", lockIn: "None", safety: "Not insured; small chance of loss. Choose SEBI-registered AMCs, low-risk category",
    tax: "Gains taxed at your slab", minMonths: 3, maxMonths: 48, note: "Illustrative return only — varies and is not guaranteed.",
  },
  index_sip: {
    id: "index_sip", name: "Index-fund SIP (e.g. Nifty 50)", provider: "Mutual fund", ratePA: 10, risk: "Market-linked",
    liquidity: "Days", lockIn: "None (stay ≥ 5 years)", safety: "Not insured; value can fall 30%+ in a bad year",
    tax: "Equity gains taxed under capital-gains rules", minMonths: 60,
    note: "Illustrative long-term figure, NOT a promise. Use only for goals 5+ years away.",
  },
};

export type GoalKind = "emergency" | "child_education" | "retirement" | "home" | "vehicle" | "travel" | "wedding" | "gadget" | "general";

export function inferGoalKind(name: string): GoalKind {
  const n = name.toLowerCase();
  if (/emergenc|rainy|contingen|safety\s*net/.test(n)) return "emergency";
  if (/daughter|beti|girl|kanya|sukanya/.test(n)) return "child_education";
  if (/educat|school|college|tuition|study|mba|fees|child|son\b|kid/.test(n)) return "child_education";
  if (/retire|pension|old age|nest\s*egg/.test(n)) return "retirement";
  if (/house|home|flat|down\s*payment|property/.test(n)) return "home";
  if (/car|bike|scooter|vehicle|two.?wheeler/.test(n)) return "vehicle";
  if (/trip|travel|vacation|holiday|tour|goa|europe/.test(n)) return "travel";
  if (/wedding|marriage|shaadi/.test(n)) return "wedding";
  if (/phone|laptop|iphone|gadget|tv|camera|watch/.test(n)) return "gadget";
  return "general";
}

export type Recommendation = {
  vehicle: Vehicle;
  /** Why this fits THIS goal (plain language). */
  reason: string;
  /** Monthly saving needed to reach the target at this rate (0% if no horizon). */
  monthlyNeeded: number;
  /** Extra money earned vs. keeping cash idle at 0%. */
  extraEarned: number;
  badge?: "Best fit" | "Safest" | "Highest return";
};

export type AdvisorInput = { name: string; targetAmount: number; monthsLeft: number | null; forDaughter?: boolean; senior?: boolean };

/** Monthly deposit needed to reach `target` in `months` at annual rate `ratePA` % (end-of-month deposits). */
export function monthlyNeeded(target: number, months: number, ratePA: number): number {
  if (target <= 0 || months <= 0) return 0;
  const i = ratePA / 1200;
  if (i === 0) return Math.ceil(target / months);
  return Math.ceil((target * i) / (Math.pow(1 + i, months) - 1));
}

const fits = (v: Vehicle, months: number) => months >= v.minMonths && (v.maxMonths == null || months <= v.maxMonths);

export function recommend(input: AdvisorInput): Recommendation[] {
  const kind = inferGoalKind(input.name);
  const months = input.monthsLeft != null && input.monthsLeft > 0 ? input.monthsLeft : 24; // unknown horizon → assume 2 years
  const picks: Array<{ id: string; reason: string }> = [];
  const add = (id: string, reason: string) => { if (!picks.some((p) => p.id === id)) picks.push({ id, reason }); };

  if (kind === "emergency") {
    add("bank_savings", "Emergencies can't wait — keep 1–2 months of expenses where you can withdraw instantly.");
    add("bank_fd", "Park the rest in a (sweep-in or short) FD: higher rate, still safe, and breakable in a pinch.");
    add("debt_fund", "A liquid fund usually beats a savings account and pays out in about a day — slightly more risk.");
    add("po_savings", "Post Office savings is sovereign-backed and pays more than most bank savings accounts.");
  } else if (kind === "child_education" && (input.forDaughter || /daughter|beti|girl|kanya/i.test(input.name)) && months >= 60) {
    add("ssy", "The highest guaranteed rate of any government scheme, tax-free, built for a daughter's education and marriage.");
    add("ppf", "Another tax-free, sovereign-backed option if you have already used SSY's ₹1.5 lakh yearly limit.");
    add("index_sip", "Optional growth bucket for long horizons — expect ups and downs.");
  } else if (kind === "retirement" && months >= 84) {
    add("ppf", "Tax-free, sovereign-backed, and the 15-year lock-in protects you from dipping into retirement money.");
    add("index_sip", "Time smooths out market swings — the main way to beat inflation over 10+ years.");
    if (input.senior) add("scss", "Best guaranteed rate for 60+, paid out every quarter.");
    add("po_td", "Add a 5-year deposit for the guaranteed part of your mix.");
  } else if (months <= 6) {
    add("bank_savings", "Money needed within months should stay instantly accessible.");
    add("po_savings", "Slightly higher interest than most banks with a government guarantee.");
    add("bank_fd", "If you are sure you won't touch it, a short FD pays about 2–3× a savings account.");
    add("debt_fund", "Liquid funds suit 3–6 month goals if you accept a little risk.");
  } else if (months <= 12) {
    add("bank_fd", "A 6–12 month FD matches your timeline and gives a fixed, known return.");
    add("po_td", "Post Office 1-year deposit is government-backed at a similar rate.");
    add("po_rd", "A monthly RD makes saving automatic if you don't have the full amount yet.");
    add("debt_fund", "Short-duration funds can edge out FDs after tax for 1-year goals; returns are not fixed.");
  } else if (months <= 36) {
    add("po_td", "A 2–3 year Post Office deposit locks a good guaranteed rate with a sovereign guarantee.");
    add("bank_fd", "A bank FD gives a similar fixed return with easy online booking.");
    add("po_rd", "Recurring deposit works well if you'll save monthly rather than in one lump sum.");
    add("debt_fund", "Debt funds can suit 2–3 year goals when you can ride out small dips.");
  } else if (months < 84) {
    add("po_td", "A 5-year Post Office deposit currently pays the highest rate among these (7.5%), guaranteed.");
    add("nsc", "NSC (7.7%) is sovereign-backed and also qualifies for the 80C deduction.");
    add("index_sip", "For goals 5+ years away, a small index-fund SIP can grow faster — but it can also fall.");
    add("bank_fd", "A 5-year bank FD is a simple alternative with similar returns.");
  } else {
    add("ppf", "7+ years is where PPF shines: tax-free, guaranteed, and it forces discipline.");
    add("index_sip", "Long horizons are when equity has historically rewarded patience — it is not guaranteed.");
    add("nsc", "A guaranteed fixed-income layer to balance the market-linked part.");
  }

  // Home & wedding goals are usually short/medium term and must not be risked on the market.
  const safeOnly = kind === "home" || kind === "wedding" || kind === "vehicle" || kind === "gadget";
  const vehicles = picks
    .map((p) => ({ ...p, v: VEHICLES[p.id] }))
    .filter((p) => p.v && (p.id === "ssy" || p.id === "scss" || fits(p.v, months) || p.id === "bank_savings" || p.id === "po_savings"))
    .filter((p) => !(safeOnly && months < 60 && p.v.risk === "Market-linked" && p.id === "index_sip"))
    .slice(0, 3);

  const recs: Recommendation[] = vehicles.map((p) => {
    const needed = monthlyNeeded(input.targetAmount, months, p.v.ratePA);
    const zero = monthlyNeeded(input.targetAmount, months, 0);
    return { vehicle: p.v, reason: p.reason, monthlyNeeded: needed, extraEarned: Math.max(0, zero * months - needed * months) };
  });
  if (recs[0]) recs[0].badge = "Best fit";
  const guaranteed = recs.filter((r) => r.vehicle.risk === "Guaranteed" && r !== recs[0]);
  const safest = [...guaranteed].sort((a, b) => (/Government|Post Office/.test(b.vehicle.provider) ? 1 : 0) - (/Government|Post Office/.test(a.vehicle.provider) ? 1 : 0))[0];
  if (safest && !safest.badge) safest.badge = "Safest";
  const top = [...recs].sort((a, b) => b.vehicle.ratePA - a.vehicle.ratePA)[0];
  if (top && !top.badge) top.badge = "Highest return";
  return recs;
}

/** Months between today and an ISO date (null if no/invalid/past date). */
export function monthsUntil(iso?: string, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return null;
  // whole months between the dates, rounding a partial month up (Oct 9 → Nov 20 is 2 months of saving)
  const months = (Number(m[1]) - now.getFullYear()) * 12 + (Number(m[2]) - 1 - now.getMonth()) + (Number(m[3]) > now.getDate() ? 1 : 0);
  return months > 0 ? months : null;
}

export type SavingsPlan = { vehicleId: string; provider: Provider; accountId?: string; ratePA: number; ratesAsOf: string; custom?: string };
