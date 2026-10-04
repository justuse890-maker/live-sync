/**
 * LiveSync Financial & Currency Utilities
 * Implements Indian Banking / RBI / Income Tax compliance standards:
 * 1. Single retail transaction cap (₹10 Crore / 100,000,000 INR).
 * 2. Cash transaction limit warning (Section 269ST Income Tax Act - ₹2 Lakh).
 * 3. Real-time Indian Numbering Words converter (Lakhs & Crores) like CRED & PhonePe.
 * 4. Input sanitization (blocks typing 10+ digits, phone numbers, extra decimals).
 */

export const MAX_TRANSACTION_AMOUNT = 100_000_000; // ₹10 Crore (Upper retail threshold)
export const CASH_TRANSACTION_LIMIT = 200_000;    // ₹2 Lakh (Section 269ST IT Act)
export const HIGH_VALUE_TRANSACTION_THRESHOLD = 5_000_000; // ₹50 Lakh

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen"
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o > 0 ? " " + ONES[o] : "");
}

function threeDigitsToWords(n: number): string {
  const h = Math.floor(n / 100);
  const rem = n % 100;
  let res = "";
  if (h > 0) res += ONES[h] + " Hundred";
  if (rem > 0) {
    if (res) res += " ";
    res += twoDigitsToWords(rem);
  }
  return res;
}

/**
 * Convert numeric amount into Indian Currency Words (Lakhs & Crores).
 * Example:
 * 500 -> "Five Hundred Rupees"
 * 75000 -> "Seventy-Five Thousand Rupees"
 * 450000 -> "Four Lakh Fifty Thousand Rupees"
 * 12500000 -> "One Crore Twenty-Five Lakh Rupees"
 */
export function numberToIndianWords(amount: number): string {
  if (!isFinite(amount) || isNaN(amount) || amount <= 0) return "";
  if (amount > MAX_TRANSACTION_AMOUNT) return "Exceeds Maximum ₹10 Crore Limit";

  const intPart = Math.floor(amount);
  const decimalPart = Math.round((amount - intPart) * 100);

  if (intPart === 0 && decimalPart > 0) {
    return `${twoDigitsToWords(decimalPart)} Paise Only`;
  }

  // Indian numbering breakdown:
  // Crores (10,000,000)
  // Lakhs (100,000)
  // Thousands (1,000)
  // Hundreds (100)
  const crore = Math.floor(intPart / 10_000_000);
  const afterCrore = intPart % 10_000_000;

  const lakh = Math.floor(afterCrore / 100_000);
  const afterLakh = afterCrore % 100_000;

  const thousand = Math.floor(afterLakh / 1_000);
  const remainder = afterLakh % 1_000;

  const parts: string[] = [];

  if (crore > 0) {
    parts.push(crore < 100 ? twoDigitsToWords(crore) + " Crore" : threeDigitsToWords(crore) + " Crore");
  }
  if (lakh > 0) {
    parts.push(twoDigitsToWords(lakh) + " Lakh");
  }
  if (thousand > 0) {
    parts.push(twoDigitsToWords(thousand) + " Thousand");
  }
  if (remainder > 0) {
    parts.push(threeDigitsToWords(remainder));
  }

  let words = parts.join(" ") + " Rupees";

  if (decimalPart > 0) {
    words += ` and ${twoDigitsToWords(decimalPart)} Paise`;
  }

  return words + " Only";
}

/**
 * Sanitizes numeric input for financial amounts:
 * - Allows only digits and one decimal point
 * - Restricts integer part to max 9 digits (up to ₹99,99,99,999)
 * - Restricts decimals to max 2 digits (.00)
 */
export function sanitizeAmountInput(raw: string): string {
  if (!raw) return "";
  
  // Remove non-digit and non-period characters
  let clean = raw.replace(/[^0-9.]/g, "");

  // Allow only single decimal point
  const dotIndex = clean.indexOf(".");
  if (dotIndex !== -1) {
    const intPart = clean.slice(0, dotIndex).replace(/\./g, "");
    const decPart = clean.slice(dotIndex + 1).replace(/\./g, "").slice(0, 2); // max 2 decimals
    // Cap integer part to 9 digits
    const cappedInt = intPart.slice(0, 9);
    return `${cappedInt}.${decPart}`;
  }

  // Integer only, capped at 9 digits
  return clean.slice(0, 9);
}

export type AmountValidation = {
  valid: boolean;
  error?: string;
  warning?: string;
};

/**
 * Validates financial amount against RBI & regulatory limits
 */
export function validateTransactionAmount(amount: number, paymentMode?: string): AmountValidation {
  if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
    return { valid: false, error: "Please enter a valid amount greater than ₹0." };
  }

  if (amount > MAX_TRANSACTION_AMOUNT) {
    return {
      valid: false,
      error: "Amount cannot exceed ₹10 Crore (₹10,00,00,000) per retail compliance.",
    };
  }

  // Income Tax Act Section 269ST compliance warning for cash >= ₹2 Lakh
  if (paymentMode === "cash" && amount >= CASH_TRANSACTION_LIMIT) {
    return {
      valid: true,
      warning: "⚠️ IT Act Sec 269ST: Cash transactions of ₹2 Lakh or more are restricted by Indian law.",
    };
  }

  // High value advisory for amounts above ₹50 Lakh
  if (amount >= HIGH_VALUE_TRANSACTION_THRESHOLD) {
    return {
      valid: true,
      warning: "ℹ️ High-value entry: Please double-check the figures before recording.",
    };
  }

  return { valid: true };
}
