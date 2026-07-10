export type CountryCode = "IN" | "US" | "GB" | "AE" | "SG";

export type TaxSlab = { upTo: number | null; rate: number };
export type TaxPack = {
  code: CountryCode;
  name: string;
  flag: string;
  currency: string;
  symbol: string;
  locale: string;
  fiscalYearStart: string; // MM-DD
  standardDeduction: number;
  slabs: TaxSlab[];
  notes: string;
};

export const TAX_PACKS: Record<CountryCode, TaxPack> = {
  IN: {
    code: "IN", name: "India", flag: "🇮🇳",
    currency: "INR", symbol: "₹", locale: "en-IN",
    fiscalYearStart: "04-01",
    standardDeduction: 75000,
    slabs: [
      { upTo: 300000, rate: 0 },
      { upTo: 700000, rate: 0.05 },
      { upTo: 1000000, rate: 0.10 },
      { upTo: 1200000, rate: 0.15 },
      { upTo: 1500000, rate: 0.20 },
      { upTo: null, rate: 0.30 },
    ],
    notes: "New tax regime (FY 2024-25). Standard deduction ₹75,000 for salaried.",
  },
  US: {
    code: "US", name: "United States", flag: "🇺🇸",
    currency: "USD", symbol: "$", locale: "en-US",
    fiscalYearStart: "01-01",
    standardDeduction: 14600,
    slabs: [
      { upTo: 11600, rate: 0.10 },
      { upTo: 47150, rate: 0.12 },
      { upTo: 100525, rate: 0.22 },
      { upTo: 191950, rate: 0.24 },
      { upTo: 243725, rate: 0.32 },
      { upTo: 609350, rate: 0.35 },
      { upTo: null, rate: 0.37 },
    ],
    notes: "Federal income tax, single filer (2024). State tax not included.",
  },
  GB: {
    code: "GB", name: "United Kingdom", flag: "🇬🇧",
    currency: "GBP", symbol: "£", locale: "en-GB",
    fiscalYearStart: "04-06",
    standardDeduction: 12570,
    slabs: [
      { upTo: 12570, rate: 0 },
      { upTo: 50270, rate: 0.20 },
      { upTo: 125140, rate: 0.40 },
      { upTo: null, rate: 0.45 },
    ],
    notes: "Personal allowance £12,570. Excludes Scotland’s separate bands.",
  },
  AE: {
    code: "AE", name: "United Arab Emirates", flag: "🇦🇪",
    currency: "AED", symbol: "د.إ", locale: "en-AE",
    fiscalYearStart: "01-01",
    standardDeduction: 0,
    slabs: [{ upTo: null, rate: 0 }],
    notes: "No personal income tax. 5% VAT applies to most goods/services.",
  },
  SG: {
    code: "SG", name: "Singapore", flag: "🇸🇬",
    currency: "SGD", symbol: "S$", locale: "en-SG",
    fiscalYearStart: "01-01",
    standardDeduction: 0,
    slabs: [
      { upTo: 20000, rate: 0 },
      { upTo: 30000, rate: 0.02 },
      { upTo: 40000, rate: 0.035 },
      { upTo: 80000, rate: 0.07 },
      { upTo: 120000, rate: 0.115 },
      { upTo: 160000, rate: 0.15 },
      { upTo: 200000, rate: 0.18 },
      { upTo: 240000, rate: 0.19 },
      { upTo: 280000, rate: 0.195 },
      { upTo: 320000, rate: 0.20 },
      { upTo: null, rate: 0.22 },
    ],
    notes: "Resident progressive rates. GST 9%.",
  },
};

export const COUNTRY_OPTIONS: { code: CountryCode; name: string; flag: string }[] = [
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
];

export function fmt(amount: number, country: CountryCode = "IN"): string {
  const pack = TAX_PACKS[country];
  return pack.symbol + Math.abs(amount).toLocaleString(pack.locale, { maximumFractionDigits: 0 });
}

export function computeTax(annualIncome: number, country: CountryCode): number {
  const pack = TAX_PACKS[country];
  const taxable = Math.max(0, annualIncome - pack.standardDeduction);
  let owed = 0;
  let prevCap = 0;
  for (const slab of pack.slabs) {
    const cap = slab.upTo ?? Infinity;
    if (taxable > prevCap) {
      const inThisSlab = Math.min(taxable, cap) - prevCap;
      owed += inThisSlab * slab.rate;
    }
    prevCap = cap;
    if (taxable <= cap) break;
  }
  return Math.round(owed);
}
