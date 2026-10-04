import { useEffect, useMemo, useState } from "react";
import {
  Smartphone, CloudOff, ShieldCheck, Brain, KeyRound, HardDriveDownload, Download, Trash2, Loader2, Eye, Lock, CheckCircle2, X, Cloud,
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { api } from "../../lib/api";
import { useStore } from "../../store";
import { exportAllCacheData } from "../../lib/localCache";
import { buildAiContext } from "../../lib/aiPrivacy";
import { feedback, tap } from "../../lib/feedback";

/**
 * Privacy & Data — plain-language disclosure of where data lives and what
 * (little) ever leaves the phone, with export / erase controls.
 */
export function Privacy({ onBack }: { onBack: () => void }) {
  const store = useStore();
  const [aiOn, setAiOn] = useState(() => { try { return localStorage.getItem("livesync_ai_opt_in") !== "false"; } catch { return true; } });
  const [showAi, setShowAi] = useState(false);
  const [confirm, setConfirm] = useState<null | "device" | "cloud">(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cloudErasedAt, setCloudErasedAt] = useState(() => { try { return localStorage.getItem("livesync_cloud_erased_at"); } catch { return null; } });

  const counts = useMemo(() => [
    ["Transactions", store.transactions.length],
    ["Notes & reminders", store.notes.length],
    ["Budgets", store.budgets.length],
    ["Goals & buckets", store.goals.length + store.buckets.length],
    ["Assets & loans", store.assets.length + store.liabilities.length + store.structuredLoans.length + store.loans.length],
    ["Cards, SIPs, insurance", store.creditCards.length + store.sips.length + store.insurance.length],
  ] as Array<[string, number]>, [store]);

  const exportData = async () => {
    tap();
    setBusy("export");
    try {
      const data = await exportAllCacheData();
      const clean = Object.fromEntries(Object.entries(data).filter(([k]) => !k.startsWith("__")));
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), app: "LiveSync", data: clean }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `livesync-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      feedback({ kind: "success", title: "Export ready", subtitle: "Saved as a JSON file" });
    } finally {
      setBusy(null);
    }
  };

  const eraseDevice = async () => {
    setBusy("device");
    try {
      await store.deleteAllData();
      feedback({ kind: "success", title: "All data erased from this phone" });
    } catch {
      feedback({ kind: "error", title: "Couldn't erase data", subtitle: "Please try again" });
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const eraseCloud = async () => {
    setBusy("cloud");
    try {
      const n = await api.eraseCloudCopy();
      const at = new Date().toISOString();
      setCloudErasedAt(at);
      feedback({ kind: "success", title: "Old cloud copy erased", subtitle: n ? `${n} records removed from the server` : "Nothing was stored on the server" });
    } catch {
      feedback({ kind: "error", title: "Needs internet", subtitle: "Connect and try again" });
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const toggleAi = () => {
    tap();
    const v = !aiOn;
    setAiOn(v);
    try { localStorage.setItem("livesync_ai_opt_in", v ? "true" : "false"); } catch {}
  };

  return (
    <>
      <Header title="Privacy & data" subtitle="Your money data never leaves this phone" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-3 pb-28 space-y-4">
          {/* Hero */}
          <div className="rounded-2xl p-5 bg-emerald-50 border border-emerald-200/70 ls-rise">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-900"><Smartphone className="size-5 text-emerald-700" /> Stored only on this device</div>
            <p className="text-xs text-emerald-900/80 mt-2 leading-relaxed">
              Your transactions, notes, budgets, balances, loans and documents are saved in this phone's private app storage.
              They are not uploaded to LiveSync servers, and the LiveSync team has no way to see them.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {counts.map(([k, v]) => (
                <div key={k} className="bg-white rounded-xl px-3 py-2 border border-emerald-100">
                  <div className="text-[10px] text-emerald-800/70">{k}</div>
                  <div className="text-sm font-black text-emerald-950">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* What leaves the phone */}
          <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
            <div className="px-4 pt-4 pb-2 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">The only things that ever leave the phone</div>
            <Row icon={KeyRound} title="Sign-in" body="Your email and login session, to verify it's you. No financial data." tag="Always" />
            <Row icon={Brain} title="AI Coach (optional)" body="Only if you add an AI key and ask a question: rounded monthly totals by category — no names, dates, merchants or account numbers. Your typed question is scrubbed of phone numbers, emails, PAN and account numbers." tag={aiOn ? "On" : "Off"} action={<button onClick={() => setShowAi((v) => !v)} className="text-[11px] font-bold text-primary flex items-center gap-1 mt-1.5"><Eye className="size-3" /> {showAi ? "Hide" : "See exactly what is sent"}</button>} />
            {showAi && <pre className="mx-4 mb-3 max-h-56 overflow-auto text-[10px] leading-snug bg-[#0F172A] text-emerald-200 rounded-xl p-3 whitespace-pre-wrap">{JSON.stringify(buildAiContext(store.transactions as any), null, 2)}</pre>}
            <Row icon={Cloud} title="Google Drive backup (optional)" body="Only when you tap Back up — an encrypted file goes to your own Google Drive, not to us." tag="You choose" />
            <div className="px-4 py-3 bg-muted/40 text-[11px] text-muted-foreground flex items-start gap-2">
              <CloudOff className="size-3.5 mt-0.5 shrink-0" /> No analytics, no tracking, no ads. Reminders are scheduled on the phone itself.
            </div>
          </div>

          {/* AI switch */}
          <button onClick={toggleAi} className="w-full flex items-center gap-3 bg-card rounded-2xl border border-border/60 p-4 text-left">
            <Brain className="size-5 text-indigo-600" />
            <div className="flex-1">
              <div className="text-sm font-bold">Allow AI features</div>
              <div className="text-xs text-muted-foreground">Turn off to keep 100% of activity on the device.</div>
            </div>
            <span className={`w-11 h-6 rounded-full p-0.5 transition ${aiOn ? "bg-primary" : "bg-slate-300"}`}>
              <span className={`block size-5 rounded-full bg-white shadow transition-transform ${aiOn ? "translate-x-5" : ""}`} />
            </span>
          </button>

          {/* Important: device-only means backups matter */}
          <div className="rounded-2xl p-4 bg-amber-50 border border-amber-200/70 text-xs text-amber-900 leading-relaxed">
            <div className="font-bold mb-1 flex items-center gap-1.5"><HardDriveDownload className="size-4" /> Because data lives only here…</div>
            App updates never touch your data — it carries over automatically, with a second safety copy kept by Android. Uninstalling the app or tapping "Clear storage" in phone settings does delete it, so export a copy or use Google Drive backup before changing phones. Signing out keeps your data on this phone.
          </div>

          {/* Controls */}
          <div className="space-y-2">
            <Action icon={Download} label="Export my data (JSON)" sub="Everything stored on this phone" onClick={exportData} busy={busy === "export"} />
            <Action icon={CloudOff} label="Erase old cloud copy" sub={cloudErasedAt ? `Done on ${new Date(cloudErasedAt).toLocaleDateString("en-IN")}` : "Older app versions kept a server copy — remove it"} onClick={() => { tap(); setConfirm("cloud"); }} busy={busy === "cloud"} />
            <Action icon={Trash2} label="Erase all data on this phone" sub="Cannot be undone" danger onClick={() => { tap(); setConfirm("device"); }} busy={busy === "device"} />
          </div>

          <div className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1"><Lock className="size-3" /> LiveSync does not sell, share or view your data.</div>
        </div>
      </Screen>

      {confirm && (
        <div className="absolute inset-0 z-[70] flex items-end" onClick={() => !busy && setConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-8 ls-rise">
            <div className="flex items-center justify-between">
              <div className="text-base font-bold">{confirm === "device" ? "Erase everything on this phone?" : "Erase the old cloud copy?"}</div>
              <button onClick={() => setConfirm(null)} className="size-8 rounded-full bg-muted flex items-center justify-center"><X className="size-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {confirm === "device"
                ? "All transactions, notes, budgets, goals, loans and documents on this phone will be permanently deleted. Export first if you want a copy."
                : "Removes any of your records that earlier versions stored on our server. Data on this phone is not touched."}
            </p>
            <button
              onClick={confirm === "device" ? eraseDevice : eraseCloud}
              disabled={!!busy}
              className={`w-full mt-5 rounded-xl py-3.5 text-sm font-bold text-white flex items-center justify-center gap-2 ${confirm === "device" ? "bg-rose-600" : "bg-[#0F172A]"}`}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {confirm === "device" ? "Yes, erase this phone's data" : "Yes, erase cloud copy"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ icon: Icon, title, body, tag, action }: { icon: typeof Lock; title: string; body: string; tag: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-t border-border/60">
      <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="size-4" /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold">{title}</div>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
        {action}
      </div>
    </div>
  );
}

function Action({ icon: Icon, label, sub, onClick, busy, danger }: { icon: typeof Lock; label: string; sub: string; onClick: () => void; busy?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} className={`w-full flex items-center gap-3 p-4 rounded-2xl border text-left active:scale-[0.99] transition ${danger ? "bg-rose-50 border-rose-200" : "bg-card border-border/60"}`}>
      <Icon className={`size-5 ${danger ? "text-rose-600" : "text-slate-600"}`} />
      <div className="flex-1">
        <div className={`text-sm font-bold ${danger ? "text-rose-700" : ""}`}>{label}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
      {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </button>
  );
}
