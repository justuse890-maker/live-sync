import { describe, expect, it } from "vitest";
import { formatInr, formatSignedInr, formatCompactInr } from "../src/app/lib/money";

describe("money formatting (Indian grouping)", () => {
  it("groups in lakhs and crores and uses a real minus sign", () => {
    expect(formatInr(1234567)).toBe("₹12,34,567");
    expect(formatInr(-1234567)).toBe("−₹12,34,567");
    expect(formatInr(0)).toBe("₹0");
    expect(formatInr(1999.6)).toBe("₹2,000");
  });
  it("signed variant always shows + or − so colour is never the only cue", () => {
    expect(formatSignedInr(500)).toBe("+₹500");
    expect(formatSignedInr(-500)).toBe("−₹500");
    expect(formatSignedInr(0)).toBe("₹0");
  });
  it("compact: full figure below a lakh, L from a lakh, Cr from a crore", () => {
    expect(formatCompactInr(950)).toBe("₹950");
    expect(formatCompactInr(99_999)).toBe("₹99,999");
    expect(formatCompactInr(125_000)).toBe("₹1.25 L");
    expect(formatCompactInr(100_000)).toBe("₹1 L");
    expect(formatCompactInr(3_450_000)).toBe("₹34.5 L");
    expect(formatCompactInr(10_000_000)).toBe("₹1 Cr");
    expect(formatCompactInr(34_000_000)).toBe("₹3.4 Cr");
    expect(formatCompactInr(-250_000)).toBe("−₹2.5 L");
  });
  it("compact rolls over at the boundary instead of printing 100 L", () => {
    expect(formatCompactInr(9_999_999)).toBe("₹1 Cr");
    expect(formatCompactInr(99_999_999)).toBe("₹10 Cr");
  });
  it("very large crore values keep Indian grouping", () => {
    expect(formatCompactInr(1_000_000_000_000)).toBe("₹1,00,000 Cr");
  });
  it("bad input never throws or prints NaN", () => {
    for (const v of [NaN, Infinity, undefined, null, "abc"]) {
      expect(formatInr(v as any)).toBe("₹0");
      expect(formatCompactInr(v as any)).toBe("₹0");
    }
  });
});
