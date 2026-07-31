import { useState } from "react";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase, adminApi } from "../lib/adminApi";

export function AdminAuth({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Verify this account is actually an admin (listed in ADMIN_EMAILS env var)
      await adminApi.me();
      onAuthed();
    } catch (e: any) {
      console.error("Admin auth failed:", e);
      setErr(e?.message || "Auth failed. Admin access required.");
      await supabase().auth.signOut().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 text-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="text-lg font-semibold">LiveSync Admin</div>
            <div className="text-xs text-slate-400">Restricted access · operators only</div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <div className="text-xs text-slate-400 mb-1">Admin email</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
              placeholder="you@yourdomain.com"
            />
          </label>
          <label className="block">
            <div className="text-xs text-slate-400 mb-1">Password</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            />
          </label>
          {err && (
            <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">
              <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Sign in to admin panel
          </button>
        </form>

        <div className="mt-6 text-[11px] text-slate-500 leading-relaxed">
          Access is strictly gated by the ADMIN_EMAILS environment variable.
        </div>
      </div>
    </div>
  );
}
