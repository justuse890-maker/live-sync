import { useState } from "react";
import { Shield, Cloud, Lock, Cpu, Trash2, LogOut, AlertTriangle, CheckCircle2, Server, Key, RefreshCw, Loader2, Eye, EyeOff } from "lucide-react";
import { Header, Screen } from "../Shell";
import { api } from "../../lib/api";

export function DataSafety({ onBack, onDeleteSuccess }: { onBack: () => void; onDeleteSuccess: () => void }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // ── Sign out ──
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await api.signout(); // also clears all local cache
      onDeleteSuccess(); // navigate back to login
    } catch (e) {
      console.error("Sign out error:", e);
    } finally {
      setSigningOut(false);
    }
  };

  // ── Delete account ──
  const handleDelete = async () => {
    if (deleteInput.trim().toLowerCase() !== "delete my account") return;
    setDeleting(true);
    try {
      await api.deleteAccount(); // also clears cache + signs out
      onDeleteSuccess();
    } catch (e: any) {
      console.error("Delete account failed:", e);
      alert("Account deletion failed. Please try again or contact support.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Header title="Data Safety" subtitle="How your data is stored & protected" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 pb-10 space-y-4">

          {/* Hero banner */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="size-5" />
              <span className="text-sm font-bold">Your data is safe</span>
            </div>
            <p className="text-xs text-white/80 leading-relaxed">
              All your financial data is user-isolated and stored in a secure cloud database. Each user's data is separated by authenticated API access — other users cannot read your records.
            </p>
          </div>

          {/* How data is stored */}
          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">How your data is saved</div>
            </div>
            <SafetyRow
              icon={<Cloud className="size-4" />}
              color="text-indigo-500"
              bg="bg-indigo-500/10"
              title="Cloud-synced to Supabase"
              desc="Every transaction, goal, budget, and setting is saved instantly to a secure cloud database. Available across all your devices."
            />
            <SafetyRow
              icon={<Key className="size-4" />}
              color="text-emerald-500"
              bg="bg-emerald-500/10"
              title="Tied to your account only"
              desc="Your data is locked to your user ID using Row-Level Security (RLS). Even if someone knew your database URL, they cannot read your records."
            />
            <SafetyRow
              icon={<Lock className="size-4" />}
              color="text-amber-500"
              bg="bg-amber-500/10"
              title="Encrypted storage"
              desc="Data is encrypted at rest (AES-256, Supabase platform-level) and in transit (TLS 1.3). Your financial information is protected by industry-standard encryption."
            />
            <SafetyRow
              icon={<RefreshCw className="size-4" />}
              color="text-sky-500"
              bg="bg-sky-500/10"
              title="Auto-saved on every action"
              desc='There is no "save" button — every add, edit, or delete is persisted immediately to the cloud. Your data is never lost if the app crashes.'
              last
            />
          </div>

          {/* What happens on sign-out */}
          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">When you sign out</div>
            </div>
            <div className="px-4 pb-4 space-y-2">
              <CheckRow icon="✅" text="Your cloud data is preserved — nothing is deleted" />
              <CheckRow icon="🔒" text="Your session token is invalidated immediately" />
              <CheckRow icon="🧹" text="All local news cache and session data is wiped from this device" />
              <CheckRow icon="📱" text="When you sign back in, data re-syncs from the cloud" />
            </div>
          </div>

          {/* What happens on delete */}
          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">When you delete your account</div>
            </div>
            <div className="px-4 pb-4 space-y-2">
              <CheckRow icon="🗑️" text="All transactions, goals, loans, and documents are permanently deleted" />
              <CheckRow icon="🔒" text="Your auth credentials are removed from our system" />
              <CheckRow icon="🤖" text="All AI consent and consent records are revoked" />
              <CheckRow icon="🧹" text="All local cache on this device is wiped immediately" />
              <CheckRow icon="📋" text="Deletion completes immediately" />
              <CheckRow icon="⚠️" text="This action CANNOT be undone" warn />
            </div>
          </div>

          {/* AI data section */}
          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">AI features & your data</div>
            </div>
            <SafetyRow
              icon={<Cpu className="size-4" />}
              color="text-violet-500"
              bg="bg-violet-500/10"
              title="AI is optional — you control it"
              desc="AI-powered features (Coach, Insights) only send anonymised summaries to AI providers. We never share your name, email, or raw transactions."
            />
            <SafetyRow
              icon={<Server className="size-4" />}
              color="text-rose-500"
              bg="bg-rose-500/10"
              title="AI providers used"
              desc="Google Gemini for server-side AI (coach, categorisation). Bring-your-own-key mode supports Groq (Llama models)."
              last
            />
            <div className="px-4 py-3 bg-amber-50/60 border-t border-amber-200/60">
              <p className="text-[11px] text-amber-800 leading-relaxed">
                ⚠️ AI outputs may contain errors and do not constitute professional financial advice. You can disable AI features at any time in Security & Privacy settings.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            {/* Sign Out */}
            <button
              onClick={() => setShowSignOutConfirm(true)}
              className="w-full bg-card rounded-2xl border border-border/60 p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
            >
              <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <LogOut className="size-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">Sign out of this device</div>
                <div className="text-xs text-muted-foreground mt-0.5">Your data stays in the cloud safely</div>
              </div>
            </button>

            {/* Delete Account */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full bg-rose-50 rounded-2xl border border-rose-200 p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
            >
              <div className="size-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <Trash2 className="size-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-rose-600">Delete my account & data</div>
                <div className="text-xs text-rose-400 mt-0.5">Permanent — cannot be undone</div>
              </div>
            </button>
          </div>

        </div>
      </Screen>

      {/* ── Sign-out bottom sheet ── */}
      {showSignOutConfirm && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => !signingOut && setShowSignOutConfirm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-safe-or-8 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <LogOut className="size-5 text-amber-500" />
              <span className="text-base font-bold">Sign out?</span>
            </div>
            <div className="space-y-2 mb-5">
              <CheckRow icon="✅" text="Your data stays safely in the cloud" />
              <CheckRow icon="🔒" text="Session ends on this device" />
              <CheckRow icon="🧹" text="Local cache cleared from this device" />
              <CheckRow icon="📱" text="Sign back in any time to restore everything" />
            </div>
            <div className="flex gap-2">
              <button
                disabled={signingOut}
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 bg-muted rounded-xl py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={signingOut}
                onClick={handleSignOut}
                className="flex-[2] bg-amber-500 text-white rounded-xl py-3 text-sm font-bold inline-flex items-center justify-center gap-2"
              >
                {signingOut && <Loader2 className="size-4 animate-spin" />}
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete account bottom sheet ── */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-safe-or-8 shadow-xl">
            <div className="flex items-center gap-2 mb-2 text-rose-600">
              <AlertTriangle className="size-5" />
              <span className="text-base font-bold">Delete account forever?</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              This permanently removes all your transactions, goals, loans, documents, and credentials. Per DPDP Act §12, deletion completes within 30 days. <span className="text-foreground font-semibold">This cannot be undone.</span>
            </p>

            <label className="block mb-1">
              <span className="text-xs font-semibold text-muted-foreground">Type <span className="text-foreground font-bold">delete my account</span> to confirm</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="delete my account"
                className="w-full bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-500/30 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                className="absolute right-3 top-3.5 text-muted-foreground"
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                disabled={deleting}
                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(""); }}
                className="flex-1 bg-muted rounded-xl py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={deleting || deleteInput.trim().toLowerCase() !== "delete my account"}
                onClick={handleDelete}
                className="flex-[2] bg-rose-600 text-white rounded-xl py-3 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {deleting && <Loader2 className="size-4 animate-spin" />}
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SafetyRow({ icon, color, bg, title, desc, last }: {
  icon: React.ReactNode; color: string; bg: string; title: string; desc: string; last?: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 ${last ? "" : "border-b border-border/60"}`}>
      <div className={`size-9 rounded-xl ${bg} ${color} flex items-center justify-center shrink-0 mt-0.5`}>
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

function CheckRow({ icon, text, warn }: { icon: string; text: string; warn?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm shrink-0">{icon}</span>
      <span className={`text-xs leading-relaxed ${warn ? "text-rose-600 font-semibold" : "text-muted-foreground"}`}>{text}</span>
    </div>
  );
}
