// Capture pipeline — turns raw natural-language text (from voice transcript
// or OCR'd receipt) into structured transaction drafts. Pure functions only,
// no React. Used by QuickAdd's Voice + Scan tabs.

export type ReceiptTaxDetails = {
  gst?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  vat?: number;
  totalTax?: number;
  gstin?: string;
  taxRatePct?: number;
};

export type ReceiptLineItem = {
  name: string;
  qty?: number;
  price?: number;
};

export type CapturedTx = {
  amount: number;
  merchant?: string;
  category?: string;
  date?: string; // YYYY-MM-DD
  notes?: string;
  type: "expense" | "income";
  confidence: number; // 0–1
  // Detailed OCR trace fields
  subtotal?: number;
  tax?: ReceiptTaxDetails;
  discount?: number;
  invoiceNumber?: string;
  paymentMode?: string;
  items?: ReceiptLineItem[];
  rawText?: string;
  /** Things the user should double-check (shown in the review card). */
  warnings?: string[];
};

// Quick merchant/category fingerprints — keeps detection deterministic and
// avoids an LLM round-trip for the obvious 80%.
const CATEGORY_RULES: { rx: RegExp; cat: string }[] = [
  { rx: /swiggy|zomato|dunzo|eatsure|restaurant|cafe|coffee|starbucks|mcdonald|kfc|dominos|pizza|lunch|dinner|breakfast|chai|tea|bakery|dosa|bistro|kitchen|dhaba/i, cat: "Food" },
  { rx: /uber|ola|rapido|metro|bus|train|petrol|fuel|cab|taxi|toll|parking|fastag/i, cat: "Travel" },
  { rx: /bigbasket|blinkit|zepto|grofers|grocery|dmart|reliance\s*fresh|supermarket|kirana|spencer|more\s*retail/i, cat: "Grocery" },
  { rx: /amazon|flipkart|myntra|ajio|shopping|nykaa|zara|h&m|decathlon|croma|reliance\s*digital/i, cat: "Shopping" },
  { rx: /netflix|spotify|prime|hotstar|jio\s*cinema|subscription|youtube|apple\s*services/i, cat: "Subscriptions" },
  { rx: /electric|water|wifi|internet|broadband|rent|bill|recharge|bescom|tneb|mahadiscom|tata\s*power/i, cat: "Bills" },
  { rx: /apollo|pharmacy|medical|doctor|hospital|medicine|medplus|diagnostics|practo/i, cat: "Medical" },
  { rx: /movie|pvr|inox|book|entertainment|concert|cinepolis|amusement/i, cat: "Entertainment" },
];

const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

/** Split a single voice utterance into multiple expense fragments. */
function splitFragments(text: string): string[] {
  return text
    .split(/(?:,|;|\bthen\b|\band then\b|\balso\b|\band\b)/i)
    .map((s) => s.trim())
    .filter((s) => /\d/.test(s)); // must contain a number
}

import { MAX_TRANSACTION_AMOUNT } from "./currencyUtils";

/** Extract amount: ₹500, 500 rupees, rs 500, 500/-, USD 5, $5. Returns 0 if none. Caps at MAX_TRANSACTION_AMOUNT. */
function extractAmount(s: string): number {
  // Ignore 10-digit Indian phone numbers (starting with 6, 7, 8, 9)
  if (/\b[6-9]\d{9}\b/.test(s) && !/(?:₹|rs\.?|inr)/i.test(s)) {
    return 0;
  }

  // INR variants
  const inr = s.match(/(?:₹|rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d+)?)/i)
    || s.match(/([\d,]+(?:\.\d+)?)\s*(?:rupees?|inr|rs\.?|\/-)/i);
  if (inr) {
    const val = Number(inr[1].replace(/,/g, ""));
    if (val > 0 && val <= MAX_TRANSACTION_AMOUNT) return val;
    return 0;
  }

  // Bare number (often the only digit-token in a voice phrase)
  const bare = s.match(/\b([\d,]+(?:\.\d+)?)\b/);
  if (bare) {
    const n = Number(bare[1].replace(/,/g, ""));
    // Discard phone numbers (10 digits starting 6-9) or numbers > MAX_TRANSACTION_AMOUNT
    if (n > 0 && n <= MAX_TRANSACTION_AMOUNT && !/^[6-9]\d{9}$/.test(bare[1].replace(/,/g, ""))) {
      return n;
    }
  }
  return 0;
}

/** Pull a relative date phrase. Returns ISO YYYY-MM-DD or undefined. */
function extractDate(s: string): string | undefined {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  if (/\btoday\b/i.test(s)) return iso(today);
  if (/\byesterday\b/i.test(s)) { const d = new Date(today); d.setDate(d.getDate() - 1); return iso(d); }
  if (/\btomorrow\b/i.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 1); return iso(d); }

  const days = s.match(/\b(\d+)\s*days?\s*ago\b/i);
  if (days) { const d = new Date(today); d.setDate(d.getDate() - Number(days[1])); return iso(d); }

  // Slashed/hyphenated DD/MM/YYYY or DD-MM-YYYY (standard Indian receipt format)
  const ddmmyyyy = s.match(/\b([0-3]?\d)[\/\-\.]([0-1]?\d)[\/\-\.](\d{2,4})\b/);
  if (ddmmyyyy) {
    const d = Number(ddmmyyyy[1]);
    const m = Number(ddmmyyyy[2]);
    let y = Number(ddmmyyyy[3]);
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // "15 Jun 2026" or "Jun 15, 2026"
  const m1 = s.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*,?\s*(\d{2,4})?\b/i);
  const m2 = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})\s*,?\s*(\d{2,4})?\b/i);
  const day = m1 ? Number(m1[1]) : m2 ? Number(m2[2]) : undefined;
  const mon = m1 ? m1[2] : m2 ? m2[1] : undefined;
  const yearStr = m1 ? m1[3] : m2 ? m2[3] : undefined;
  if (day && mon) {
    let y = yearStr ? Number(yearStr) : today.getFullYear();
    if (y < 100) y += 2000;
    const mIdx = MONTHS.indexOf(mon.toLowerCase().slice(0, 3));
    return `${y}-${String(mIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // Slashed YYYY-MM-DD
  const isoMatch = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return isoMatch[0];

  return undefined;
}

function extractCategory(s: string): string | undefined {
  for (const r of CATEGORY_RULES) if (r.rx.test(s)) return r.cat;
  return undefined;
}

function extractMerchant(s: string, knownMerchants: string[] = []): string | undefined {
  for (const m of knownMerchants) {
    if (new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s)) return m;
  }
  // Common merchants seen in receipts/voice
  const m = s.match(/\b(swiggy|zomato|uber|ola|rapido|bigbasket|amazon|flipkart|netflix|spotify|apollo|starbucks|mcdonald'?s|kfc|dominos|pizza\s*hut|myntra|nykaa|dmart|blinkit|zepto)\b/i);
  if (m) return titleCase(m[1]);
  // "on/at <word>"
  const at = s.match(/\b(?:at|on|from|to)\s+([A-Za-z][A-Za-z0-9'&\s]{1,30})/);
  if (at) return titleCase(at[1].trim());
  return undefined;
}

function titleCase(s: string) {
  return s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).trim();
}

function detectType(s: string): "expense" | "income" {
  if (/\b(received|earned|salary|credited|got paid|refund|credit\s*of)\b/i.test(s)) return "income";
  return "expense";
}

/** Parse a single fragment. */
export function parseFragment(text: string, knownMerchants: string[] = []): CapturedTx | null {
  const amount = extractAmount(text);
  if (amount <= 0) return null;
  const category = extractCategory(text);
  const merchant = extractMerchant(text, knownMerchants);
  const date = extractDate(text);
  const type = detectType(text);

  let confidence = 0.4;
  if (category) confidence += 0.2;
  if (merchant) confidence += 0.2;
  if (date) confidence += 0.2;

  return { amount, category, merchant, date, type, confidence };
}

/** Parse a free-form voice utterance into one or more drafts. */
export function parseUtterance(text: string, knownMerchants: string[] = []): CapturedTx[] {
  const fragments = splitFragments(text);
  if (fragments.length === 0) {
    const one = parseFragment(text, knownMerchants);
    return one ? [one] : [];
  }
  return fragments.map((f) => parseFragment(f, knownMerchants)).filter((x): x is CapturedTx => !!x);
}

/** Extract number after matching a regex on line */
function extractNumberFromLine(line: string, pattern: RegExp): number | undefined {
  const match = line.match(pattern);
  if (!match) return undefined;
  const valStr = match[match.length - 1];
  if (!valStr) return undefined;
  const n = Number(valStr.replace(/[^\d.]/g, ""));
  return isNaN(n) ? undefined : n;
}

// ─── Receipt money tokenizer ────────────────────────────────────────────────
// Receipts put the amount at the right end of a line ("Total   1,234.50").
// We read every money-looking token, drop percentages, quantities like "x2",
// phone numbers, GSTINs and long IDs, and keep the LAST one on the line.

/** Fix common OCR confusions inside numeric tokens (O→0, l/I→1, S→5, B→8). */
function normaliseDigits(line: string): string {
  return line.replace(/(?<=[\d₹.,])[Oo]|[Oo](?=[\d.,]\d)/g, "0")
    .replace(/(?<=\d)[lI|]|[lI|](?=\d)/g, "1")
    .replace(/(?<=\d)S(?=\d)/g, "5")
    .replace(/(?<=\d)B(?=\d)/g, "8")
    .replace(/(\d)\s*[.,]\s*(\d{2})\b/g, "$1.$2"); // "450 . 00" / "450,00" → 450.00
}

function moneyTokens(rawLine: string): number[] {
  const line = normaliseDigits(rawLine)
    .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g, " ")       // GSTIN
    .replace(/\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g, " ")                        // phone
    .replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, " ")                  // dates
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi, " ");          // times
  const out: number[] = [];
  const rx = /(₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d+)(\.\d{1,2})?(\s*%)?/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(line))) {
    if (m[4]) continue;                                  // 18% → rate, not money
    const intPart = m[2].replace(/,/g, "");
    if (!m[1] && !m[3] && intPart.length > 7) continue;  // long IDs / bill numbers
    const prev = line.slice(Math.max(0, m.index - 2), m.index);
    if (/[xX*@]\s?$/.test(prev)) continue;               // "x 2", "@ 50" quantities/rates
    const v = Number(intPart + (m[3] || ""));
    if (v > 0 && v <= MAX_TRANSACTION_AMOUNT) out.push(v);
  }
  return out;
}

/** Strip OCR edge noise: receipt borders read as | ~ ! and stray 1–2 char blobs at line ends. */
function cleanOcrLine(raw: string): string {
  return raw
    .replace(/^[^\w₹\u0900-\u097F]+/, "")
    .replace(/(?:\s{2,}[^\s\d₹]{1,2}\)?)+\s*$/, "")
    .replace(/(?:\s{2,}\d\))\s*$/, "")
    .replace(/[|~¦_]+\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const lastMoney = (line?: string) => {
  if (!line) return 0;
  const t = moneyTokens(line);
  return t.length ? t[t.length - 1] : 0;
};

// Ordered by how reliably they mean "what you actually paid". English + Hindi.
const TOTAL_KEYWORDS: RegExp[] = [
  /\b(grand\s*total|net\s*payable|amount\s*payable|total\s*payable|net\s*amount|bill\s*amount|amount\s*paid|total\s*amount|amt\s*payable|to\s*pay)\b|कुल\s*देय|कुल\s*राशि|देय\s*राशि/i,
  /\b(total|amount\s*due|balance\s*due|net\s*total)\b|कुल|योग/i,
];
const NOT_TOTAL = /sub\s*-?\s*total|total\s*(qty|quantity|items?|savings?|discount|tax|gst|mrp|weight)|items?\s*total|taxable|round\s*off|you\s*saved|tender|change\s*due|cash\s*tendered/i;

function findTotal(lines: string[]): { value: number; line?: string } {
  for (const rx of TOTAL_KEYWORDS) {
    // Bottom-up: the final total is near the end of a receipt.
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      if (!rx.test(l) || NOT_TOTAL.test(l)) continue;
      const v = lastMoney(l) || lastMoney(lines[i + 1]); // amount sometimes wraps to next line
      if (v > 0) return { value: v, line: l };
    }
  }
  return { value: 0 };
}

function receiptDate(text: string): string | undefined {
  const d = extractDate(text);
  if (!d) return undefined;
  const dt = new Date(`${d}T12:00:00`);
  if (isNaN(dt.getTime())) return undefined;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const fiveYearsAgo = new Date(); fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  return dt <= tomorrow && dt >= fiveYearsAgo ? d : undefined; // reject impossible dates
}

/**
 * Parse OCR'd receipt text into a reviewable draft.
 * Every field is either read from the receipt or left empty — nothing is guessed
 * except where noted in `warnings`, which the UI shows to the user.
 */
export function parseReceipt(text: string, knownMerchants: string[] = [], ocrConfidence?: number): CapturedTx | null {
  const lines = text.split(/\r?\n/).map(cleanOcrLine).filter((l) => l.length > 1);
  if (lines.length === 0) return null;
  const warnings: string[] = [];

  // 1. Subtotal, discount, round-off
  let subtotal: number | undefined;
  const subLine = lines.find((l) => /sub\s*-?\s*total|item\s*total|gross\s*(?:total|amount)|taxable\s*(?:value|amount)/i.test(l));
  if (subLine) subtotal = lastMoney(subLine) || undefined;

  let discount: number | undefined;
  const discLine = lines.find((l) => /\b(discount|disc\.?|coupon|you\s*saved|savings)\b/i.test(l));
  if (discLine) discount = lastMoney(discLine) || undefined;

  // 2. Taxes
  const taxInfo: ReceiptTaxDetails = {};
  const gstinMatch = text.toUpperCase().replace(/\s/g, "").match(/\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]/);
  if (gstinMatch) taxInfo.gstin = gstinMatch[0];
  const rate = text.match(/(?:gst|cgst|sgst|igst)\s*@?\s*(\d{1,2}(?:\.\d)?)\s*%/i);
  if (rate) taxInfo.taxRatePct = Number(rate[1]);
  for (const line of lines) {
    if (/taxable|gstin/i.test(line)) continue;
    const v = lastMoney(line);
    if (!v) continue;
    if (/\bcgst\b/i.test(line)) taxInfo.cgst = (taxInfo.cgst || 0) + v;
    else if (/\b[su]gst\b/i.test(line)) taxInfo.sgst = (taxInfo.sgst || 0) + v;
    else if (/\bigst\b/i.test(line)) taxInfo.igst = (taxInfo.igst || 0) + v;
    else if (/\b(vat|sales\s*tax|cess)\b/i.test(line)) taxInfo.vat = (taxInfo.vat || 0) + v;
    else if (/\b(total\s*)?(gst|tax(es)?)\b/i.test(line) && !/invoice|incl|inclusive/i.test(line)) taxInfo.totalTax = v;
  }
  const composite = (taxInfo.cgst || 0) + (taxInfo.sgst || 0) + (taxInfo.igst || 0) + (taxInfo.vat || 0);
  if (!taxInfo.totalTax && composite > 0) taxInfo.totalTax = Number(composite.toFixed(2));

  // Line items: "Masala Dosa 2 240.00"
  const items: ReceiptLineItem[] = [];
  for (const line of lines) {
    if (/total|tax|gst|discount|cash|change|due|balance|round|payable|amount|upi|card|date|दिनांक|कुल/i.test(line)) continue;
    if (/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/.test(line)) continue;
    const m = normaliseDigits(line).match(/^([A-Za-z\u0900-\u097F][A-Za-z0-9\u0900-\u097F\s&'().-]{2,40}?)\s+(?:(\d{1,3})\s*(?:x|nos?|pcs?)?\s+)?(?:₹|rs\.?)?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?)$/i);
    if (m && !/^(rs|inr)\.?$/i.test(m[1].trim())) items.push({ name: m[1].trim(), qty: m[2] ? Number(m[2]) : 1, price: Number(m[3].replace(/,/g, "")) });
  }

  // 3. Total paid
  let { value: grandTotal } = findTotal(lines);
  let totalSource: "label" | "computed" | "largest" = "label";
  if (!grandTotal && subtotal) {
    grandTotal = Number((subtotal + (taxInfo.totalTax || 0) - (discount || 0)).toFixed(2));
    totalSource = "computed";
    warnings.push("Total was calculated from subtotal + tax — please check it.");
  }
  if (!grandTotal && items.length >= 2) {
    grandTotal = Number(items.reduce((a, it) => a + (it.price || 0), 0).toFixed(2));
    totalSource = "computed";
    warnings.push("No 'Total' line was found — we added up the items. Please check.");
  }
  if (!grandTotal) {
    // Last resort: largest amount written with paise (e.g. 1,234.00)
    const withPaise = lines.flatMap((l) => (/\.\d{2}\b/.test(l) ? moneyTokens(l) : []));
    if (withPaise.length) {
      grandTotal = Math.max(...withPaise);
      totalSource = "largest";
      warnings.push("No 'Total' line was found — we picked the largest amount. Please confirm.");
    }
  }
  if (grandTotal <= 0) return null;

  // Cross-check: subtotal + tax − discount ≈ total
  let consistent = false;
  if (subtotal && totalSource === "label") {
    const tol = Math.max(2, grandTotal * 0.01);
    const withTax = subtotal + (taxInfo.totalTax || 0);
    // Discount may or may not already be inside the subtotal; prices may be tax-inclusive.
    consistent = [withTax, withTax - (discount || 0), subtotal, subtotal - (discount || 0)].some((e) => Math.abs(e - grandTotal) <= tol);
    if (!consistent) warnings.push("Subtotal, tax and total don't add up exactly — check the total.");
  }

  // 4. Invoice / bill number
  let invoiceNumber: string | undefined;
  for (const line of lines.slice(0, 15)) {
    const inv = line.match(/(?:invoice|inv|bill|receipt|token|order|txn)\.?\s*(?:no\.?|num(?:ber)?|#|id)\s*[:.\-]?\s*([A-Za-z0-9/-]{2,24})/i)
      || line.match(/\b(?:inv|rcpt)\.?\s*#?\s*[:\-]?\s*([A-Za-z0-9/-]{2,24})/i);
    if (inv?.[1] && /\d/.test(inv[1])) { invoiceNumber = inv[1]; break; }
  }

  // 5. Payment mode
  let paymentMode: string | undefined;
  const payLine = lines.find((l) => /\b(upi|gpay|google\s*pay|phonepe|paytm|bhim|cash|credit\s*card|debit\s*card|card|visa|master\s*card|rupay)\b/i.test(l));
  if (payLine) {
    if (/upi|gpay|google\s*pay|phonepe|paytm|bhim/i.test(payLine)) paymentMode = "UPI";
    else if (/credit/i.test(payLine)) paymentMode = "Credit Card";
    else if (/debit|rupay/i.test(payLine)) paymentMode = "Debit Card";
    else if (/cash/i.test(payLine)) paymentMode = "Cash";
    else paymentMode = "Card";
  }

  // 6. Merchant: a known brand anywhere, else the first plausible name line at the top
  const brand = knownMerchants.find((m) => new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text))
    ?? text.match(/\b(swiggy|zomato|uber|ola|rapido|bigbasket|amazon|flipkart|netflix|spotify|apollo|starbucks|mcdonald'?s|kfc|domino'?s|pizza\s*hut|myntra|nykaa|d-?mart|blinkit|zepto|reliance\s*(?:fresh|smart|digital|trends)|more\s*retail|spencer'?s|croma|decathlon|medplus|haldiram'?s|cafe\s*coffee\s*day|burger\s*king|subway)\b/i)?.[1];
  const headerLine = lines.slice(0, 6).find((l) =>
    /[A-Za-z\u0900-\u097F]{3}/.test(l) && l.length <= 45 && moneyTokens(l).length === 0 &&
    !/total|invoice|gst|tax|bill|receipt|welcome|thank|cashier|date|time|token|address|road|street|nagar|tel|ph[.: ]|phone|mob|fssai|cin|pan|www\.|@/i.test(l));
  const merchant = brand ? titleCase(brand) : headerLine ? titleCase(headerLine.replace(/[^A-Za-z0-9&'.\s\u0900-\u097F-]/g, "").trim()) : undefined;

  // 7. Category (only when the receipt text clearly says so) & date
  const category = extractCategory(text);
  const date = receiptDate(text);
  if (!date) warnings.push("Date not found on the receipt — today's date will be used.");


  // 9. Notes for the transaction (kept on device)
  const noteParts: string[] = [];
  if (invoiceNumber) noteParts.push(`Bill #${invoiceNumber}`);
  if (subtotal) noteParts.push(`Subtotal ₹${subtotal}`);
  if (taxInfo.totalTax) {
    const parts = [taxInfo.cgst && `CGST ₹${taxInfo.cgst}`, taxInfo.sgst && `SGST ₹${taxInfo.sgst}`, taxInfo.igst && `IGST ₹${taxInfo.igst}`].filter(Boolean).join(", ");
    noteParts.push(`Tax ₹${taxInfo.totalTax}${parts ? ` (${parts})` : ""}`);
  }
  if (discount) noteParts.push(`Discount ₹${discount}`);
  if (taxInfo.gstin) noteParts.push(`GSTIN ${taxInfo.gstin}`);
  if (paymentMode) noteParts.push(`Paid via ${paymentMode}`);

  // 10. Confidence = how sure we are the TOTAL is right (what matters most)
  let confidence = totalSource === "label" ? 0.7 : totalSource === "computed" ? 0.5 : 0.35;
  if (consistent) confidence += 0.15;
  if (merchant) confidence += 0.05;
  if (date) confidence += 0.05;
  if (taxInfo.gstin || invoiceNumber) confidence += 0.05;
  if (ocrConfidence != null) confidence *= Math.min(1, Math.max(0.5, ocrConfidence / 80));

  return {
    amount: grandTotal,
    merchant: merchant || undefined,
    category,
    date,
    type: "expense",
    confidence: Number(Math.min(0.98, confidence).toFixed(2)),
    subtotal,
    tax: Object.keys(taxInfo).length > 0 ? taxInfo : undefined,
    discount,
    invoiceNumber,
    paymentMode,
    items: items.length > 0 ? items.slice(0, 30) : undefined,
    notes: noteParts.length ? `Receipt scan · ${noteParts.join(" · ")}` : undefined,
    rawText: text,
    warnings: warnings.length ? warnings : undefined,
  };
}
