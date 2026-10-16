/** Custom-scheme deep link the Android app registers (see AndroidManifest.xml). */
export const NATIVE_RESET_REDIRECT = "com.livesync.ai://reset-password";

export type AuthLink =
  | { kind: "recovery"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string }
  | null;

/**
 * Parse the URL Supabase redirects to after the user taps the e-mail link.
 * Implicit flow puts the session in the fragment (`#access_token=…&type=recovery`);
 * errors (expired/used link) arrive as `error_description` in the fragment or query.
 */
export function parseAuthLink(url: string): AuthLink {
  if (!url) return null;
  const hashIdx = url.indexOf("#");
  const queryIdx = url.indexOf("?");
  const parts: string[] = [];
  if (hashIdx >= 0) parts.push(url.slice(hashIdx + 1));
  if (queryIdx >= 0) parts.push(url.slice(queryIdx + 1, hashIdx >= 0 && hashIdx > queryIdx ? hashIdx : undefined));
  const params = new URLSearchParams(parts.join("&"));

  const err = params.get("error_description") || params.get("error");
  if (err) {
    const code = params.get("error_code") || "";
    const expired = code === "otp_expired" || /expired|invalid/i.test(err);
    return { kind: "error", message: expired ? "This reset link has expired or was already used. Please request a new one." : err.replace(/\+/g, " ") };
  }
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (params.get("type") === "recovery" && accessToken && refreshToken) {
    return { kind: "recovery", accessToken, refreshToken };
  }
  return null;
}
