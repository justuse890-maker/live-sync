import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, normalizePrefs, snoozeKind, applyAlertPrefs, type AlertLike } from "../src/app/lib/alertPrefs";

const now = new Date(2026, 9, 16, 10, 0, 0);
const a = (id: string, kind: string, severity: AlertLike["severity"] = "info"): AlertLike => ({ id, title: `T ${id}`, body: `B ${id}`, kind, severity, at: "2026-10-16", read: false });

describe("normalizePrefs", () => {
  it("falls back to defaults on junk and clamps the budget level", () => {
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs({ budgetWarnPct: 10 }).budgetWarnPct).toBe(50);
    expect(normalizePrefs({ budgetWarnPct: 500 }).budgetWarnPct).toBe(95);
    expect(normalizePrefs({ budgetWarnPct: "80" as any }).budgetWarnPct).toBe(80);
    expect(normalizePrefs({ muted: "x" as any }).muted).toEqual([]);
  });
});

describe("applyAlertPrefs", () => {
  it("hides a muted kind", () => {
    const out = applyAlertPrefs([a("1", "subscription_due"), a("2", "budget_alert")], { ...DEFAULT_PREFS, muted: ["subscription_due"] }, now);
    expect(out.map((x) => x.id)).toEqual(["2"]);
  });
  it("never hides an urgent payment alert, even when its kind is muted", () => {
    const out = applyAlertPrefs([a("1", "emi_due", "urgent"), a("2", "credit_due", "urgent")], { ...DEFAULT_PREFS, muted: ["emi_due", "credit_due"] }, now);
    expect(out).toHaveLength(2);
  });
  it("hides a snoozed kind until the snooze ends", () => {
    const p = snoozeKind(DEFAULT_PREFS, "budget_alert", 7, now);
    expect(applyAlertPrefs([a("1", "budget_alert")], p, now)).toHaveLength(0);
    expect(applyAlertPrefs([a("1", "budget_alert")], p, new Date(2026, 9, 24))).toHaveLength(1);
  });
  it("batches a burst: more than five non-urgent alerts collapse into one digest line", () => {
    const many = Array.from({ length: 8 }, (_, i) => a(String(i), "subscription_due", "info"));
    const out = applyAlertPrefs([...many, a("u", "emi_due", "urgent")], DEFAULT_PREFS, now);
    expect(out.filter((x) => x.kind === "digest")).toHaveLength(1);
    expect(out.find((x) => x.id === "u")).toBeTruthy();                // urgent stays on its own
    expect(out.filter((x) => x.kind === "subscription_due")).toHaveLength(4); // 5 individual slots − 1 for the digest line
    const digest = out.find((x) => x.kind === "digest")!;
    expect(digest.body).toMatch(/4 more/);
  });
  it("leaves a short list untouched and keeps order", () => {
    const list = [a("1", "budget_alert", "warning"), a("2", "goal_update")];
    expect(applyAlertPrefs(list, DEFAULT_PREFS, now).map((x) => x.id)).toEqual(["1", "2"]);
  });
});
