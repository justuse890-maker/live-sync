// ════════════════════════════════════════════════════════════════════════
// AI Prompt Library — one place that defines what each AI-era feature is
// FOR, what data it may see, and what shape it must reply in. The backend
// (supabase/functions/make-server-a3fe149f/index.ts) builds its actual
// Gemini prompts from these definitions so the intent stays in sync
// between frontend, backend, and whoever edits either one later.
//
// Priority tags match the roadmap:
//   P0 = ship first, no new integrations needed
//   P1 = ship next, the real AI-era differentiator
// ════════════════════════════════════════════════════════════════════════

export type AiPriority = "P0" | "P1" | "P2";

export type AiFeatureSpec = {
  id: string;
  priority: AiPriority;
  name: string;
  /** One sentence a non-technical reviewer can use to check the AI is doing the right job. */
  purpose: string;
  /** What the model is allowed to see — keep this narrow and anonymized. */
  dataScope: string[];
  /** The exact system framing sent to Gemini. Edit here, not inline in the server file. */
  systemPrompt: string;
  /** Shape of the expected reply — used for both prompting and for validating the response. */
  outputSchema: string;
  /** Hard constraints the model must never violate for this feature. */
  guardrails: string[];
};

export const AI_FEATURES: Record<string, AiFeatureSpec> = {
  weeklyBriefing: {
    id: "weeklyBriefing",
    priority: "P0",
    name: "Monday Money Briefing",
    purpose: "Give the user one thing worth knowing about their money this week, without them opening the app.",
    dataScope: [
      "healthScore (0-100)",
      "healthScoreDelta (vs last week)",
      "weeklySpend vs avgWeeklySpend",
      "savingsRatePct",
      "topCategory + topCategoryChangePct",
      "annualLeakage estimate",
      "forecastEndOfMonthBalance",
    ],
    systemPrompt:
      "You write a short Monday Money Briefing push notification for an Indian personal finance app called LiveSync AI. " +
      "Plain, warm, non-judgmental tone. Use ₹ for amounts. Reference ONLY the numbers you're given — never invent a merchant, " +
      "amount, or category not present in the data. 2-3 sentences max, ending with exactly one concrete suggestion tied to the numbers.",
    outputSchema: "Plain text, 2-3 sentences, ≤ 60 words.",
    guardrails: [
      "Never mention a specific merchant/transaction not present in the given snapshot",
      "Never claim a guaranteed financial outcome",
      "Never use shaming language (\"you wasted\", \"you failed\") — frame as observation + option",
    ],
  },

  negotiationScript: {
    id: "negotiationScript",
    priority: "P1",
    name: "AI-Drafted Negotiation / Cancellation Script",
    purpose: "Turn a detected overpay into a message the user can copy-paste today, instead of advice they'd have to act on themselves later.",
    dataScope: [
      "merchantOrProvider (name only)",
      "currentAmount",
      "currentRatePct / marketBenchmarkPct (if applicable)",
      "tenureMonths",
      "hasGoodPaymentHistory (boolean)",
    ],
    systemPrompt:
      "You draft short, ready-to-send negotiation or cancellation messages for an Indian personal finance app. " +
      "Keep it under 80 words. Do not invent facts not given. The message should ASK, never demand or threaten. " +
      "Never guarantee an outcome (no \"you will get\", use \"you may be able to request\").",
    outputSchema: "Plain text starting with 'Copy and send this:' followed by the drafted message.",
    guardrails: [
      "No fabricated account numbers, dates, or reference IDs",
      "No legal threats or aggressive language",
      "No claim that LiveSync AI is acting on the user's behalf — it only drafts, the user sends",
    ],
  },

  cashFlowForecast: {
    id: "cashFlowForecast",
    priority: "P0",
    name: "Cash Flow Forecast Narration",
    purpose: "Turn a computed 30-day balance projection into one sentence a user reads in under 3 seconds.",
    dataScope: ["endOfMonthBalance", "lowestPoint", "daysUntilRisk", "safetyLine"],
    systemPrompt:
      "The math is already done client-side (deterministic, not AI-generated) — you only narrate it. " +
      "One sentence. State the projected balance and the date, and whether it crosses the safety line. " +
      "Never re-derive or second-guess the numbers given.",
    outputSchema: "Plain text, 1 sentence, ≤ 30 words.",
    guardrails: [
      "Never present the forecast as a guarantee — it's a projection from recent patterns",
      "Always use the exact numbers passed in, never round dramatically or invent alternatives",
    ],
  },

  anomalyDetection: {
    id: "anomalyDetection",
    priority: "P0",
    name: "Behavioral Anomaly Alert",
    purpose: "Flag when a category's spend has drifted from the user's OWN baseline — not a generic benchmark.",
    dataScope: ["category", "currentAmount", "averageAmount", "deviationPct"],
    systemPrompt:
      "Pure arithmetic (z-score / % deviation vs the user's own trailing average) — no LLM call needed for detection. " +
      "If narration is requested, state the category, the % change, and stop — no lifestyle judgment.",
    outputSchema: "Plain text, 1 sentence.",
    guardrails: ["Never compare the user to other people — only to their own history"],
  },

  agenticAction: {
    id: "agenticAction",
    priority: "P1",
    name: "One-Tap Agentic Action",
    purpose: "Convert an insight into a button that actually does something — move money between the user's own tracked buckets, or draft a message — never a real bank transfer.",
    dataScope: ["insightId", "suggestedAction (move_to_bucket | draft_cancellation | draft_negotiation)", "amount", "targetBucketId"],
    systemPrompt: "n/a — this is a UI/backend action, not a generative prompt. See ActionCard.tsx + addBucketContribution().",
    outputSchema: "n/a",
    guardrails: [
      "MUST NOT initiate any real bank-to-bank money movement (keeps the product outside payment-aggregator licensing scope)",
      "All 'moves' are between the user's own in-app tracked buckets/categories",
      "Every action requires explicit user tap-to-confirm — never auto-executes silently",
    ],
  },
};

/** Builds the final prompt string for a feature, given the runtime data. Mirrors the server-side prompt construction 1:1 — keep both in sync when editing. */
export function buildPrompt(featureId: keyof typeof AI_FEATURES, data: Record<string, unknown>): string {
  const spec = AI_FEATURES[featureId];
  if (!spec) throw new Error(`Unknown AI feature: ${featureId}`);
  return `${spec.systemPrompt}\n\nExpected output: ${spec.outputSchema}\n\nData:\n${JSON.stringify(data, null, 2)}`;
}
