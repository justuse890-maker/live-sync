/**
 * messageParser.ts — turns bank / UPI / card alert text the user PASTES or SHARES into transaction drafts.
 *
 * LiveSync never reads the SMS inbox. The user decides which messages to give us; this file only reads the
 * text it is handed, on the device, and keeps just the last four digits of any account or card.
 *
 * Pure functions. Rules + the merchant dictionary — no AI needed, because bank alerts are highly templated.
 */
import { MAX_TRANSACTION_AMOUNT } from "./currencyUtils";
import { lookupDictionary, stripNoise } from "./merchantNormalize";

export type Instrument = "upi" | "card" | "account" | "atm" | "neft";

export type ParsedMessage = {
  /** Original text (trimmed), for the review screen. */
  raw: string;
  direction: "debit" | "credit";
  /** What the entry should become. `cash_withdrawal` is a transfer to cash, not spending. */
  kind: "expense" | "income" | "cash_withdrawal";
  amount: number;
  /** YYYY-MM-DD when the message states one. */
  date?: string;
  merchant?: string;
  category?: string;
  /** Last four digits of the account or card — the only part we keep. */
  last4?: string;
  instrument: Instrument;
  ref?: string;
  /** Balance the bank reported after this transaction (never saved as an entry). */
  balance?: number;
  confidence: number;
  warnings: string[];
};

export type Skipped = { raw: string; reason: string };
export type ParseResult = { messages: ParsedMessage[]; skipped: Skipped[] };

// ── splitting ───────────────────────────────────────────────────────────────
const MONEY_WORDS = /\b(debited|credited|spent|withdrawn|received|paid|sent|purchase)\b/gi;

/** One pasted blob → individual messages. Blank lines separate messages; a block of one-message-per-line is split too. */
export function splitMessages(blob: string): string[] {
  const blocks = blob.replace(/\r/g, "").split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  const out: string[] = [];
  for (const b of blocks) {
    const lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    const moneyLines = lines.filter((l) => /(?:₹|rs\.?|inr)\s*[\d,]+/i.test(l) && (l.match(MONEY_WORDS) || []).length > 0);
    // Several lines that each look like a full alert → treat each line as its own message.
    if (lines.length > 1 && moneyLines.length === lines.length) out.push(...lines);
    else out.push(lines.join(" "));
  }
  return out;
}

// ── helpers ─────────────────────────────────────────────────────────────────
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");
const validYMD = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= new Date(y, m, 0).getDate();

/** First date in the text, in the formats Indian banks use. Two-digit years are 20xx. */
export function parseDate(text: string, today = new Date()): string | undefined {
  const t = text.replace(/\s+/g, " ");
  const fix = (y: number) => (y < 100 ? 2000 + y : y);
  let m: RegExpMatchArray | null;

  // 10-10-2026, 10/10/26, 10.10.26
  if ((m = t.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/))) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), fix(Number(m[3]))];
    if (validYMD(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  // 10-Oct-26, 10 Oct 2026, 10Oct26, 10 October, 2026
  if ((m = t.match(/\b(\d{1,2})[\s-]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,'-]*(\d{2}|\d{4})\b/i))) {
    const [d, mo, y] = [Number(m[1]), MONTHS[m[2].toLowerCase()], fix(Number(m[3]))];
    if (validYMD(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  // "on 10/10" — no year: assume this year, or last year if that would be in the future
  if ((m = t.match(/\bon\s+(\d{1,2})[/-](\d{1,2})\b(?![-/.]?\d)/i))) {
    const [d, mo] = [Number(m[1]), Number(m[2])];
    let y = today.getFullYear();
    if (validYMD(y, mo, d) && new Date(y, mo - 1, d).getTime() > today.getTime() + 86_400_000) y -= 1;
    if (validYMD(y, mo, d)) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  return undefined;
}

/** "Rs.1,250.00", "INR 1250", "₹ 250" — the first amount that is NOT labelled as a balance or limit. */
function transactionAmount(text: string): { value: number; index: number } | null {
  const rx = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 26), m.index);
    if (/\b(?:avl\.?|avail(?:able)?|bal(?:ance)?|limit|total|closing|outstanding)\b[^.]{0,14}$/i.test(before)) continue;
    const v = Number(m[1].replace(/,/g, ""));
    if (v > 0 && v <= MAX_TRANSACTION_AMOUNT) return { value: v, index: m.index };
  }
  return null;
}

const DEBIT = /\b(debited|debit(?:ed)?\s+by|spent|withdrawn|withdrawal|purchase(?:d)?|paid|sent|txn\s+of|transaction\s+of|dr\b)/i;
const CREDIT = /\b(credited|credit\s+of|received|deposited|refund(?:ed)?|cr\b)/i;

function direction(text: string): "debit" | "credit" | null {
  const d = text.search(DEBIT), c = text.search(CREDIT);
  if (d < 0 && c < 0) return null;
  if (c < 0) return "debit";
  if (d < 0) return "credit";
  return d < c ? "debit" : "credit"; // "a/c debited … merchant credited" → the first word describes the user's account
}

const last4Of = (text: string): string | undefined => {
  const m = text.match(/(?:a\/?c|acct|account|card|ac)(?:\s*(?:no|number|ending|ending\s+with))?\.?\s*(?:[:#-]\s*)?(?:x{1,}|\*{1,}|•+|\.\.\.)?\s*(\d{3,4})\b/i)
    ?? text.match(/\b(?:x{2,}|\*{2,})(\d{4})\b/i);
  return m ? m[1].slice(-4) : undefined;
};

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

function cleanMerchant(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let s = raw.trim();
  // UPI handle → the name part before @, readable
  if (/^[\w.\-]+@[a-z]+$/i.test(s)) s = s.split("@")[0].replace(/[._\-\d]+/g, " ").trim();
  s = s.replace(/[()\[\].,;:]+$/g, "").replace(/\s+/g, " ").trim();
  if (/^(?:mobile|mob|your|customer|bank|upi|neft|imps|rtgs|a\/?c|account|linked|self)\b/i.test(s)) return undefined;
  const stripped = stripNoise(s) || s.toUpperCase();
  const hit = lookupDictionary(stripped);
  if (hit) return hit.canonical;
  const name = titleCase(stripped).slice(0, 40).trim();
  return name.length >= 2 && !/^\d+$/.test(name) ? name : undefined;
}

function findMerchant(t: string, dir: "debit" | "credit"): string | undefined {
  const rx: RegExp[] = dir === "debit"
    ? [
        /\bto\s+vpa\s+([\w.\-]+@[a-z]+)/i,
        /\b(?:trf|transfer(?:red)?)\s+to\s+([A-Za-z0-9&'.\- ]{2,40}?)(?=\s+(?:ref|refno|upi|on|via|avl|not|if|-)\b|[.,;(]|$)/i,
        /\bat\s+([A-Za-z0-9&'.\- ]{2,40}?)(?=\s+(?:on|via|using|avl|ref|\d{1,2}[-/])|[.,;(]|$)/i,
        /;\s*([A-Za-z0-9&'.\- ]{2,40}?)\s+credited/i,
        /\bpaid\s+to\s+([A-Za-z0-9&'.\- ]{2,40}?)(?=\s+(?:on|via|ref|upi|using)|[.,;(]|$)/i,
        /\btowards\s+([A-Za-z0-9&'.\- ]{2,40}?)(?=\s+(?:from|on|via|ref|upi)|[.,;(]|$)/i,
        /\bto\s+([A-Za-z0-9&'.\- ]{3,40}?)(?=\s+(?:on|via|ref|upi|avl)|[.,;(]|$)/i,
      ]
    : [
        /\bfrom\s+vpa\s+([\w.\-]+@[a-z]+)/i,
        /\bfrom\s+([A-Za-z0-9&'.\- ]{2,40}?)(?=\s+(?:on|via|ref|upi|\(|-)|[.,;(]|$)/i,
        /\bby\s+(?:neft|imps|rtgs)[-\s/]+([A-Za-z0-9&'.\- ]{2,40}?)(?=[-/\s]+(?:ref|info|utr)|[.,;(]|$)/i,
        /\bby\s+([A-Za-z0-9&'.\- ]{2,40}?)(?=\s+(?:on|via|ref|upi)|[.,;(]|$)/i,
      ];
  for (const r of rx) {
    const m = t.match(r);
    if (m) {
      const name = cleanMerchant(m[1]);
      if (name) return name;
    }
  }
  return undefined;
}

// ── what to ignore ──────────────────────────────────────────────────────────
function skipReason(t: string): string | null {
  if (/\b(otp|one[\s-]?time\s+password|verification\s+code|do\s+not\s+share|never\s+share)\b/i.test(t)) return "One-time password message";
  if (/\b(declined|failed|unsuccessful|could\s+not\s+be\s+processed|not\s+processed|insufficient)\b/i.test(t)) return "Failed or declined transaction";
  if (/\b(reversed|reversal)\b/i.test(t)) return "Reversal — check the original entry";
  if (/\b(loan\s+(?:up\s*to|offer|of\s+up)|pre[\s-]?approved|apply\s+now|click\s+(?:here|link)|limited\s+period|cashback\s+offer|win\s+up)\b/i.test(t)) return "Looks like an offer, not a transaction";
  if (/\b(is\s+due|due\s+on|due\s+date|payment\s+due|min(?:imum)?\s+amount\s+due|bill\s+(?:is\s+)?generated|statement\s+(?:is\s+)?(?:generated|ready))\b/i.test(t) && !/\b(debited|credited|spent|received)\b/i.test(t)) return "A reminder, not a transaction — add it as a bill reminder";
  if (/\b(mandate|auto[\s-]?pay\s+(?:set|registered|created))\b/i.test(t) && !/\b(debited|credited)\b/i.test(t)) return "Mandate notice, no money moved";
  return null;
}

// ── main ────────────────────────────────────────────────────────────────────
export function parseMessage(raw: string, today = new Date()): ParsedMessage | Skipped {
  const text = raw.replace(/\s+/g, " ").trim();
  const skip = skipReason(text);
  if (skip) return { raw: text, reason: skip };

  const dir = direction(text);
  if (!dir) return { raw: text, reason: "No debit or credit found" };

  const verb = text.search(dir === "debit" ? DEBIT : CREDIT);
  let first = transactionAmount(text);
  if (!first) {
    const bare = text.match(/\b(?:debited|credited|spent|paid|withdrawn|received)\s+(?:by|for|with|of)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (bare) { const v = Number(bare[1].replace(/,/g, "")); if (v > 0 && v <= MAX_TRANSACTION_AMOUNT) first = { value: v, index: verb }; }
  }
  if (!first) return { raw: text, reason: "No amount found" };

  const balance = (() => {
    const m = text.match(/\b(?:avl\.?|avail(?:able)?|total|closing)?\s*bal(?:ance)?\.?\s*(?:is|:)?\s*(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i);
    return m ? Number(m[1].replace(/,/g, "")) : undefined;
  })();

  const lower = text.toLowerCase();
  const isAtm = /\batm\b|cash\s+withdrawal|withdrawn\s+(?:from\s+)?(?:an?\s+)?atm/.test(lower);
  const isCard = /\bcredit\s+card\b|\bcard\s+(?:ending|no|xx|x{2})|\bdebit\s+card\b|\bspent\s+on\b|\bcard\s*\*+\d/.test(lower) || /\bcard\b/.test(lower) && /\bspent|purchase|txn\b/.test(lower);
  const isUpi = /\bupi\b|\bvpa\b|@(?:ok|ybl|ibl|axl|paytm|apl|upi|sbi|icici|hdfcbank|axisbank|kotak)/.test(lower);
  const isNeft = /\b(neft|imps|rtgs)\b/.test(lower);
  const instrument: Instrument = isAtm ? "atm" : isCard ? "card" : isUpi ? "upi" : isNeft ? "neft" : "account";

  const warnings: string[] = [];
  const date = parseDate(text, today);
  if (!date) warnings.push("No date in the message — today's date will be used.");
  else if (date > `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate() + 1)}`) warnings.push("The date is in the future — check it.");

  const merchant = isAtm ? "ATM withdrawal" : findMerchant(text, dir);
  const hit = merchant ? lookupDictionary(stripNoise(merchant)) : null;
  const refM = text.match(/\b(?:upi\s*ref(?:\s*(?:no|id))?|ref(?:erence)?\s*(?:no|id)?|refno|utr|txn\s*id|rrn)\s*[:.\-#]?\s*([A-Za-z0-9]{6,22})/i);
  let category = hit?.category;
  let kind: ParsedMessage["kind"] = dir === "debit" ? "expense" : "income";
  if (isAtm && dir === "debit") kind = "cash_withdrawal";
  if (dir === "credit") {
    if (/\b(salary|sal\b|payroll)\b/i.test(text)) category = "Salary";
    else if (/\brefund\b/i.test(text)) { category = "Refund"; warnings.push("A refund — you may want to link it to the original purchase."); }
    else category = category ?? "Income";
  } else if (/\b(credit\s+card\s+(?:bill|payment)|card\s+bill|cc\s+payment)\b/i.test(text) && dir === "debit") {
    category = "Credit Card Bill";
    warnings.push("A card-bill payment. If you already logged the card purchases, this is repaying them, not new spending.");
  }
  if (dir === "debit" && isNeft && !merchant) warnings.push("Bank transfer with no clear payee — set the merchant.");

  let confidence = 0.55 + (merchant ? 0.15 : 0) + (date ? 0.1 : 0) + (refM ? 0.1 : 0) + (last4Of(text) ? 0.05 : 0) + (hit ? 0.05 : 0);
  confidence = Math.min(0.97, confidence);

  return {
    raw: text, direction: dir, kind, amount: first.value, date, merchant, category,
    last4: last4Of(text), instrument, ref: refM?.[1], balance, confidence: Number(confidence.toFixed(2)), warnings,
  };
}

export const isSkipped = (r: ParsedMessage | Skipped): r is Skipped => "reason" in r;

/** Parse everything the user pasted. */
export function parsePasted(blob: string, today = new Date()): ParseResult {
  const messages: ParsedMessage[] = [];
  const skipped: Skipped[] = [];
  for (const piece of splitMessages(blob)) {
    const r = parseMessage(piece, today);
    if (isSkipped(r)) skipped.push(r); else messages.push(r);
  }
  return { messages, skipped };
}

// ── duplicates ──────────────────────────────────────────────────────────────
type LedgerRow = { type: string; amount: number; date: string; title?: string; notes?: string };

const dayNum = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);

/**
 * Flags drafts that look like something already in the ledger (same amount and direction within a day)
 * or like an earlier draft in the same paste (same reference, or same amount/date/merchant).
 * Returns the indexes of probable duplicates; the review screen leaves them unticked.
 */
export function findDuplicates(drafts: ParsedMessage[], ledger: LedgerRow[], today = new Date()): Set<number> {
  const dup = new Set<number>();
  const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const seen = new Map<string, number>();
  drafts.forEach((d, i) => {
    const day = d.date ?? todayISO;
    const type = d.direction === "credit" ? "income" : "expense";
    if (ledger.some((t) => t.type === type && Math.round(Math.abs(t.amount) * 100) === Math.round(d.amount * 100) && Math.abs(dayNum(t.date) - dayNum(day)) <= 1)) dup.add(i);
    const key = d.ref ? `ref:${d.ref}` : `${day}|${d.amount}|${type}|${(d.merchant || "").toLowerCase()}`;
    if (seen.has(key)) dup.add(i); else seen.set(key, i);
  });
  return dup;
}

// ── matching to the user's own accounts and cards ──────────────────────────
type AccountLike = { id: string; maskedNumber?: string; bank?: string };
type CardLike = { id: string; last4Digits?: string };

/**
 * Link a message's last four digits to an account or card the user already recorded.
 * Cards win for card-style messages; an ambiguous match (two accounts ending the same) links nothing.
 */
export function matchInstrument(
  m: Pick<ParsedMessage, "last4" | "instrument">,
  accounts: AccountLike[],
  cards: CardLike[],
): { accountId?: string; creditCardId?: string } {
  if (!m.last4) return {};
  const cardHits = cards.filter((c) => (c.last4Digits || "").slice(-4) === m.last4);
  const acctHits = accounts.filter((a) => (a.maskedNumber || "").replace(/\D/g, "").slice(-4) === m.last4);
  if (m.instrument === "card" && cardHits.length === 1) return { creditCardId: cardHits[0].id };
  if (m.instrument !== "card" && acctHits.length === 1) return { accountId: acctHits[0].id };
  if (m.instrument === "card" && cardHits.length === 0 && acctHits.length === 1) return { accountId: acctHits[0].id }; // debit card
  return {};
}
