// Capture pipeline — turns raw natural-language text (from voice transcript
// or OCR'd receipt) into structured transaction drafts. Pure functions only,
// no React. Used by QuickAdd's Voice + Scan tabs.

export type CapturedTx = {
  amount: number;
  merchant?: string;
  category?: string;
  date?: string; // YYYY-MM-DD
  notes?: string;
  type: "expense" | "income";
  confidence: number; // 0–1
};

// Quick merchant/category fingerprints — keeps detection deterministic and
// avoids an LLM round-trip for the obvious 80%.
const CATEGORY_RULES: { rx: RegExp; cat: string }[] = [
  { rx: /swiggy|zomato|dunzo|eatsure|restaurant|cafe|coffee|starbucks|mcdonald|kfc|dominos|pizza|lunch|dinner|breakfast|chai|tea/i, cat: "Food" },
  { rx: /uber|ola|rapido|metro|bus|train|petrol|fuel|cab|taxi/i, cat: "Travel" },
  { rx: /bigbasket|blinkit|zepto|grofers|grocery|dmart|reliance\s*fresh/i, cat: "Grocery" },
  { rx: /amazon|flipkart|myntra|ajio|shopping|nykaa/i, cat: "Shopping" },
  { rx: /netflix|spotify|prime|hotstar|jio\s*cinema|subscription/i, cat: "Subscriptions" },
  { rx: /electric|water|wifi|internet|broadband|rent|bill|recharge/i, cat: "Bills" },
  { rx: /apollo|pharmacy|medical|doctor|hospital|medicine/i, cat: "Medical" },
  { rx: /movie|pvr|inox|book|entertainment|concert/i, cat: "Entertainment" },
];

const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

/** Split a single voice utterance into multiple expense fragments. */
function splitFragments(text: string): string[] {
  // Split on conjunctions and strong punctuation.
  return text
    .split(/(?:,|;|\bthen\b|\band then\b|\balso\b|\band\b)/i)
    .map((s) => s.trim())
    .filter((s) => /\d/.test(s)); // must contain a number
}

/** Extract amount: ₹500, 500 rupees, rs 500, 500/-, USD 5, $5. Returns 0 if none. */
function extractAmount(s: string): number {
  // INR variants
  const inr = s.match(/(?:₹|rs\.?|inr|rupees?)\s*([\d,]+(?:\.\d+)?)/i)
    || s.match(/([\d,]+(?:\.\d+)?)\s*(?:rupees?|inr|rs\.?|\/-)/i);
  if (inr) return Number(inr[1].replace(/,/g, ""));

  // Bare number (often the only digit-token in a voice phrase)
  const bare = s.match(/\b([\d,]+(?:\.\d+)?)\b/);
  if (bare) {
    const n = Number(bare[1].replace(/,/g, ""));
    if (n > 0 && n < 10_000_000) return n;
  }
  return 0;
}

/** Pull a relative date phrase. Returns ISO YYYY-MM-DD or undefined. */
function extractDate(s: string): string | undefined {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  if (/\btoday\b/i.test(s)) return iso(today);
  if (/\byesterday\b/i.test(s)) { const d = new Date(today); d.setDate(d.getDate() - 1); return iso(d); }
  if (/\btomorrow\b/i.test(s)) { const d = new Date(today); d.setDate(d.getDate() + 1); return iso(d); }

  const days = s.match(/\b(\d+)\s*days?\s*ago\b/i);
  if (days) { const d = new Date(today); d.setDate(d.getDate() - Number(days[1])); return iso(d); }

  // "Jun 5" or "5 Jun"
  const m1 = s.match(/\b(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i);
  const m2 = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(\d{1,2})\b/i);
  const day = m1 ? Number(m1[1]) : m2 ? Number(m2[2]) : undefined;
  const mon = m1 ? m1[2] : m2 ? m2[1] : undefined;
  if (day && mon) {
    const d = new Date(today.getFullYear(), MONTHS.indexOf(mon.toLowerCase()), day);
    return iso(d);
  }

  // Slashed YYYY-MM-DD or DD/MM/YYYY
  const isoMatch = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return isoMatch[0];
  const slash = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (slash) {
    const y = slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
    const d = new Date(y, Number(slash[2]) - 1, Number(slash[1]));
    return iso(d);
  }

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

  // Confidence: amount mandatory, +0.2 each for category/merchant/date.
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

/** Parse OCR'd receipt text. Looks for TOTAL line; merchant from top line. */
export function parseReceipt(text: string, knownMerchants: string[] = []): CapturedTx | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  // Total line preferred
  const totalLine = lines.find((l) => /\b(total|grand\s*total|amount\s*due|net\s*payable|net\s*amount)\b/i.test(l));
  const amount = totalLine ? extractAmount(totalLine) : 0;
  // Fallback: largest amount in the receipt
  let finalAmount = amount;
  if (!finalAmount) {
    const nums = lines.flatMap((l) => {
      const m = l.match(/(?:₹|rs\.?)\s*([\d,]+(?:\.\d+)?)/gi) || [];
      return m.map((x) => Number(x.replace(/[^\d.]/g, "")));
    });
    finalAmount = nums.length ? Math.max(...nums) : 0;
  }
  if (finalAmount <= 0) return null;

  // Merchant: first non-numeric line near the top
  const merchant = lines.slice(0, 3).find((l) => l.length > 2 && !/^\d/.test(l) && !/total|invoice|gst|tax/i.test(l));
  const category = extractCategory(text);
  const date = extractDate(text);

  let confidence = 0.5;
  if (merchant) confidence += 0.2;
  if (category) confidence += 0.15;
  if (date) confidence += 0.15;

  return {
    amount: finalAmount,
    merchant: merchant ? titleCase(merchant.slice(0, 40)) : extractMerchant(text, knownMerchants),
    category,
    date,
    type: "expense",
    confidence,
  };
}
