import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiError } from "../src/app/lib/byok";
import { askAi, parseNormalized } from "../src/app/lib/aiClient";

const cfg = { provider: "groq" as const, apiKey: "gsk_x", model: "retired-model" };
const ok = (content: string) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }), text: async () => "" }) as any;
const bad = (status: number, body = "") => ({ ok: false, status, json: async () => ({}), text: async () => body }) as any;

describe("askAi", () => {
  it("returns the provider's text", async () => {
    const f = vi.fn().mockResolvedValue(ok("hello"));
    expect(await askAi(cfg, { messages: [{ role: "user", content: "hi" }] }, { fetchImpl: f })).toBe("hello");
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe("https://api.groq.com/openai/v1/chat/completions");
  });

  it("falls back to the next model when the chosen one is retired", async () => {
    const f = vi.fn().mockResolvedValueOnce(bad(404, "model_not_found")).mockResolvedValueOnce(ok("fine"));
    expect(await askAi(cfg, { messages: [{ role: "user", content: "hi" }] }, { fetchImpl: f })).toBe("fine");
    expect(JSON.parse(f.mock.calls[1][1].body).model).toBe("llama3-70b-8192");
  });

  it("does not hide a bad key behind fallbacks", async () => {
    const f = vi.fn().mockResolvedValue(bad(401));
    await expect(askAi(cfg, { messages: [] }, { fetchImpl: f })).rejects.toMatchObject({ kind: "invalid_key" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("custom endpoints get no fallback models", async () => {
    const f = vi.fn().mockResolvedValue(bad(404, "not found"));
    await expect(askAi({ provider: "custom", apiKey: "k", model: "m", baseUrl: "https://x.com/v1" }, { messages: [] }, { fetchImpl: f })).rejects.toMatchObject({ kind: "model_unavailable" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("reports network failures plainly", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(askAi(cfg, { messages: [] }, { fetchImpl: f })).rejects.toMatchObject({ kind: "network" });
  });

  it("refuses to call with an incomplete config", async () => {
    const f = vi.fn();
    await expect(askAi({ ...cfg, apiKey: "" }, { messages: [] }, { fetchImpl: f })).rejects.toBeInstanceOf(AiError);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("parseNormalized", () => {
  const list = ["UPI/FLIPKART/ABC", "ZOMATO BLR"];
  it("reads clean JSON, fenced JSON and bare arrays", () => {
    const body = '{"items":[{"input":"a","canonical":"Flipkart","category":"Shopping"},{"input":"b","canonical":"Zomato","category":"Food"}]}';
    expect(parseNormalized(body, list)).toEqual([{ input: list[0], canonical: "Flipkart", category: "Shopping" }, { input: list[1], canonical: "Zomato", category: "Food" }]);
    expect(parseNormalized("```json\n" + body + "\n```", list)[1].canonical).toBe("Zomato");
    expect(parseNormalized('[{"canonical":"X"},{"canonical":"Y","category":"Bills"}]', list).map((x) => x.category)).toEqual(["Other", "Bills"]);
  });
  it("falls back to the input on garbage or short answers", () => {
    expect(parseNormalized("not json", list)).toEqual(list.map((m) => ({ input: m, canonical: m, category: "Other" })));
    expect(parseNormalized('{"items":[{"canonical":"Only one"}]}', list)[1]).toEqual({ input: list[1], canonical: list[1], category: "Other" });
  });
});
