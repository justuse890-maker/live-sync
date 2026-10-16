import { describe, expect, it } from "vitest";
import { defaultMode, filterScope, personaFromOccupation, resolveMode } from "../src/app/lib/persona";

describe("persona", () => {
  it("maps every onboarding occupation", () => {
    expect(personaFromOccupation("Salaried")).toBe("salaried");
    expect(personaFromOccupation("Freelancer")).toBe("business");
    expect(personaFromOccupation("Business owner")).toBe("business");
    expect(personaFromOccupation("Student")).toBe("student");
    expect(personaFromOccupation("Homemaker")).toBe("homemaker");
    expect(personaFromOccupation("Retired")).toBe("retired");
    expect(personaFromOccupation("Other")).toBe("other");
    expect(personaFromOccupation(undefined)).toBe("other");
  });

  it("defaults to Simple for homemakers, students and retired; Books for the rest", () => {
    expect(defaultMode("homemaker")).toBe("simple");
    expect(defaultMode("student")).toBe("simple");
    expect(defaultMode("retired")).toBe("simple");
    expect(defaultMode("salaried")).toBe("books");
    expect(defaultMode("business")).toBe("books");
    expect(defaultMode("other")).toBe("books");
  });

  it("an explicit choice beats the default; junk is ignored", () => {
    expect(resolveMode("books", "homemaker")).toBe("books");
    expect(resolveMode("simple", "salaried")).toBe("simple");
    expect(resolveMode("weird", "homemaker")).toBe("simple");
    expect(resolveMode(undefined, "business")).toBe("books");
  });
});

describe("filterScope", () => {
  const rows = [{ id: 1, scope: "business" as const }, { id: 2, scope: "personal" as const }, { id: 3 }];
  it("treats untagged entries as personal", () => {
    expect(filterScope(rows, "personal").map((r) => r.id)).toEqual([2, 3]);
    expect(filterScope(rows, "business").map((r) => r.id)).toEqual([1]);
  });
  it("'all' returns everything", () => {
    expect(filterScope(rows, "all")).toHaveLength(3);
  });
});
