import { describe, expect, it } from "vitest";
import {
  clampString, createRateLimiter, evaluateSelfServePlanChange, isAcceptablePassword, isAdminEmailListed,
  isOwnedStoragePath, isPlainObject, isValidEmail, isValidFeatureKey, isValidRecordId, matchesMagicBytes,
  withinRecordLimit,
} from "../supabase/functions/make-server-a3fe149f/guards";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

describe("storage path ownership (IDOR on documents)", () => {
  it("accepts a path under the caller's own folder", () => {
    expect(isOwnedStoragePath(USER_A, `${USER_A}/abc.pdf`)).toBe(true);
  });
  it("rejects another user's path", () => {
    expect(isOwnedStoragePath(USER_A, `${USER_B}/abc.pdf`)).toBe(false);
  });
  it("rejects traversal, empty segments and non-strings", () => {
    expect(isOwnedStoragePath(USER_A, `${USER_A}/../${USER_B}/abc.pdf`)).toBe(false);
    expect(isOwnedStoragePath(USER_A, `${USER_A}//abc.pdf`)).toBe(false);
    expect(isOwnedStoragePath(USER_A, `${USER_A}/./abc.pdf`)).toBe(false);
    expect(isOwnedStoragePath(USER_A, undefined)).toBe(false);
    expect(isOwnedStoragePath(USER_A, { path: `${USER_A}/x` })).toBe(false);
  });
  it("does not treat a user id prefix as ownership", () => {
    expect(isOwnedStoragePath(USER_A, `${USER_A}-evil/abc.pdf`)).toBe(false);
  });
});

describe("self-serve plan changes (billing bypass)", () => {
  it("refuses paid plans when unpaid upgrades are not enabled", () => {
    for (const plan of ["pro", "lifetime"]) {
      expect(evaluateSelfServePlanChange(plan, false)).toMatchObject({ ok: false, status: 402 });
    }
  });
  it("always allows moving to free", () => {
    expect(evaluateSelfServePlanChange("free", false)).toEqual({ ok: true, planId: "free" });
  });
  it("allows paid plans only when the sandbox flag is explicitly on", () => {
    expect(evaluateSelfServePlanChange("pro", true)).toEqual({ ok: true, planId: "pro" });
  });
  it("rejects unknown or non-string plans", () => {
    for (const bad of ["admin", "", undefined, null, 5, { toString: () => "pro" }]) {
      expect(evaluateSelfServePlanChange(bad, true)).toMatchObject({ ok: false, status: 400 });
    }
  });
});

describe("admin identity", () => {
  const admins = ["boss@example.com"];
  it("matches case-insensitively and trims", () => {
    expect(isAdminEmailListed(" Boss@Example.com ", admins)).toBe(true);
  });
  it("rejects missing or unlisted emails", () => {
    expect(isAdminEmailListed(null, admins)).toBe(false);
    expect(isAdminEmailListed("boss@example.com.evil.io", admins)).toBe(false);
    expect(isAdminEmailListed("x@example.com", [])).toBe(false);
  });
});

describe("input validation", () => {
  it("validates emails and passwords", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    for (const bad of ["", "a@b", "a b@c.com", 5, null, "x".repeat(400) + "@a.com"]) expect(isValidEmail(bad)).toBe(false);
    expect(isAcceptablePassword("12345678")).toBe(true);
    expect(isAcceptablePassword("short")).toBe(false);
    expect(isAcceptablePassword("x".repeat(129))).toBe(false);
  });
  it("validates record ids, objects, feature keys", () => {
    expect(isValidRecordId("abc-123")).toBe(true);
    expect(isValidRecordId("")).toBe(false);
    expect(isValidRecordId("a".repeat(201))).toBe(false);
    expect(isValidRecordId("a\u0000b")).toBe(false);
    expect(isValidRecordId(12)).toBe(false);
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isValidFeatureKey("coach")).toBe(true);
    expect(isValidFeatureKey("a b")).toBe(false);
    expect(isValidFeatureKey("x".repeat(65))).toBe(false);
  });
  it("enforces size budgets and string clamps", () => {
    expect(withinRecordLimit({ a: "x".repeat(100) }, 1000)).toBe(true);
    expect(withinRecordLimit({ a: "x".repeat(2000) }, 1000)).toBe(false);
    expect(clampString("abcdef", 3)).toBe("abc");
    expect(clampString(42 as unknown, 3, "d")).toBe("d");
  });
});

describe("upload content sniffing", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const html = new TextEncoder().encode("<script>alert(1)</script>");
  it("accepts matching signatures", () => {
    expect(matchesMagicBytes("image/png", png)).toBe(true);
    expect(matchesMagicBytes("application/pdf", new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(matchesMagicBytes("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
    expect(matchesMagicBytes("image/webp", webp)).toBe(true);
  });
  it("rejects HTML masquerading as an image or a mismatched type", () => {
    expect(matchesMagicBytes("image/png", html)).toBe(false);
    expect(matchesMagicBytes("application/pdf", png)).toBe(false);
    expect(matchesMagicBytes("text/html", html)).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows up to max per window and then blocks, per key", () => {
    let t = 0;
    const allow = createRateLimiter(2, 1000, () => t);
    expect(allow("ip1")).toBe(true);
    expect(allow("ip1")).toBe(true);
    expect(allow("ip1")).toBe(false);
    expect(allow("ip2")).toBe(true);
  });
  it("resets after the window", () => {
    let t = 0;
    const allow = createRateLimiter(1, 1000, () => t);
    expect(allow("k")).toBe(true);
    expect(allow("k")).toBe(false);
    t = 1001;
    expect(allow("k")).toBe(true);
  });
});
