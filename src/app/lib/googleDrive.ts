/**
 * googleDrive.ts
 * Google Drive API wrapper for encrypted backup/restore.
 * Uses Google Identity Services (GIS) for OAuth 2.0 flow.
 * Stores backups in the app-specific "appDataFolder" on Google Drive,
 * which is invisible to the user but tied to their Google account.
 *
 * SETUP REQUIRED:
 * 1. Create a Google Cloud project at https://console.cloud.google.com
 * 2. Enable the Google Drive API
 * 3. Create OAuth 2.0 Client ID (Web application type)
 * 4. Add your domain to Authorized JavaScript origins
 * 5. Set the Client ID below in GOOGLE_CLIENT_ID
 */

// ──────────────────────────────────────────────────
// Replace with your Google Cloud OAuth Client ID
// ──────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = "";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const BACKUP_FILENAME = "livesync-backup.enc";

let _accessToken: string | null = null;
let _tokenExpiry = 0;
let _gisLoaded = false;

// ─── Load Google Identity Services SDK ───────────────────────────────────
function loadGIS(): Promise<void> {
  if (_gisLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (document.getElementById("gis-script")) {
      _gisLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      _gisLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
}

// ─── OAuth Token ─────────────────────────────────────────────────────────

export function isConfigured(): boolean {
  return GOOGLE_CLIENT_ID.length > 0;
}

export function isSignedIn(): boolean {
  return !!_accessToken && Date.now() < _tokenExpiry;
}

export async function signIn(): Promise<string> {
  if (!isConfigured()) {
    throw new Error(
      "Google Drive is not configured. Set GOOGLE_CLIENT_ID in googleDrive.ts."
    );
  }
  await loadGIS();

  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        _accessToken = response.access_token;
        _tokenExpiry = Date.now() + (response.expires_in ?? 3600) * 1000;
        resolve(response.access_token);
      },
    });
    client.requestAccessToken();
  });
}

export function signOut(): void {
  if (_accessToken) {
    try {
      (window as any).google?.accounts?.oauth2?.revoke?.(_accessToken);
    } catch { /* best-effort */ }
  }
  _accessToken = null;
  _tokenExpiry = 0;
}

function getToken(): string {
  if (!_accessToken || Date.now() >= _tokenExpiry) {
    throw new Error("Not signed in to Google Drive. Please sign in first.");
  }
  return _accessToken;
}

// ─── Drive API Helpers ───────────────────────────────────────────────────

async function driveRequest(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Drive API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

export type BackupInfo = {
  id: string;
  name: string;
  size: number;
  modifiedTime: string;
};

/**
 * List all backups in appDataFolder.
 */
export async function listBackups(): Promise<BackupInfo[]> {
  const res = await driveRequest(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,size,modifiedTime)&orderBy=modifiedTime desc&q=name='${BACKUP_FILENAME}'`
  );
  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    size: Number(f.size || 0),
    modifiedTime: f.modifiedTime,
  }));
}

/**
 * Upload encrypted backup data to Google Drive appDataFolder.
 * If a backup already exists, it is replaced (updated).
 */
export async function uploadBackup(encryptedData: Uint8Array): Promise<BackupInfo> {
  // Check if backup already exists
  const existing = await listBackups();
  const existingFile = existing[0]; // most recent

  const metadata = {
    name: BACKUP_FILENAME,
    mimeType: "application/octet-stream",
    ...(existingFile ? {} : { parents: ["appDataFolder"] }),
  };

  const boundary = "livesync_boundary_" + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataStr = JSON.stringify(metadata);
  const body =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    metadataStr +
    delimiter +
    "Content-Type: application/octet-stream\r\n" +
    "Content-Transfer-Encoding: base64\r\n\r\n" +
    uint8ToBase64(encryptedData) +
    closeDelimiter;

  let url: string;
  let method: string;

  if (existingFile) {
    // Update existing file
    url = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart`;
    method = "PATCH";
  } else {
    // Create new file
    url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
    method = "POST";
  }

  const res = await driveRequest(url, {
    method,
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  const data = await res.json();
  return {
    id: data.id,
    name: data.name || BACKUP_FILENAME,
    size: encryptedData.byteLength,
    modifiedTime: data.modifiedTime || new Date().toISOString(),
  };
}

/**
 * Download a backup file from Google Drive.
 */
export async function downloadBackup(fileId: string): Promise<Uint8Array> {
  const res = await driveRequest(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  );
  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Delete a backup file from Google Drive.
 */
export async function deleteBackup(fileId: string): Promise<void> {
  await driveRequest(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    { method: "DELETE" }
  );
}

// ─── Utility ─────────────────────────────────────────────────────────────

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
