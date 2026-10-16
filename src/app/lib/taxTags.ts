/**
 * taxTags.ts — optional tags that make year-end tax totals ready.
 *
 * A tag is the user's own label on an entry ("this was an 80C payment"). We total tagged entries per
 * section and show how much of the usual limit is used. Tags are SUGGESTED from the wording but never
 * applied without the user's tap.
 *
 * Limits below are the usual old-regime limits as we know them. They change with the Budget and several
 * deductions are not available in the new regime — so the UI says "verify on the Income Tax portal".
 * This is a record-keeping aid, not tax advice or a return.
 */
export type TaxTag = "80C" | "80CCD1B" | "80D" | "24b" | "80G" | "80TTA" | "HRA";

export type TagInfo = {
  id: TaxTag;
  label: string;
  /** Annual limit in rupees; null when there is no flat cap. */
  cap: number | null;
  /** Higher limit for senior citizens (60+), where one exists. */
  seniorCap?: number;
  hint: string;
};

export const TAX_TAGS: TagInfo[] = [
  { id: "80C", label: "80C", cap: 150_000, hint: "Life insurance premium, PPF, ELSS, EPF, tuition fees, principal on home loan" },
  { id: "80CCD1B", label: "80CCD(1B)", cap: 50_000, hint: "Your own NPS contribution, over and above 80C" },
  { id: "80D", label: "80D", cap: 25_000, seniorCap: 50_000, hint: "Health insurance premium and preventive check-up for you and family" },
  { id: "24b", label: "24(b)", cap: 200_000, hint: "Home-loan INTEREST only (not the whole EMI) on a self-occupied home" },
  { id: "80G", label: "80G", cap: null, hint: "Donations to eligible institutions — deduction percentage varies" },
  { id: "80TTA", label: "80TTA", cap: 10_000, hint: "Interest on savings accounts (seniors: 80TTB, up to ₹50,000)" },
  { id: "HRA", label: "HRA / rent", cap: null, hint: "Rent paid — exemption depends on salary, city and rent" },
];

const info = (t: TaxTag) => TAX_TAGS.find((x) => x.id === t)!;
export const capFor = (t: TaxTag, senior = false): number | null => {
  const i = info(t);
  return senior && i.seniorCap ? i.seniorCap : i.cap;
};

type TaggedTx = { type: string; amount: number; date: string; title?: string; category?: string; merchant?: string; taxTag?: TaxTag; isTransfer?: boolean };

/** A tag worth offering for this entry, or null. Never applied automatically. */
export function suggestTaxTag(t: Pick<TaggedTx, "type" | "title" | "category" | "merchant" | "taxTag">): TaxTag | null {
  if (t.taxTag) return null;
  const s = `${t.category || ""} ${t.title || ""} ${t.merchant || ""}`.toLowerCase();
  if (t.type === "income") return /\b(savings (account )?interest|sb interest)\b/.test(s) ? "80TTA" : null;
  if (t.type !== "expense") return null;
  if (/\b(nps)\b/.test(s)) return "80CCD1B";
  if (/\b(health insurance|mediclaim|medical insurance|star health|care health|niva bupa|preventive health)\b/.test(s)) return "80D";
  if (/\b(donation|donate|pm cares|charity)\b/.test(s)) return "80G";
  if (/\b(lic|life insurance|term (life|plan|insurance)|ppf|elss|nsc|sukanya|tuition fee|school fee|epf|vpf)\b/.test(s)) return "80C";
  if (/\b(house rent|rent paid|monthly rent)\b/.test(s) || (t.category || "").trim().toLowerCase() === "rent") return "HRA";
  return null;
}

export type TagTotal = { tag: TaxTag; label: string; used: number; cap: number | null; remaining: number | null; pct: number | null; count: number };

export function taxTotals(txs: TaggedTx[], range: { from: string; to: string }, senior = false): TagTotal[] {
  const sums = new Map<TaxTag, { used: number; count: number }>();
  for (const t of txs) {
    if (!t.taxTag || t.isTransfer) continue;
    const d = String(t.date).slice(0, 10);
    if (d < range.from || d > range.to) continue;
    const cur = sums.get(t.taxTag) ?? { used: 0, count: 0 };
    cur.used += Math.abs(Number(t.amount) || 0);
    cur.count += 1;
    sums.set(t.taxTag, cur);
  }
  return TAX_TAGS.filter((i) => sums.has(i.id)).map((i) => {
    const s = sums.get(i.id)!;
    const cap = capFor(i.id, senior);
    return {
      tag: i.id, label: i.label, used: s.used, cap, count: s.count,
      remaining: cap === null ? null : Math.max(0, cap - s.used),
      pct: cap === null ? null : Math.min(100, (s.used / cap) * 100),
    };
  });
}

/** Untagged entries in the range that have an obvious tag to offer. */
export function untaggedSuggestions<T extends TaggedTx & { id: string }>(txs: T[], range: { from: string; to: string }): Array<{ tx: T; tag: TaxTag }> {
  const out: Array<{ tx: T; tag: TaxTag }> = [];
  for (const t of txs) {
    if (t.isTransfer) continue;
    const d = String(t.date).slice(0, 10);
    if (d < range.from || d > range.to) continue;
    const tag = suggestTaxTag(t);
    if (tag) out.push({ tx: t, tag });
  }
  return out;
}
