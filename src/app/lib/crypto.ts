/**
 * crypto.ts
 * AES-256-GCM encryption/decryption using the Web Crypto API.
 * Used to encrypt backup data before uploading to Google Drive.
 * 
 * Key derivation: PBKDF2 from user passphrase + random salt.
 * No external dependencies — uses native browser/WebView APIs.
 */

const PBKDF2_ITERATIONS = 600_000; // OWASP 2023 recommendation
const SALT_BYTES = 16;
const IV_BYTES = 12; // AES-GCM standard nonce size

/**
 * Derive an AES-256-GCM key from a user passphrase.
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt plaintext JSON data with AES-256-GCM.
 * Returns a Uint8Array: [salt (16)] [iv (12)] [ciphertext (...)]
 */
export async function encryptData(
  plaintext: string,
  passphrase: string
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  // Concatenate: salt + iv + ciphertext
  const result = new Uint8Array(SALT_BYTES + IV_BYTES + ciphertext.byteLength);
  result.set(salt, 0);
  result.set(iv, SALT_BYTES);
  result.set(new Uint8Array(ciphertext), SALT_BYTES + IV_BYTES);
  return result;
}

/**
 * Decrypt data that was encrypted with encryptData().
 * Expects the same format: [salt (16)] [iv (12)] [ciphertext (...)]
 */
export async function decryptData(
  encrypted: Uint8Array,
  passphrase: string
): Promise<string> {
  const salt = encrypted.slice(0, SALT_BYTES);
  const iv = encrypted.slice(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = encrypted.slice(SALT_BYTES + IV_BYTES);

  const key = await deriveKey(passphrase, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Quick test: encrypt → decrypt round-trip.
 * Useful for validating the passphrase before a full restore.
 */
export async function testPassphrase(
  encrypted: Uint8Array,
  passphrase: string
): Promise<boolean> {
  try {
    await decryptData(encrypted, passphrase);
    return true;
  } catch {
    return false;
  }
}
