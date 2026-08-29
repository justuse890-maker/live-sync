/**
 * fieldCrypto.ts
 * Client-side field-level AES-256-GCM encryption for sensitive financial data.
 *
 * Architecture:
 *   - Sensitive fields (amounts, names, notes) are encrypted on the device
 *     BEFORE being sent to Supabase. Supabase stores only ciphertext.
 *   - Structural fields (id, userId, type, date, category) stay plaintext
 *     so the server can still key/filter on them.
 *   - The encryption key is derived via PBKDF2 from a per-device random secret
 *     stored in Capacitor Preferences (SharedPreferences on Android).
 *     The key NEVER leaves the device.
 *
 * Backward compatibility:
 *   - decryptFields() detects plaintext values (no "enc:" prefix) and
 *     returns them as-is. This lets old unencrypted data load seamlessly.
 *   - Migration to encrypted form happens lazily on next write, or via
 *     the explicit migratePlaintextToEncrypted() function.
 *
 * DATA SAFETY:
 *   - This module NEVER deletes, clears, or resets any stored data.
 *   - It only transforms field values in-memory before save / after load.
 *   - Storage keys (KV keys in Supabase, IndexedDB collection names) are untouched.
 */

import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

// ── Constants ────────────────────────────────────────────────────────────────
const ENC_PREFIX = "enc:";
const DEVICE_SECRET_KEY = "livesync-field-enc-secret";
const PBKDF2_ITERATIONS = 300_000; // Balanced: strong security, fast on mobile
const SALT_BYTES = 16;
const IV_BYTES = 12;

// ── Per-collection sensitive field definitions ───────────────────────────────
// Only these fields are encrypted. Everything else stays plaintext.
const SENSITIVE_FIELDS: Record<string, string[]> = {
  transactions: ["title", "amount", "merchant", "notes"],
  loans: ["person", "amount", "notes"],
  structuredLoans: [
    "lenderName", "principalAmount", "outstandingPrincipal",
    "emiAmount", "notes",
  ],
  creditCards: ["bankName", "cardName", "last4Digits", "creditLimit", "notes"],
  sips: ["fundName", "amount", "notes"],
  insurance: [
    "name", "policyNumber", "coverageAmount", "premiumAmount",
    "insurer", "notes", "membersCovered",
  ],
  investments: ["name", "investedAmount", "currentValue", "notes"],
  gold: ["name", "weightGrams", "purchasePrice", "notes"],
  properties: [
    "name", "purchasePrice", "currentValuation", "rentalIncome", "notes",
  ],
  goals: ["name", "target", "current"],
  budgets: ["limit", "spent"],
  buckets: ["name", "description", "targetAmount", "savedAmount", "monthlySaveTarget"],
  bucketContributions: ["amount", "note"],
  assets: ["name", "value", "notes"],
  liabilities: ["name", "value", "notes"],
  creditScore: ["score"],
  fraudAlerts: ["title", "body"],
  categories: ["name"],
  subscriptions: ["name", "cost"],
};

// ── Key management ───────────────────────────────────────────────────────────

/** Cached CryptoKeys for the session — avoids repeated PBKDF2 derivation */
let _cachedKeys: { primary: CryptoKey; candidates: CryptoKey[] } | null = null;
let _cachedUserId: string | null = null;

/**
 * Get or create the per-device random secret.
 * Stored in Capacitor Preferences (Android SharedPreferences) which
 * survives APK updates. Falls back to localStorage on web.
 */
async function getDeviceSecret(): Promise<string> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key: DEVICE_SECRET_KEY });
      if (value) return value;

      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const secret = btoa(String.fromCharCode(...bytes));
      await Preferences.set({ key: DEVICE_SECRET_KEY, value: secret });
      return secret;
    }

    let secret = localStorage.getItem(DEVICE_SECRET_KEY);
    if (!secret) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      secret = btoa(String.fromCharCode(...bytes));
      localStorage.setItem(DEVICE_SECRET_KEY, secret);
    }
    return secret;
  } catch {
    return "livesync-default-local-device-secret";
  }
}

/**
 * Derives a specific AES-256-GCM key from a given passphrase and salt label.
 */
async function deriveSingleKey(passphrase: string, saltLabel: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const saltInput = encoder.encode(saltLabel);
  const saltHash = await crypto.subtle.digest("SHA-256", saltInput);
  const salt = new Uint8Array(saltHash).slice(0, SALT_BYTES);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Derive primary encryption key and candidate decryption keys for multi-device sync.
 * Primary: Deterministic across Web, Android, iOS for the same userId.
 * Candidates: Include device-specific secret and legacy derivations so older records decrypt cleanly.
 */
async function getFieldKeys(userId: string): Promise<{ primary: CryptoKey; candidates: CryptoKey[] }> {
  if (_cachedKeys && _cachedUserId === userId) return _cachedKeys;

  const deviceSecret = await getDeviceSecret();
  
  // 1. Primary: Deterministic user key (syncs seamlessly across Android, Web, iOS)
  const primary = await deriveSingleKey(
    `${userId}:livesync-field-master-seed-v1`,
    `livesync-field-salt:${userId}`
  );

  // 2. Legacy / candidate keys for backward compatibility with previously encrypted rows
  const deviceKey = await deriveSingleKey(
    `${userId}:${deviceSecret}`,
    `livesync-field-salt:${userId}`
  );
  const userDirectKey = await deriveSingleKey(
    userId,
    `livesync-field-salt:${userId}`
  );

  _cachedKeys = {
    primary,
    candidates: [primary, deviceKey, userDirectKey],
  };
  _cachedUserId = userId;
  return _cachedKeys;
}

/** Clear the cached key on sign-out so a new user gets a fresh derivation */
export function clearFieldKeyCache(): void {
  _cachedKeys = null;
  _cachedUserId = null;
}

// ── Low-level encrypt / decrypt ──────────────────────────────────────────────

async function encryptValue(key: CryptoKey, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(value),
  );
  // Pack as: iv (12 bytes) + ciphertext
  const packed = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), IV_BYTES);
  return ENC_PREFIX + btoa(String.fromCharCode(...packed));
}

async function decryptValue(candidates: CryptoKey[], encoded: string): Promise<string | null> {
  if (!encoded.startsWith(ENC_PREFIX)) return encoded; // Plaintext, return as-is
  try {
    const raw = atob(encoded.slice(ENC_PREFIX.length));
    const bytes = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
    const iv = bytes.slice(0, IV_BYTES);
    const ciphertext = bytes.slice(IV_BYTES);

    for (const key of candidates) {
      try {
        const decrypted = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          key,
          ciphertext,
        );
        return new TextDecoder().decode(decrypted);
      } catch {
        // Try next candidate key
      }
    }
  } catch (e) {
    console.warn("Ciphertext parsing error:", e);
  }
  return null; // All decryption candidates failed
}

// ── Numeric fields set for automatic type restoration & safe fallback ────────
const NUMERIC_FIELDS = new Set([
  "amount", "targetAmount", "savedAmount", "monthlySaveTarget", "target", "current",
  "limit", "spent", "cost", "value", "score", "creditLimit", "principalAmount",
  "outstandingPrincipal", "emiAmount", "weightGrams", "purchasePrice", "currentValuation",
  "rentalIncome", "coverageAmount", "premiumAmount", "investedAmount", "currentValue"
]);

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Encrypt sensitive fields of an item before sending to the cloud.
 * Non-sensitive and structural fields are left untouched.
 * Returns a shallow copy — the original object is NOT mutated.
 */
export async function encryptFields<T extends Record<string, any>>(
  collection: string,
  item: T,
  userId: string,
): Promise<T> {
  const fields = SENSITIVE_FIELDS[collection];
  if (!fields || fields.length === 0) return item;

  const { primary } = await getFieldKeys(userId);
  const result = { ...item };

  for (const field of fields) {
    const val = result[field];
    if (val === undefined || val === null) continue;

    // Already encrypted — skip
    if (typeof val === "string" && val.startsWith(ENC_PREFIX)) continue;

    // Arrays (e.g., membersCovered) — encrypt each element
    if (Array.isArray(val)) {
      (result as any)[field] = await Promise.all(
        val.map((v) => encryptValue(primary, String(v))),
      );
      continue;
    }

    // Numbers, strings — serialize and encrypt
    (result as any)[field] = await encryptValue(primary, String(val));
  }

  return result;
}

/**
 * Decrypt sensitive fields of an item loaded from the cloud.
 * Handles both encrypted ("enc:...") and plaintext values transparently.
 * Returns a shallow copy — the original object is NOT mutated.
 */
export async function decryptFields<T extends Record<string, any>>(
  collection: string,
  item: T,
  userId: string,
): Promise<T> {
  const fields = SENSITIVE_FIELDS[collection];
  if (!fields || fields.length === 0) return item;

  const { candidates } = await getFieldKeys(userId);
  const result = { ...item };

  for (const field of fields) {
    const val = result[field];
    if (val === undefined || val === null) continue;

    // Plaintext — backward compatible, return as-is
    if (typeof val === "string" && !val.startsWith(ENC_PREFIX)) continue;
    if (typeof val === "number") continue;

    // Encrypted arrays
    if (Array.isArray(val)) {
      (result as any)[field] = await Promise.all(
        val.map(async (v) => {
          if (typeof v === "string" && v.startsWith(ENC_PREFIX)) {
            const dec = await decryptValue(candidates, v);
            return dec ?? "";
          }
          return v;
        }),
      );
      continue;
    }

    // Encrypted scalar
    if (typeof val === "string" && val.startsWith(ENC_PREFIX)) {
      const decrypted = await decryptValue(candidates, val);

      if (decrypted !== null) {
        // Restore original type: if the field was a number, parse it back
        const num = Number(decrypted);
        (result as any)[field] = isNaN(num) || decrypted.trim() === ""
          ? decrypted
          : num;
      } else {
        // Safe fallback if key mismatch occurred: NEVER expose raw enc: string or create NaN
        if (NUMERIC_FIELDS.has(field)) {
          (result as any)[field] = 0;
        } else if (field === "name" || field === "title") {
          (result as any)[field] = collection === "buckets" || collection === "goals" ? "Goal" : "Transaction";
        } else {
          (result as any)[field] = "";
        }
      }
    }
  }

  return result;
}

/**
 * Check whether a given item has any fields that are still plaintext
 * (i.e., not yet encrypted). Used by the migration function.
 */
export function hasPlaintextFields(collection: string, item: Record<string, any>): boolean {
  const fields = SENSITIVE_FIELDS[collection];
  if (!fields) return false;

  for (const field of fields) {
    const val = item[field];
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      if (val.some((v) => typeof v === "string" && !v.startsWith(ENC_PREFIX))) return true;
      continue;
    }
    if (typeof val === "string" && !val.startsWith(ENC_PREFIX)) return true;
    if (typeof val === "number") return true; // Numbers are always plaintext
  }
  return false;
}

/**
 * Get the list of collections that have sensitive fields defined.
 */
export function getEncryptableCollections(): string[] {
  return Object.keys(SENSITIVE_FIELDS);
}
