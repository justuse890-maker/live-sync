/**
 * safeUUID.ts — Universal, crash-proof UUID generator
 * Works in all environments: Android WebView, iOS WKWebView, modern browsers,
 * legacy browsers, and non-secure (http://) contexts where crypto.randomUUID is undefined.
 */

export function safeUUID(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Fallback if crypto.randomUUID throws (e.g. non-secure context)
  }

  // Robust RFC4122 v4 compliant fallback
  try {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    // Fall through to timestamp random
  }

  const d = Date.now().toString(36);
  const r = Math.random().toString(36).substring(2, 10);
  const r2 = Math.random().toString(36).substring(2, 10);
  return `ls_${d}_${r}_${r2}`;
}
