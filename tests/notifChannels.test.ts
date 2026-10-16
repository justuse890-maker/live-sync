import { describe, expect, it } from "vitest";
import { CHANNELS, LEGACY_CHANNEL_IDS, channelIdFor, tierForAlert } from "../src/app/lib/notifChannels";

describe("notification channels", () => {
  it("has five tiers with unique, versioned ids and descending importance", () => {
    const ids = CHANNELS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHANNELS) expect(c.id).toMatch(/_v2$/);
    const imp = CHANNELS.map((c) => c.importance);
    expect([...imp].sort((a, b) => b - a)).toEqual(imp);
    expect(CHANNELS.map((c) => c.tier)).toEqual(["urgent", "bills", "money", "digest", "tips"]);
  });

  it("never reuses a legacy id (importance cannot be changed after a channel exists)", () => {
    for (const c of CHANNELS) expect(LEGACY_CHANNEL_IDS).not.toContain(c.id);
  });

  it("routes a due-today payment to urgent and a heads-up to bills", () => {
    expect(tierForAlert({ kind: "due-today", source: "emi" })).toBe("urgent");
    expect(tierForAlert({ kind: "due-today", source: "card" })).toBe("urgent");
    expect(tierForAlert({ kind: "overdue", source: "bill" })).toBe("urgent");
    expect(tierForAlert({ kind: "heads-up", source: "card" })).toBe("bills");
    expect(tierForAlert({ kind: "due-today", source: "note" })).toBe("bills");
    expect(tierForAlert({ kind: "budget", source: "budget" })).toBe("money");
    expect(tierForAlert({ kind: "weekly", source: "digest" })).toBe("digest");
  });

  it("only urgent and bills carry the user's chosen sound, in a per-sound channel id", () => {
    expect(channelIdFor("urgent", "chime")).toBe("ls_urgent_v2_chime");
    expect(channelIdFor("bills", "default")).toBe("ls_bills_v2");
    expect(channelIdFor("digest", "chime")).toBe("ls_digest_v2");
    expect(channelIdFor("money", undefined)).toBe("ls_money_v2");
  });
});
