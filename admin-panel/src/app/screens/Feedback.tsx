import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Check } from "lucide-react";
import { adminApi } from "../../lib/adminApi";

type FB = Awaited<ReturnType<typeof adminApi.feedback>>[number];

export function AdminFeedback() {
  const [items, setItems] = useState<FB[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");

  async function load() {
    setBusy(true);
    try { setItems(await adminApi.feedback()); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);

  async function resolve(it: FB, status: "open" | "resolved") {
    try { await adminApi.setFeedbackStatus(it.userId, it.id, status); await load(); }
    catch (e: any) { alert(e.message); }
  }

  const visible = items.filter((i) => filter === "all" || i.status === filter);
  const counts = {
    open: items.filter((i) => i.status === "open").length,
    resolved: items.filter((i) => i.status === "resolved").length,
  };

  if (err) return <div className="text-rose-400 text-sm">Failed: {err}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold flex items-center gap-2"><MessageSquare className="size-5 text-indigo-400" /> User feedback</div>
          <div className="text-xs text-slate-500 mt-0.5">Issues, ideas, and praise submitted from the in-app feedback form.</div>
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
          {(["open", "resolved", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded ${filter === f ? "bg-indigo-500/20 text-indigo-200" : "text-slate-400 hover:text-slate-200"}`}>
              {f} {f !== "all" && `(${counts[f as "open" | "resolved"]})`}
            </button>
          ))}
        </div>
      </div>

      {busy && items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="size-4 animate-spin" /> Loading…</div>
      ) : visible.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-sm text-slate-500">Nothing here.</div>
      ) : (
        <div className="space-y-3">
          {visible.map((it) => (
            <div key={it.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full capitalize bg-slate-800 text-slate-300">{it.kind}</span>
                    {it.kind === "issue" && (
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${it.severity === "high" ? "bg-rose-500/15 text-rose-300" : it.severity === "low" ? "bg-slate-800 text-slate-400" : "bg-amber-500/15 text-amber-300"}`}>{it.severity}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${it.status === "resolved" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"}`}>{it.status}</span>
                    {it.screen && <span className="text-xs text-slate-500">on {it.screen}</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">{it.userName || it.userEmail || it.userId} · {new Date(it.createdAt).toLocaleString()}</div>
                </div>
                {it.status === "open" ? (
                  <button onClick={() => resolve(it, "resolved")} className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 inline-flex items-center gap-1 shrink-0">
                    <Check className="size-3" /> Resolve
                  </button>
                ) : (
                  <button onClick={() => resolve(it, "open")} className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 shrink-0">Reopen</button>
                )}
              </div>
              <div className="text-sm text-slate-100 whitespace-pre-wrap">{it.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
