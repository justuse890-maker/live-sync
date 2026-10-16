import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without type declarations
import { scanText } from "../scripts/check-secrets.mjs";

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (role: string) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ iss: "supabase", role })}.${"s".repeat(20)}`;

describe("secret scanner", () => {
  it("flags a service_role JWT", () => {
    expect(scanText(`const k = "${jwt("service_role")}"`)).toContain("jwt-role-service_role");
  });
  it("allows the public anon JWT", () => {
    expect(scanText(`const k = "${jwt("anon")}"`)).toEqual([]);
  });
  it("flags private keys and common provider keys", () => {
    expect(scanText("-----BEGIN " + "PRIVATE KEY-----")).toContain("private-key-block");
    expect(scanText("AKIA" + "ABCDEFGHIJKLMNOP")).toContain("aws-access-key");
    expect(scanText("gsk_" + "a1B2".repeat(11))).toContain("groq-key");
  });
  it("ignores placeholders and ordinary text", () => {
    expect(scanText('placeholder="gsk_' + "x".repeat(40) + '"')).toEqual([]);
    expect(scanText("nothing to see here")).toEqual([]);
  });
});
