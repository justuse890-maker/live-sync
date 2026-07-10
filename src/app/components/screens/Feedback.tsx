import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, MessageSquare, Bug, Lightbulb, ThumbsUp } from "lucide-react";
import { Screen } from "../Shell";
import { api } from "../../lib/api";

const KINDS = [
  { key: "issue", label: "Report an issue", icon: Bug, tint: "#EF4444" },
  { key: "idea", label: "Suggest an idea", icon: Lightbulb, tint: "#F59E0B" },
  { key: "praise", label: "Share what's working", icon: ThumbsUp, tint: "#10B981" },
] as const;

const SEVERITIES = ["low", "normal", "high"] as const;

type Entry = { id: string; createdAt: string; kind: string; severity: string; screen?: string; message: string; status: string };

export function Feedback({ onBack }: { onBack: () => void }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("issue");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("normal");
  const [message, setMessage] = useState("");
  const [screenWhere, setScreenWhere] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [history, setHistory] = useState<Entry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  async function load() {
    try {
      const items = await api.listFeedback();
      setHistory(items);
    } catch (e: any) {
      // Route may be 404 immediately after deploy — treat as empty history rather than scary error
      if (!String(e?.message || "").includes("404")) console.warn("Feedback load failed:", e);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await api.submitFeedback({ kind, severity, screen: screenWhere || undefined, message: message.trim() });
      setMessage("");
      setScreenWhere("");
      setSent(true);
      setTimeout(() => setSent(false), 2500);
      await load();
    } catch (e: any) {
      alert(`Could not send: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="px-5 pt-6 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="size-9 rounded-full bg-muted flex items-center justify-center"><ArrowLeft className="size-4" /></button>
        <div>
          <div className="text-base font-semibold">Send feedback</div>
          <div className="text-xs text-muted-foreground">Tell us what's broken, missing, or working well.</div>
        </div>
      </div>
      <Screen>
        <div className="px-5 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button
                type="button"
                key={k.key}
                onClick={() => setKind(k.key)}
                className={`p-3 rounded-xl border text-left transition ${kind === k.key ? "border-indigo-500 bg-indigo-500/10" : "border-border hover:bg-muted/40"}`}
              >
                <div className="size-8 rounded-lg flex items-center justify-center mb-1.5" style={{ background: k.tint + "20", color: k.tint }}>
                  <k.icon className="size-4" />
                </div>
                <div className="text-xs" style={{ fontWeight: 600 }}>{k.label}</div>
              </button>
            ))}
          </div>

          {kind === "issue" && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Severity</label>
              <div className="flex gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setSeverity(s)}
                    className={`flex-1 h-9 rounded-lg border text-xs capitalize ${severity === s ? "border-indigo-500 bg-indigo-500/10 text-foreground" : "border-border text-muted-foreground"}`}
                    style={{ fontWeight: 500 }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Where in the app? <span className="text-muted-foreground/70">(optional)</span></label>
            <input
              value={screenWhere}
              onChange={(e) => setScreenWhere(e.target.value)}
              placeholder="e.g. Transactions screen, Add expense modal"
              className="w-full bg-card border border-border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Describe it</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="What happened, what you expected, and what would help."
              className="w-full bg-card border border-border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
            />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!message.trim() || busy}
            className="w-full h-11 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : sent ? <Check className="size-4" /> : <MessageSquare className="size-4" />}
            {sent ? "Sent — thank you" : busy ? "Sending…" : "Send to LiveSync team"}
          </button>

          <div className="pt-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1" style={{ fontWeight: 600 }}>Your previous feedback</div>
            <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">
              {loadingHistory ? (
                <div className="p-4 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="size-3 animate-spin" /> Loading…</div>
              ) : history.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground">Nothing yet. Anything you send appears here with its status.</div>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="p-3.5 border-b border-border/60 last:border-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-xs capitalize" style={{ fontWeight: 600 }}>{h.kind} · {h.severity}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${h.status === "resolved" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>{h.status}</span>
                    </div>
                    <div className="text-sm">{h.message}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{new Date(h.createdAt).toLocaleString()}{h.screen ? ` · ${h.screen}` : ""}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Screen>
    </>
  );
}
