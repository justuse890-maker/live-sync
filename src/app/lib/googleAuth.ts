/**
 * Google OAuth uses a public Web client ID. It is still kept in an environment
 * variable so development, staging, and production builds cannot accidentally
 * use each other's OAuth credentials.
 */
const GOOGLE_CLIENT_ID_SUFFIX = ".apps.googleusercontent.com";

export function getGoogleWebClientId(): string | null {
  const clientId = (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ?? "").trim();

  if (
    !clientId ||
    clientId.includes("YOUR_") ||
    clientId.includes("YOUR-") ||
    !clientId.endsWith(GOOGLE_CLIENT_ID_SUFFIX)
  ) {
    return null;
  }

  return clientId;
}

export const GOOGLE_CONFIGURATION_ERROR =
  "Google sign-in is not configured for this app build. Add VITE_GOOGLE_WEB_CLIENT_ID to the build environment, then rebuild and sync the Android app.";
