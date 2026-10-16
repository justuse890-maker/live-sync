/**
 * aiClient.ts — storage and network for the user's own AI key, plus the four AI features built on it.
 *
 * Privacy contract:
 *  • The key is stored only on this device (localStorage), never in a backup or export, never sent to LiveSync.
 *  • Calls go from the phone straight to the provider the user chose.
 *  • Nothing is sent until the user has accepted the consent screen (versioned, timestamped).
 *  • What is sent is limited to the anonymous summaries in aiPrivacy.ts.
 */
import { AiConfig, AiError, AiRequest, Provider, PROVIDERS, buildHttp, classifyHttpError, parseResponse, providerInfo, validateConfig } from "./byok";
import { redactText } from "./aiPrivacy";

// ── storage ─────────────────────────────────────────────────────────────────
const CONFIG_KEY = "ls_ai_config_v1";
const CONSENT_KEY = "ls_ai_consent_v3";
const MASTER_KEY = "livesync_ai_opt_in";           // existing "AI data sharing" switch in Security & Privacy
const LEGACY_GROQ_KEY = "livesync-groq-api-key";   // earlier Groq-only build
const LEGACY_GROQ_OPT = "livesync-groq-opted-in";
export const CONSENT_VERSION = 3;

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const del = (k: string) => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } };

export function loadAiConfig(): AiConfig | null {
  const raw = get(CONFIG_KEY);
  if (raw) {
    try {
      const c = JSON.parse(raw);
      if (c && PROVIDERS.some((p) => p.id === c.provider) && typeof c.apiKey === "string") return c as AiConfig;
    } catch { /* fall through */ }
  }
  // Carry a key saved by the earlier Groq-only build across, with the consent they already gave.
  const legacy = get(LEGACY_GROQ_KEY);
  if (legacy) {
    const cfg: AiConfig = { provider: "groq", apiKey: legacy, model: providerInfo("groq").model };
    saveAiConfig(cfg);
    if (get(LEGACY_GROQ_OPT) === "yes" && !consentRecord()) recordConsent();
    del(LEGACY_GROQ_KEY); del(LEGACY_GROQ_OPT);
    return cfg;
  }
  return null;
}
export const saveAiConfig = (c: AiConfig) => set(CONFIG_KEY, JSON.stringify(c));

export function clearAiConfig() {
  del(CONFIG_KEY); del(CONSENT_KEY); del(LEGACY_GROQ_KEY); del(LEGACY_GROQ_OPT);
}

export function consentRecord(): { version: number; at: string } | null {
  try { const c = JSON.parse(get(CONSENT_KEY) || "null"); return c && c.version === CONSENT_VERSION ? c : null; } catch { return null; }
}
export const recordConsent = () => set(CONSENT_KEY, JSON.stringify({ version: CONSENT_VERSION, at: new Date().toISOString() }));

/** The master "AI data sharing" switch in Security & Privacy. On unless the user turned it off. */
export const isAiEnabled = () => get(MASTER_KEY) !== "false";

/** True when a valid key exists, the user consented to this version of the terms, and AI sharing is on. */
export function aiReady(): boolean {
  const c = loadAiConfig();
  return !!c && !validateConfig(c) && !!consentRecord() && isAiEnabled();
}

// ── network ─────────────────────────────────────────────────────────────────
type Opts = { fetchImpl?: typeof fetch; timeoutMs?: number };

async function callOnce(cfg: AiConfig, req: AiRequest, model: string, o: Opts): Promise<string> {
  const f = o.fetchImpl ?? fetch;
  const http = buildHttp(cfg, req, model);
  let res: Response;
  try {
    res = await f(http.url, { ...http.init, signal: AbortSignal.timeout(o.timeoutMs ?? 30_000) });
  } catch (e: any) {
    throw new AiError("network", e?.name === "TimeoutError" ? "The AI provider took too long to answer. Try again." : "Couldn't reach the AI provider. Check your internet connection.");
  }
  if (!res.ok) throw classifyHttpError(res.status, await res.text().catch(() => ""));
  return parseResponse(cfg.provider, await res.json().catch(() => null));
}

/** One AI call. If the model has been retired, the provider's fallback models are tried in turn. */
export async function askAi(cfg: AiConfig, req: AiRequest, o: Opts = {}): Promise<string> {
  const problem = validateConfig(cfg);
  if (problem) throw new AiError("other", problem);
  const models = [cfg.model, ...(cfg.provider === "custom" ? [] : providerInfo(cfg.provider).fallbackModels.filter((m) => m !== cfg.model))];
  let last: AiError | null = null;
  for (const m of models) {
    try { return await callOnce(cfg, req, m, o); }
    catch (e) {
      if (e instanceof AiError && e.kind === "model_unavailable") { last = e; continue; }
      throw e;
    }
  }
  throw last ?? new AiError("model_unavailable", "No available model.");
}

/** Stored key + consent required; throws a friendly error otherwise. */
function ready(): AiConfig {
  const c = loadAiConfig();
  if (!c) throw new AiError("other", "Add your AI key in Profile → AI Assistant to use this.");
  if (!consentRecord()) throw new AiError("other", "Please accept the AI terms in Profile → AI Assistant first.");
  if (!isAiEnabled()) throw new AiError("other", "AI data sharing is switched off in Security & Privacy.");
  return c;
}

// ── features ────────────────────────────────────────────────────────────────
const COACH_SYSTEM = (context: unknown) => `You are LiveSync AI Coach — a personal money coach for Indian users.
Give concise, practical, encouraging coaching based ONLY on the anonymous monthly summary below.
You do not know the user's name, location, accounts or individual transactions, and must not ask for them.
Rules:
- Use ₹ and Indian numbering (₹2,50,000)
- Short, scannable replies (bullets)
- Budgeting, category allocation (50/30/20), savings-rate advice
- You are not a licensed adviser: no product recommendations, no guarantees
- Never ask for passwords, OTPs, PAN, Aadhaar or account numbers

Anonymous monthly summary (amounts rounded to ₹100):
${JSON.stringify(context)}`;

export function coachReply(history: Array<{ role: "user" | "assistant"; text: string }>, context: unknown, o?: Opts) {
  return askAi(ready(), {
    system: COACH_SYSTEM(context),
    // Only the last 8 turns, scrubbed of phone/email/PAN/account numbers.
    messages: history.slice(-8).map((m) => ({ role: m.role, content: redactText(m.text) })),
    maxTokens: 1024,
  }, o);
}

export function weeklyBriefing(snapshot: Record<string, unknown>, o?: Opts) {
  return askAi(ready(), {
    system: "You write a short Monday Money Briefing for an Indian personal finance app. Plain, warm, non-judgmental tone. Use ₹. Reference ONLY the numbers given — never invent a merchant, amount or category. 2-3 sentences, ≤ 60 words, ending with exactly one concrete suggestion tied to the numbers. Never guarantee an outcome.",
    messages: [{ role: "user", content: `Data (anonymous, this user only):\n${JSON.stringify(snapshot)}` }],
    maxTokens: 200,
  }, o);
}

export type NegotiationKind = "credit_card_rate" | "insurance_premium" | "loan_rate" | "subscription_cancel";
const KIND_TEXT: Record<NegotiationKind, string> = {
  credit_card_rate: "Draft a short, polite message to the bank's customer care requesting an interest-rate review, citing tenure and payment history.",
  insurance_premium: "Draft a short message to the insurer or agent requesting a premium review or a comparison quote.",
  loan_rate: "Draft a short message requesting a loan interest-rate reset or balance-transfer discussion, citing tenure and repayment record.",
  subscription_cancel: "Draft a short cancellation request, polite but firm, asking for confirmation of the cancellation date and no further charges.",
};

export async function negotiationScript(
  kind: NegotiationKind,
  context: { name: string; currentAmount: number; currentRatePct?: number; marketBenchmarkPct?: number; tenureMonths?: number; hasGoodPaymentHistory?: boolean },
  o?: Opts,
): Promise<{ text: string; aiUsed: boolean }> {
  const safe = {
    merchantOrProvider: redactText(context.name).slice(0, 40),
    currentAmount: Math.round(context.currentAmount / 100) * 100,
    currentRatePct: context.currentRatePct ?? null,
    marketBenchmarkPct: context.marketBenchmarkPct ?? null,
    tenureMonths: context.tenureMonths ?? null,
    hasGoodPaymentHistory: context.hasGoodPaymentHistory !== false,
  };
  const text = await askAi(ready(), {
    system: `You draft short, ready-to-send messages for an Indian personal finance app. ${KIND_TEXT[kind]} Under 80 words. Do not invent facts. ASK, never demand or threaten; never guarantee an outcome. Start with the line "Copy and send this:" then the message. LiveSync only drafts — the user sends it.`,
    messages: [{ role: "user", content: `Context: ${JSON.stringify(safe)}` }],
    maxTokens: 300,
  }, o);
  return { text, aiUsed: true };
}

export type NormalizedMerchant = { input: string; canonical: string; category: string };

/** Clean messy bank/UPI merchant strings. Only the merchant strings (redacted) are sent — no amounts, dates or accounts. */
export async function normalizeMerchants(merchants: string[], o?: Opts): Promise<NormalizedMerchant[]> {
  const list = merchants.slice(0, 100).map((m) => redactText(String(m)).slice(0, 120));
  const text = await askAi(ready(), {
    system: 'You normalise messy merchant strings from bank/UPI statements into clean brand names and a category. Return ONLY JSON: {"items":[{"input":"...","canonical":"...","category":"..."}]} — one entry per input, same order. Categories: Food, Travel, Shopping, Grocery, Medical, Rent, Entertainment, Bills, Salary, Transfer, Other. Example: "UPI/FLIPKART INDIA PVT LTD/ABC" → {"canonical":"Flipkart","category":"Shopping"}.',
    messages: [{ role: "user", content: JSON.stringify(list) }],
    json: true, maxTokens: 2000, temperature: 0,
  }, o);
  return parseNormalized(text, list);
}

/** Tolerant JSON read: accepts code fences, and falls back to the input if the model misbehaves. */
export function parseNormalized(text: string, list: string[]): NormalizedMerchant[] {
  const fallback = list.map((m) => ({ input: m, canonical: m, category: "Other" }));
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const items = Array.isArray(parsed) ? parsed : parsed?.items;
    if (!Array.isArray(items)) return fallback;
    return list.map((m, i) => {
      const it = items[i];
      return it && typeof it.canonical === "string" && it.canonical.trim()
        ? { input: m, canonical: it.canonical.trim().slice(0, 60), category: typeof it.category === "string" && it.category.trim() ? it.category.trim().slice(0, 30) : "Other" }
        : fallback[i];
    });
  } catch { return fallback; }
}

export type { Provider };
