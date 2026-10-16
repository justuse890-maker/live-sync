export type ScreenId =
  | "dashboard"
  | "household"
  | "transactions"
  | "goals"
  | "buckets"
  | "coach"
  | "profile"
  | "budgets"
  | "subscriptions"
  | "health"
  | "emergency"
  | "reports"
  | "review"
  | "loans"
  | "categories"
  | "accounts"
  | "documents"
  | "tax"
  | "security"
  | "privacy"
  | "networth"
  | "timeline"
  | "calendar"
  | "notifications"
  | "family"
  | "staff"
  | "society"
  | "reminders"
  | "leakage"
  | "inflation"
  | "fire"
  | "simulator"
  | "import"
  | "feedback"
  | "cash"
  | "sip"
  | "chits"
  | "calens"
  | "ai-settings"
  | "paste"
  | "insurance"
  | "investments"
  | "gold"
  | "property"
  | "creditscore"
  | "cards"
  | "fraud"
  | "pricing"
  | "news"
  | "itr-filing"
  | "privacy-policy"
  | "terms"
  | "contact"
  | "data-safety"
  | "cloud-backup"
  | "spending-patterns"
  | "money-flow"
  | "language-settings"
  | "notes"
  | "figma";


export const inr = (n: number | any) => {
  const num = typeof n === "number" ? n : Number(n);
  if (isNaN(num) || !isFinite(num)) return "₹0";
  const abs = Math.abs(num);
  // Safe compact representation for extreme numbers (> ₹10 Crore) to protect UI layout
  if (abs >= 100_000_000) {
    const cr = abs / 10_000_000;
    if (cr >= 1_000_000) {
      return "₹" + (cr / 1_000_000).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + "M Cr";
    }
    return "₹" + cr.toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " Cr";
  }
  return "₹" + abs.toLocaleString("en-IN", { maximumFractionDigits: 0 });
};
