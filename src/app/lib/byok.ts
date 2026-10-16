/**
 * byok.ts — "bring your own key": talk to the AI provider the USER chose, with the USER's key,
 * straight from their phone. LiveSync runs no AI service, sees no key and no prompt.
 *
 * This file is pure (no network, no storage): it builds provider requests and reads provider replies, so it
 * can be unit-tested. The network call and key storage live in aiClient.ts.
 */
export type Provider = "gemini" | "openai" | "anthropic" | "groq" | "custom";

export type AiConfig = {
  provider: Provider;
  apiKey: string;
  model: string;
  /** Required for "custom": any OpenAI-compatible endpoint, e.g. https://openrouter.ai/api/v1 */
  baseUrl?: string;
};

export type ChatMsg = { role: "user" | "assistant"; content: string };
export type AiRequest = { system?: string; messages: ChatMsg[]; json?: boolean; maxTokens?: number; temperature?: number };

export type ProviderInfo = {
  id: Provider;
  label: string;
  /** Default model — editable by the user, because providers retire models. */
  model: string;
  /** Tried in order when the chosen model is retired or unknown. */
  fallbackModels: string[];
  keyHint: string;
  keyPrefix?: string;
  getKeyUrl?: string;
};

export const PROVIDERS: ProviderInfo[] = [
  { id: "gemini", label: "Google Gemini", model: "gemini-2.5-flash", fallbackModels: ["gemini-2.0-flash", "gemini-1.5-flash"], keyHint: "Starts with AIza", keyPrefix: "AIza", getKeyUrl: "https://aistudio.google.com/apikey" },
  { id: "openai", label: "OpenAI", model: "gpt-4o-mini", fallbackModels: ["gpt-4.1-mini", "gpt-4o"], keyHint: "Starts with sk-", keyPrefix: "sk-", getKeyUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", label: "Anthropic Claude", model: "claude-haiku-5-5", fallbackModels: ["claude-sonnet-5-5"], keyHint: "Starts with sk-ant-", keyPrefix: "sk-ant-", getKeyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "groq", label: "Groq", model: "llama-3.3-70b-versatile", fallbackModels: ["llama3-70b-8192", "gemma2-9b-it", "llama3-8b-8192"], keyHint: "Starts with gsk_", keyPrefix: "gsk_", getKeyUrl: "https://console.groq.com/keys" },
  { id: "custom", label: "Other (OpenAI-compatible)", model: "", fallbackModels: [], keyHint: "Your provider's key" },
];

export const providerInfo = (p: Provider): ProviderInfo => PROVIDERS.find((x) => x.id === p)!;

/** Soft check: wrong prefix is a hint, not a block — providers change key formats. */
export function keyWarning(cfg: Pick<AiConfig, "provider" | "apiKey">): string | null {
  const info = providerInfo(cfg.provider);
  const key = cfg.apiKey.trim();
  if (!key) return null;
  if (info.keyPrefix && !key.startsWith(info.keyPrefix)) return `That doesn't look like a ${info.label} key (${info.keyHint.toLowerCase()}). Double-check you copied the right one.`;
  return null;
}

/** Hard problems that make a call impossible. Returns a message or null. */
export function validateConfig(cfg: AiConfig): string | null {
  if (!cfg.apiKey.trim()) return "Paste your API key.";
  if (!cfg.model.trim()) return "Enter a model name.";
  if (cfg.provider === "custom") {
    const url = (cfg.baseUrl || "").trim();
    if (!/^https:\/\/[^\s/]+/i.test(url)) return "The endpoint must start with https://";
  }
  return null;
}

const trimSlash = (s: string) => s.replace(/\/+$/, "");

export type HttpRequest = { url: string; init: { method: "POST"; headers: Record<string, string>; body: string } };

export function buildHttp(cfg: AiConfig, req: AiRequest, modelOverride?: string): HttpRequest {
  const model = modelOverride || cfg.model;
  const maxTokens = req.maxTokens ?? 1024;
  const temperature = req.temperature ?? 0.6;

  if (cfg.provider === "gemini") {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey.trim() },
        body: JSON.stringify({
          ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
          contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: maxTokens, temperature, ...(req.json ? { responseMimeType: "application/json" } : {}) },
        }),
      },
    };
  }

  if (cfg.provider === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cfg.apiKey.trim(),
          "anthropic-version": "2023-06-01",
          // Required by Anthropic for calls made directly from an app rather than a server.
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model, max_tokens: maxTokens, temperature, ...(req.system ? { system: req.system } : {}), messages: req.messages.map((m) => ({ role: m.role, content: m.content })) }),
      },
    };
  }

  // OpenAI, Groq and any OpenAI-compatible endpoint share one wire format.
  const base = cfg.provider === "openai" ? "https://api.openai.com/v1" : cfg.provider === "groq" ? "https://api.groq.com/openai/v1" : trimSlash(cfg.baseUrl || "");
  return {
    url: `${base}/chat/completions`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey.trim()}` },
      body: JSON.stringify({
        model, temperature, max_tokens: maxTokens,
        ...(req.json ? { response_format: { type: "json_object" } } : {}),
        messages: [...(req.system ? [{ role: "system", content: req.system }] : []), ...req.messages.map((m) => ({ role: m.role, content: m.content }))],
      }),
    },
  };
}

/** Pull the reply text out of a provider's JSON. Throws when there is none. */
export function parseResponse(provider: Provider, data: any): string {
  let text: unknown;
  if (provider === "gemini") text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("");
  else if (provider === "anthropic") text = Array.isArray(data?.content) ? data.content.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("") : undefined;
  else text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new AiError("empty", "The AI returned an empty reply. Try again or pick another model.");
  return text.trim();
}

export type AiErrorKind = "invalid_key" | "rate_limit" | "model_unavailable" | "quota" | "network" | "empty" | "other";
export class AiError extends Error {
  constructor(public kind: AiErrorKind, message: string) { super(message); this.name = "AiError"; }
}

/** Turn an HTTP failure into something a person can act on. */
export function classifyHttpError(status: number, bodyText: string): AiError {
  const lower = (bodyText || "").toLowerCase();
  if (status === 401 || status === 403 || lower.includes("api key not valid") || lower.includes("invalid api key") || lower.includes("incorrect api key"))
    return new AiError("invalid_key", "Your API key was rejected. Check it, or create a new one with your provider.");
  if (status === 404 || lower.includes("decommissioned") || lower.includes("not found") || lower.includes("model_not_found") || lower.includes("is not supported"))
    return new AiError("model_unavailable", "That model isn't available any more. Choose another model name.");
  if (status === 429) {
    return lower.includes("quota") || lower.includes("billing") || lower.includes("insufficient")
      ? new AiError("quota", "Your provider says the quota or billing limit is reached. Check your plan with them.")
      : new AiError("rate_limit", "Too many requests right now. Wait a minute and try again.");
  }
  return new AiError("other", `The AI provider returned an error (${status}). ${extractMessage(bodyText)}`.trim());
}

function extractMessage(bodyText: string): string {
  try { const j = JSON.parse(bodyText); const m = j?.error?.message || j?.message; return typeof m === "string" ? m.slice(0, 160) : ""; } catch { return ""; }
}
