import { describe, expect, it } from "vitest";
import { parseAuthLink, NATIVE_RESET_REDIRECT } from "../src/app/lib/authLink";

describe("password-reset deep link", () => {
  it("extracts the recovery session from the fragment", () => {
    const url = `${NATIVE_RESET_REDIRECT}#access_token=AAA.BBB.CCC&expires_in=3600&refresh_token=rt123&token_type=bearer&type=recovery`;
    expect(parseAuthLink(url)).toEqual({ kind: "recovery", accessToken: "AAA.BBB.CCC", refreshToken: "rt123" });
  });
  it("reports expired or used links in a friendly way", () => {
    const url = `${NATIVE_RESET_REDIRECT}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`;
    const r = parseAuthLink(url);
    expect(r?.kind).toBe("error");
    expect((r as { message: string }).message).toMatch(/expired or was already used/);
  });
  it("reads errors delivered in the query string", () => {
    expect(parseAuthLink(`${NATIVE_RESET_REDIRECT}?error=access_denied&error_description=nope`)?.kind).toBe("error");
  });
  it("ignores unrelated links and non-recovery sessions", () => {
    expect(parseAuthLink("")).toBeNull();
    expect(parseAuthLink("com.livesync.ai://notes?id=1")).toBeNull();
    expect(parseAuthLink(`${NATIVE_RESET_REDIRECT}#access_token=a&refresh_token=b&type=signup`)).toBeNull();
    expect(parseAuthLink(`${NATIVE_RESET_REDIRECT}#type=recovery`)).toBeNull();
  });
});
