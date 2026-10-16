/**
 * persona.ts — who the user is decides HOW MUCH we show, never WHAT they can reach.
 *
 *   Simple  plain words, big numbers, three things to look at
 *   Books   financial-year view, statements, ratios, tax tags, month-close
 *
 * The persona comes from the occupation picked at onboarding; the user can flip the mode any time.
 */
import type { Persona } from "./ratios";

export type ViewMode = "simple" | "books";

export function personaFromOccupation(occupation?: string): Persona {
  switch ((occupation || "").trim().toLowerCase()) {
    case "salaried": return "salaried";
    case "freelancer":
    case "business owner": return "business";
    case "student": return "student";
    case "homemaker": return "homemaker";
    case "retired": return "retired";
    default: return "other";
  }
}

export function defaultMode(persona: Persona): ViewMode {
  return persona === "homemaker" || persona === "student" || persona === "retired" ? "simple" : "books";
}

/** An explicit choice always wins over the persona default. */
export function resolveMode(override: string | undefined | null, persona: Persona): ViewMode {
  return override === "simple" || override === "books" ? override : defaultMode(persona);
}

// ── Business / Personal ─────────────────────────────────────────────────────
export type Scope = "personal" | "business";
export type ScopeFilter = "all" | Scope;

/** Entries with no scope are personal. `all` returns the list untouched. */
export function filterScope<T extends { scope?: Scope }>(txs: T[], filter: ScopeFilter): T[] {
  if (filter === "all") return txs;
  return txs.filter((t) => (t.scope ?? "personal") === filter);
}
