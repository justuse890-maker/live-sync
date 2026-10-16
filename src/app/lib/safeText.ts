/**
 * safeText.ts — read a text field that might not be text.
 *
 * Saved records are user data and can hold anything (a transaction once had the NUMBER 453453 as its title). Calling
 * .trim() on such a value throws, and because the same key-building code runs while the app loads, one odd record made
 * the whole app look empty. Use these wherever a title / merchant / name is turned into a key or label.
 */
export const safeText = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "");

/** Trimmed, lower-cased comparison key for any value. */
export const normKey = (v: unknown): string => safeText(v).trim().toLowerCase();
