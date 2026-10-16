import { describe, expect, it } from "vitest";
import { sourceBadge } from "../src/app/lib/txSource";

describe("sourceBadge", () => {
  it("says how a row got here, in words", () => {
    expect(sourceBadge({ source: "voice" })?.label).toBe("Voice");
    expect(sourceBadge({ source: "scan" })?.label).toBe("Scanned");
    expect(sourceBadge({ source: "import" })?.label).toBe("Imported");
    expect(sourceBadge({ source: "paste" })?.label).toBe("From bank message");
  });
  it("auto-recorded rows are labelled as such, even without a source", () => {
    expect(sourceBadge({ autoDebited: true })?.label).toBe("Auto-recorded");
  });
  it("typed-in rows and old rows with no source show no badge, so nothing is claimed that we don't know", () => {
    expect(sourceBadge({ source: "manual" })).toBeNull();
    expect(sourceBadge({})).toBeNull();
    expect(sourceBadge({ source: "something-new" as any })).toBeNull();
  });
  it("every badge explains itself and mentions where the data is kept only when that is true", () => {
    for (const s of ["voice", "scan", "import", "paste"] as const) {
      const b = sourceBadge({ source: s })!;
      expect(b.hint.length).toBeGreaterThan(10);
      expect(b.hint).not.toMatch(/cloud|server|uploaded/i);
    }
  });
});
