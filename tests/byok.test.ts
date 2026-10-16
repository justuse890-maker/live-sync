import { describe, expect, it } from "vitest";
import { AiError, buildHttp, classifyHttpError, keyWarning, parseResponse, validateConfig, type AiConfig } from "../src/app/lib/byok";

const cfg = (o: Partial<AiConfig> = {}): AiConfig => ({ provider: "openai", apiKey: " sk-test ", model: "m1", ...o });
const req = { system: "SYS", messages: [{ role: "user" as const, content: "hi" }, { role: "assistant" as const, content: "yo" }, { role: "user" as const, content: "again" }] };

describe("buildHttp", () => {
  it("OpenAI: bearer key, system first, JSON mode when asked", () => {
    const h = buildHttp(cfg(), { ...req, json: true });
    expect(h.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(h.init.headers.Authorization).toBe("Bearer sk-test");
    const b = JSON.parse(h.init.body);
    expect(b.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(b.messages).toHaveLength(4);
    expect(b.response_format).toEqual({ type: "json_object" });
  });

  it("Groq uses its own host with the same format", () => {
    expect(buildHttp(cfg({ provider: "groq" }), req).url).toBe("https://api.groq.com/openai/v1/chat/completions");
  });

  it("Gemini: key in a header (never the URL), system instruction, assistant→model", () => {
    const h = buildHttp(cfg({ provider: "gemini", model: "gemini-x" }), { ...req, json: true });
    expect(h.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent");
    expect(h.url).not.toContain("sk-test");
    expect(h.init.headers["x-goog-api-key"]).toBe("sk-test");
    const b = JSON.parse(h.init.body);
    expect(b.systemInstruction.parts[0].text).toBe("SYS");
    expect(b.contents.map((c: any) => c.role)).toEqual(["user", "model", "user"]);
    expect(b.generationConfig.responseMimeType).toBe("application/json");
  });

  it("Anthropic: x-api-key, version header, top-level system, direct-access header", () => {
    const h = buildHttp(cfg({ provider: "anthropic" }), req);
    expect(h.url).toBe("https://api.anthropic.com/v1/messages");
    expect(h.init.headers["x-api-key"]).toBe("sk-test");
    expect(h.init.headers["anthropic-version"]).toBe("2023-06-01");
    expect(h.init.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    const b = JSON.parse(h.init.body);
    expect(b.system).toBe("SYS");
    expect(b.messages.every((m: any) => m.role !== "system")).toBe(true);
  });

  it("custom endpoint: trims trailing slashes, uses the user's base URL", () => {
    expect(buildHttp(cfg({ provider: "custom", baseUrl: "https://openrouter.ai/api/v1//" }), req).url).toBe("https://openrouter.ai/api/v1/chat/completions");
  });

  it("a model override (fallback) replaces the configured model", () => {
    expect(JSON.parse(buildHttp(cfg(), req, "fallback-model").init.body).model).toBe("fallback-model");
  });
});

describe("parseResponse", () => {
  it("reads each provider's shape", () => {
    expect(parseResponse("openai", { choices: [{ message: { content: " hello " } }] })).toBe("hello");
    expect(parseResponse("gemini", { candidates: [{ content: { parts: [{ text: "a" }, { text: "b" }] } }] })).toBe("ab");
    expect(parseResponse("anthropic", { content: [{ type: "text", text: "hey" }] })).toBe("hey");
  });
  it("throws a typed error on empty replies", () => {
    expect(() => parseResponse("openai", { choices: [] })).toThrow(AiError);
    expect(() => parseResponse("anthropic", { content: [] })).toThrow(/empty/i);
  });
});

describe("classifyHttpError", () => {
  it("maps statuses to actionable kinds", () => {
    expect(classifyHttpError(401, "").kind).toBe("invalid_key");
    expect(classifyHttpError(400, '{"error":{"message":"API key not valid"}}').kind).toBe("invalid_key");
    expect(classifyHttpError(404, "model_not_found").kind).toBe("model_unavailable");
    expect(classifyHttpError(429, "You exceeded your current quota").kind).toBe("quota");
    expect(classifyHttpError(429, "slow down").kind).toBe("rate_limit");
    expect(classifyHttpError(500, '{"error":{"message":"boom"}}')).toMatchObject({ kind: "other" });
    expect(classifyHttpError(500, '{"error":{"message":"boom"}}').message).toContain("boom");
  });
});

describe("validation", () => {
  it("requires key, model, and an https endpoint for custom", () => {
    expect(validateConfig(cfg({ apiKey: " " }))).toMatch(/key/i);
    expect(validateConfig(cfg({ model: "" }))).toMatch(/model/i);
    expect(validateConfig(cfg({ provider: "custom", baseUrl: "http://x.com" }))).toMatch(/https/);
    expect(validateConfig(cfg({ provider: "custom", baseUrl: "https://x.com/v1" }))).toBeNull();
    expect(validateConfig(cfg())).toBeNull();
  });
  it("only hints on a wrong key prefix", () => {
    expect(keyWarning({ provider: "groq", apiKey: "sk-abc" })).toMatch(/Groq/);
    expect(keyWarning({ provider: "groq", apiKey: "gsk_abc" })).toBeNull();
    expect(keyWarning({ provider: "custom", apiKey: "anything" })).toBeNull();
  });
});
