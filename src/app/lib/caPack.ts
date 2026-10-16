/**
 * caPack.ts — the year-end bundle a person hands to their own CA: statements, health check, tax-tagged entries,
 * loans and a document checklist. Built from the user's records; text-only so it can be shared anywhere.
 *
 * Not a return, not tax advice, not audited.
 */
import { Lens, statementsAsText } from "./caLens";
import { TAX_TAGS, capFor, TaxTag } from "./taxTags";

type TaggedTx = { id: string; date: string; title?: string; merchant?: string; amount: number; type: string; taxTag?: TaxTag; isTransfer?: boolean };
type LoanLite = { lenderName: string; loanType: string; outstandingPrincipal: number; emiAmount: number; interestRatePA: number; nextEmiDueDate?: string; closed?: boolean };
type VaultDoc = { name: string; category?: string };

export type ChecklistItem = { id: string; label: string; why: string; have: boolean };

const has = (docs: VaultDoc[], rx: RegExp) => docs.some((d) => rx.test(`${d.name} ${d.category ?? ""}`));

/** Which papers a CA will ask for — only the ones this user's records make relevant. */
export function documentChecklist(lens: Lens, docs: VaultDoc[], loans: LoanLite[]): ChecklistItem[] {
  const tagUsed = (t: TaxTag) => lens.tax.some((x) => x.tag === t && x.used > 0);
  const hasSalary = lens.ie.income.lines.some((l) => /salary/i.test(l.label));
  const items: ChecklistItem[] = [];
  if (hasSalary) items.push({ id: "form16", label: "Form 16 from your employer", why: "Salary and TDS for the year", have: has(docs, /form[\s-]?16/i) });
  items.push({ id: "ais", label: "AIS and Form 26AS (from the Income Tax portal)", why: "What the department already has on record for you", have: has(docs, /\b(ais|26\s?as)\b/i) });
  items.push({ id: "bankint", label: "Bank interest certificates / statements", why: "Interest income on savings and FDs", have: has(docs, /interest\s+cert|bank\s+statement|fd\s+(?:cert|advice)/i) });
  if (tagUsed("80C")) items.push({ id: "80c", label: "80C proofs — LIC/PPF/ELSS/tuition receipts", why: "Deduction under section 80C", have: has(docs, /\b(lic|ppf|elss|80c|tuition|receipt)\b/i) });
  if (tagUsed("80D")) items.push({ id: "80d", label: "Health insurance premium receipts", why: "Deduction under section 80D", have: has(docs, /\b(health|mediclaim|80d|premium)\b/i) });
  if (tagUsed("HRA")) items.push({ id: "rent", label: "Rent receipts and landlord's PAN (if rent is large)", why: "HRA exemption", have: has(docs, /\b(rent|hra|landlord)\b/i) });
  if (tagUsed("80G")) items.push({ id: "80g", label: "Donation receipts", why: "Deduction under section 80G", have: has(docs, /\b(donation|80g)\b/i) });
  if (loans.some((l) => !l.closed && /home/i.test(l.loanType))) items.push({ id: "homeloan", label: "Home-loan interest and principal certificate", why: "Section 24(b) and 80C", have: has(docs, /home\s*loan|interest\s+cert|loan\s+cert/i) });
  if (lens.bs.assets.some((g) => g.key === "market")) items.push({ id: "capgains", label: "Capital-gains statements (mutual funds / shares)", why: "Gains and losses from selling investments", have: has(docs, /capital\s*gain|p\s?&\s?l|profit\s+and\s+loss|broker/i) });
  return items;
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** One row per tax-tagged entry in the year — easy to paste into a spreadsheet. */
export function taxEntriesCsv(txs: TaggedTx[], range: { from: string; to: string }): string {
  const rows = txs
    .filter((t) => t.taxTag && !t.isTransfer && t.date.slice(0, 10) >= range.from && t.date.slice(0, 10) <= range.to)
    .sort((a, b) => (a.taxTag! < b.taxTag! ? -1 : a.taxTag! > b.taxTag! ? 1 : a.date < b.date ? -1 : 1));
  return [["Section", "Date", "Description", "Amount"].map(csvCell).join(","), ...rows.map((t) => [t.taxTag, t.date.slice(0, 10), t.merchant || t.title || "", Math.abs(t.amount).toFixed(2)].map(csvCell).join(","))].join("\n");
}

export function buildCaPack(input: {
  lens: Lens;
  txs: TaggedTx[];
  loans: LoanLite[];
  docs: VaultDoc[];
  fmt: (n: number) => string;
  now?: Date;
  senior?: boolean;
}): string {
  const { lens, txs, loans, docs, fmt } = input;
  const now = input.now ?? new Date();
  const out: string[] = [];
  out.push(`CA PACK — ${lens.fy.label}`, `Prepared ${now.toISOString().slice(0, 10)} from the user's own LiveSync records.`, "Not audited. Not a tax return. Not financial or tax advice.", "");

  out.push("══ 1. STATEMENTS ══", "", statementsAsText(lens, fmt), "");

  out.push("══ 2. HEALTH CHECK (guidelines, not advice) ══", "");
  for (const r of lens.ratios) out.push(`${r.label.padEnd(20)} ${r.display.padStart(8)}   ${r.band === "unknown" ? "need more data" : r.band === "good" ? "on track" : r.band === "watch" ? "watch" : "needs work"}   (guideline: ${r.benchmark})`);
  out.push("");

  out.push("══ 3. TAX-TAGGED ENTRIES (old-regime sections; verify limits with the portal) ══", "");
  if (lens.tax.length === 0) out.push("No entries tagged this year.", "");
  for (const t of lens.tax) {
    const cap = capFor(t.tag, input.senior);
    out.push(`Section ${t.label} — total ${fmt(t.used)}${cap ? ` of usual limit ${fmt(cap)}` : " (no flat limit)"}`);
    for (const e of txs.filter((x) => x.taxTag === t.tag && !x.isTransfer && x.date.slice(0, 10) >= lens.fy.from && x.date.slice(0, 10) <= lens.fy.to).sort((a, b) => (a.date < b.date ? -1 : 1)))
      out.push(`   ${e.date.slice(0, 10)}  ${(e.merchant || e.title || "").slice(0, 34).padEnd(34)} ${fmt(Math.abs(e.amount)).padStart(14)}`);
    out.push("");
  }

  const open = loans.filter((l) => !l.closed);
  out.push("══ 4. LOANS & EMIs ══", "");
  if (open.length === 0) out.push("No open loans recorded.", "");
  for (const l of open) out.push(`${l.lenderName} (${l.loanType.replace(/_/g, " ")}): outstanding ${fmt(l.outstandingPrincipal)}, EMI ${fmt(l.emiAmount)}, ${l.interestRatePA}% p.a.${l.nextEmiDueDate ? `, next due ${l.nextEmiDueDate}` : ""}`);
  if (open.length) out.push("");

  out.push("══ 5. DOCUMENT CHECKLIST ══", "");
  for (const d of documentChecklist(lens, docs, loans)) out.push(`[${d.have ? "x" : " "}] ${d.label} — ${d.why}`);
  out.push("", "Items marked [ ] were not found in the Document Vault by name; they may exist elsewhere.");
  return out.join("\n");
}
