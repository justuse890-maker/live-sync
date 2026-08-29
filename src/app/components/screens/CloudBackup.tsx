import { useState, useEffect } from "react";
import {
  Cloud, CloudOff, Lock, Download, Upload, Trash2, Loader2,
  CheckCircle2, AlertTriangle, Shield, RefreshCw, Key, Eye, EyeOff,
  HardDrive
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { exportAllCacheData, importToCacheData } from "../../lib/localCache";
import { encryptData, decryptData } from "../../lib/crypto";
import * as drive from "../../lib/googleDrive";
import { useStore } from "../../store";

type BackupState = "idle" | "backing-up" | "restoring" | "deleting";

export function CloudBackup({ onBack }: { onBack: () => void }) {
  const [linked, setLinked] = useState(drive.isSignedIn());
  const [backups, setBackups] = useState<drive.BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<BackupState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [restorePass, setRestorePass] = useState("");
  const [showRestorePass, setShowRestorePass] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<drive.BackupInfo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<drive.BackupInfo | null>(null);
  const configured = drive.isConfigured();
  const { refresh } = useStore();

  const loadBackups = async () => {
    if (!linked) return;
    setLoading(true);
    try {
      const list = await drive.listBackups();
      setBackups(list);
    } catch (e: any) {
      console.error("Load backups failed:", e);
      setError(e.message || "Failed to load backups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (linked) loadBackups();
  }, [linked]);

  const handleLink = async () => {
    setError(null);
    try {
      await drive.signIn();
      setLinked(true);
    } catch (e: any) {
      setError(e.message || "Google sign-in failed");
    }
  };

  const handleUnlink = () => {
    drive.signOut();
    setLinked(false);
    setBackups([]);
  };

  const handleBackup = async () => {
    if (!passphrase || passphrase.length < 6) {
      setError("Passphrase must be at least 6 characters");
      return;
    }
    setError(null);
    setSuccess(null);
    setState("backing-up");
    try {
      const data = await exportAllCacheData();
      const json = JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        app: "LiveSync AI",
        collections: data,
      });
      const encrypted = await encryptData(json, passphrase);
      const info = await drive.uploadBackup(encrypted);
      setBackups((prev) => {
        const without = prev.filter((b) => b.id !== info.id);
        return [info, ...without];
      });
      setSuccess(`Backup created successfully (${fmtSize(info.size)})`);
      setPassphrase("");
    } catch (e: any) {
      setError(e.message || "Backup failed");
    } finally {
      setState("idle");
    }
  };

  const handleRestore = async (backup: drive.BackupInfo) => {
    if (!restorePass || restorePass.length < 6) {
      setError("Enter the passphrase you used when creating this backup");
      return;
    }
    setError(null);
    setSuccess(null);
    setState("restoring");
    try {
      const encrypted = await drive.downloadBackup(backup.id);
      let json: string;
      try {
        json = await decryptData(encrypted, restorePass);
      } catch {
        setError("Wrong passphrase. The backup could not be decrypted.");
        setState("idle");
        return;
      }
      const parsed = JSON.parse(json);
      if (!parsed.collections || typeof parsed.collections !== "object") {
        setError("Invalid backup format");
        setState("idle");
        return;
      }
      await importToCacheData(parsed.collections);
      await refresh();
      setSuccess("Data restored successfully! Your data has been synced.");
      setConfirmRestore(null);
      setRestorePass("");
    } catch (e: any) {
      setError(e.message || "Restore failed");
    } finally {
      setState("idle");
    }
  };

  const handleDelete = async (backup: drive.BackupInfo) => {
    setError(null);
    setState("deleting");
    try {
      await drive.deleteBackup(backup.id);
      setBackups((prev) => prev.filter((b) => b.id !== backup.id));
      setSuccess("Backup deleted");
      setConfirmDelete(null);
    } catch (e: any) {
      setError(e.message || "Delete failed");
    } finally {
      setState("idle");
    }
  };

  const busy = state !== "idle";

  return (
    <>
      <Header title="Cloud Backup" subtitle="Encrypted Google Drive backup" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4 pb-10">

          {/* Hero */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5">
            <div className="flex items-center gap-2">
              <Cloud className="size-5" />
              <div className="text-sm" style={{ fontWeight: 700 }}>Encrypted cloud backup</div>
            </div>
            <p className="text-xs text-white/80 mt-2 leading-relaxed">
              Back up your financial data to Google Drive with AES-256-GCM encryption before upload. Keep your passphrase safe: it is required to decrypt the backup in the app.
            </p>
          </div>

          {/* Status */}
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 flex items-start gap-2">
              <AlertTriangle className="size-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="text-xs text-rose-700 leading-relaxed">{error}</span>
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="text-xs text-emerald-700 leading-relaxed">{success}</span>
            </div>
          )}

          {!configured ? (
            /* Not configured */
            <div className="bg-card rounded-2xl border border-border/60 p-5 text-center">
              <CloudOff className="size-8 mx-auto text-muted-foreground mb-2" />
              <div className="text-sm" style={{ fontWeight: 700 }}>Google Drive not configured</div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
                To enable cloud backup, a Google Cloud OAuth Client ID must be configured in the app. Please contact the developer or set up a Google Cloud project.
              </p>
            </div>
          ) : !linked ? (
            /* Not linked */
            <div className="bg-card rounded-2xl border border-border/60 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Cloud className="size-6" />
                </div>
                <div>
                  <div className="text-sm" style={{ fontWeight: 700 }}>Link Google Drive</div>
                  <div className="text-xs text-muted-foreground">Sign in to enable encrypted backups</div>
                </div>
              </div>
              <button
                onClick={handleLink}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm flex items-center justify-center gap-2"
                style={{ fontWeight: 700 }}
              >
                <Cloud className="size-4" /> Sign in with Google
              </button>
            </div>
          ) : (
            /* Linked — show backup/restore */
            <>
              {/* Linked status */}
              <div className="bg-card rounded-2xl border border-border/60 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="size-5" />
                  </div>
                  <div>
                    <div className="text-sm" style={{ fontWeight: 600 }}>Google Drive linked</div>
                    <div className="text-xs text-muted-foreground">Backups stored in app-private folder</div>
                  </div>
                </div>
                <button onClick={handleUnlink} className="text-xs text-muted-foreground hover:text-rose-600" style={{ fontWeight: 600 }}>
                  Unlink
                </button>
              </div>

              {/* Create backup */}
              <Section title="Create backup">
                <div className="p-4 space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                      <Lock className="size-3 inline mr-1" />
                      Encryption passphrase
                    </div>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm pr-10"
                      />
                      <button
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-2.5 text-muted-foreground"
                      >
                        {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                      <Shield className="size-3 inline mr-1" />
                      Remember this passphrase — it's the only way to decrypt your backup. We cannot recover it.
                    </div>
                  </div>
                  <button
                    onClick={handleBackup}
                    disabled={busy || !passphrase || passphrase.length < 6}
                    className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ fontWeight: 700 }}
                  >
                    {state === "backing-up" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {state === "backing-up" ? "Encrypting & uploading…" : "Back up now"}
                  </button>
                </div>
              </Section>

              {/* Existing backups */}
              <Section title={`Backups · ${backups.length}`}>
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : backups.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <HardDrive className="size-6 mx-auto mb-2 text-muted-foreground/50" />
                    No backups yet
                  </div>
                ) : (
                  <div>
                    {backups.map((b) => (
                      <div key={b.id} className="flex items-center gap-3 p-3.5 border-b border-border/60 last:border-0">
                        <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                          <Cloud className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm" style={{ fontWeight: 600 }}>
                            {new Date(b.modifiedTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {fmtSize(b.size)} · {new Date(b.modifiedTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                        <button
                          onClick={() => { setConfirmRestore(b); setRestorePass(""); setError(null); }}
                          disabled={busy}
                          className="size-8 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10"
                        >
                          <Download className="size-4" />
                        </button>
                        <button
                          onClick={() => { setConfirmDelete(b); setError(null); }}
                          disabled={busy}
                          className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={loadBackups}
                  disabled={busy}
                  className="w-full py-2.5 text-xs text-muted-foreground flex items-center justify-center gap-1 hover:bg-muted/40 border-t border-border/60"
                  style={{ fontWeight: 600 }}
                >
                  <RefreshCw className="size-3" /> Refresh
                </button>
              </Section>

              {/* How it works */}
              <div className="bg-card rounded-2xl p-4 border border-border/60 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-2 text-foreground mb-1" style={{ fontWeight: 700 }}>
                  <Key className="size-3.5 text-primary" /> How encryption works
                </div>
                <div>• Your data is encrypted with AES-256-GCM using a key derived from your passphrase (PBKDF2, 600K iterations).</div>
                <div>• The encrypted file is uploaded to a Google Drive folder only this app can access.</div>
                <div>• The backup is encrypted before upload. Without the passphrase, it cannot be decrypted by this app.</div>
                <div>• On restore, the backup is downloaded, decrypted locally, and synced to your account.</div>
              </div>
            </>
          )}
        </div>
      </Screen>

      {/* Restore confirmation sheet */}
      {confirmRestore && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => !busy && setConfirmRestore(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-8 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <Download className="size-5 text-primary" />
              <span className="text-base" style={{ fontWeight: 700 }}>Restore from backup?</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              This will restore data from <span className="text-foreground" style={{ fontWeight: 600 }}>
                {new Date(confirmRestore.modifiedTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span> ({fmtSize(confirmRestore.size)}). Your current data will be merged with the backup.
            </p>
            <div className="mb-4">
              <div className="text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>
                <Lock className="size-3 inline mr-1" />
                Enter your backup passphrase
              </div>
              <div className="relative">
                <input
                  type={showRestorePass ? "text" : "password"}
                  value={restorePass}
                  onChange={(e) => setRestorePass(e.target.value)}
                  placeholder="Passphrase used during backup"
                  className="w-full bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm pr-10"
                />
                <button
                  onClick={() => setShowRestorePass(!showRestorePass)}
                  className="absolute right-3 top-3 text-muted-foreground"
                >
                  {showRestorePass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => setConfirmRestore(null)}
                className="flex-1 bg-muted rounded-xl py-3 text-sm"
                style={{ fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                disabled={busy || restorePass.length < 6}
                onClick={() => handleRestore(confirmRestore)}
                className="flex-[2] bg-primary text-primary-foreground rounded-xl py-3 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ fontWeight: 700 }}
              >
                {state === "restoring" && <Loader2 className="size-4 animate-spin" />}
                Decrypt & restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation sheet */}
      {confirmDelete && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => !busy && setConfirmDelete(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-8 shadow-xl">
            <div className="flex items-center gap-2 mb-2 text-rose-600" style={{ fontWeight: 700 }}>
              <AlertTriangle className="size-4" /> Delete this backup?
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              This will permanently delete the backup from {new Date(confirmDelete.modifiedTime).toLocaleDateString("en-IN")}. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-muted rounded-xl py-3 text-sm"
                style={{ fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 bg-rose-600 text-white rounded-xl py-3 text-sm inline-flex items-center justify-center gap-2"
                style={{ fontWeight: 700 }}
              >
                {state === "deleting" && <Loader2 className="size-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1" style={{ fontWeight: 600 }}>{title}</div>
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">{children}</div>
    </div>
  );
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
