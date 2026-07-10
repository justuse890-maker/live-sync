// Lightweight WebAuthn registration for biometric unlock.
// We store the credential ID locally — there's no server-side challenge verification
// in this prototype, but the platform authenticator (Face ID / Touch ID / Windows Hello /
// Android biometrics) still gates the registration ceremony.

const STORAGE_KEY = "livesync-webauthn-credential";

export function isWebAuthnSupported(): boolean {
  return typeof window !== "undefined"
    && typeof window.PublicKeyCredential !== "undefined"
    && typeof navigator.credentials?.create === "function";
}

export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function registerBiometric(userId: string, userEmail: string): Promise<{ credentialId: string }> {
  if (!isWebAuthnSupported()) throw new Error("WebAuthn not supported on this device");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userIdBytes = new TextEncoder().encode(userId);

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "LiveSync AI", id: window.location.hostname },
      user: { id: userIdBytes, name: userEmail, displayName: userEmail },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Biometric registration cancelled");

  const credentialId = b64url(cred.rawId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ credentialId, userId, registeredAt: new Date().toISOString() }));
  return { credentialId };
}

export async function verifyBiometric(): Promise<boolean> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) throw new Error("No biometric credential registered");
  const { credentialId } = JSON.parse(stored);

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const idBytes = Uint8Array.from(atob(credentialId.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: "public-key", id: idBytes, transports: ["internal"] }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return !!assertion;
}

export function clearBiometric() {
  localStorage.removeItem(STORAGE_KEY);
}
