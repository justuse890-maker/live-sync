import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { Send, Loader2, Lock, Settings2 } from "lucide-react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { buildAiContext } from "../../lib/aiPrivacy";
import { aiReady, coachReply, loadAiConfig } from "../../lib/aiClient";
import { AiError, providerInfo } from "../../lib/byok";
import { answer, Mood, SUGGESTIONS } from "../../lib/sparrow";
import { buildObligations } from "../../lib/obligations";
import { Sparrow } from "../Sparrow";

type Msg = { role: "user" | "assistant"; text: string; source?: "phone" | "ai" };

const HELLO = "Hi, I'm Chiku. Ask me about your money — what happened last month, where it went, or whether you can afford something. I work it out from your own entries, right here on your phone.";

/**
 * Chiku the sparrow answers money questions.
 *  • Anything it can calculate (recaps, category totals, "can I afford") is answered on the phone — no AI, no network.
 *  • Open-ended questions go to the user's own AI provider, only if they connected one.
 */
export function Coach() {
  const store = useStore();
  const { transactions } = store;
  const navigate = useNavigate();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState<Mood>("idle");
  const [showPayload, setShowPayload] = useState(false);
  const connected = aiReady();
  const cfg = loadAiConfig();

  // Bills and EMIs still due before month end, for "can I afford …"
  const stillToPay = useMemo(() => {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return buildObligations(store as any, 31, 10)
      .filter((o) => o.amount && (o.overdue || o.dueAt <= monthEnd))
      .reduce((s, o) => s + (o.amount as number), 0);
  }, [store.notes, store.structuredLoans, store.subscriptions, store.creditCards, store.insurance, store.householdReminders, store.societyNotices, store.loans]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || loading) return;
    const history: Msg[] = [...msgs, { role: "user", text: question }];
    setMsgs(history);
    setInput("");
    setLoading(true);
    setMood("thinking");

    try {
      // 1. Try to work it out on the phone.
      const local = answer(question, { txs: transactions as any, stillToPay });
      if (local) {
        await new Promise((r) => setTimeout(r, 350)); // a beat, so the reply doesn't feel abrupt
        setMsgs((m) => [...m, { role: "assistant", text: local.text, source: "phone" }]);
        setMood(local.mood);
        return;
      }
      // 2. Otherwise the user's own AI, if they connected one.
      if (connected) {
        const reply = await coachReply(history.map(({ role, text }) => ({ role, text })), buildAiContext(transactions as any));
        setMsgs((m) => [...m, { role: "assistant", text: reply, source: "ai" }]);
        setMood("idle");
        return;
      }
      setMsgs((m) => [...m, { role: "assistant", source: "phone", text: "That one needs more than my sums. I can tell you what happened in a month, what you spent on something, what you saved, or whether you can afford an amount. For open questions, you can connect your own AI in settings (top right)." }]);
      setMood("idle");
    } catch (err: any) {
      const msg = err instanceof AiError ? err.message : err?.message || "Something went wrong.";
      const hint = err instanceof AiError && (err.kind === "invalid_key" || err.kind === "model_unavailable") ? " Open AI settings (top right) to fix it." : "";
      setMsgs((m) => [...m, { role: "assistant", text: `${msg}${hint}`, source: "ai" }]);
      setMood("concerned");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header
        title="Ask Chiku"
        subtitle="Your money sparrow"
        right={
          <button onClick={() => navigate("/ai-settings")} className="size-9 rounded-full hover:bg-muted flex items-center justify-center transition text-muted-foreground" title="AI settings" aria-label="AI settings">
            <Settings2 className="size-4" />
          </button>
        }
      />

      <Screen>
        <div className="px-5 pt-3 pb-40 space-y-3">
          {/* Mascot + what it does with your data */}
          <div className="flex items-end gap-3">
            <Sparrow mood={loading ? "thinking" : mood} size={84} />
            <div className="flex-1 bg-card border border-border/60 rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed">{HELLO}</div>
          </div>

          <button onClick={() => connected && setShowPayload((v) => !v)} className="w-full text-left flex items-start gap-2 bg-emerald-50 border border-emerald-200/80 rounded-xl px-3 py-2">
            <Lock className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span className="flex-1 text-[11px] text-emerald-900 font-medium">
              {connected
                ? <>Sums are done on your phone. Open questions go to {cfg ? providerInfo(cfg.provider).label : "your AI"} as rounded monthly totals only. <span className="underline">{showPayload ? "Hide" : "See what AI sees"}</span></>
                : <>Worked out on your phone. Nothing is sent anywhere.</>}
            </span>
          </button>
          {showPayload && connected && <pre className="max-h-44 overflow-auto text-[10px] leading-snug bg-muted rounded-xl p-3 whitespace-pre-wrap">{JSON.stringify(buildAiContext(transactions as any), null, 2)}</pre>}

          {msgs.length === 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-[11px] text-muted-foreground px-1 font-semibold uppercase tracking-wide">Try asking</div>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={loading} className="w-full text-left bg-card border border-border/60 rounded-xl px-4 py-3 text-sm active:scale-[0.99] disabled:opacity-50">{s}</button>
              ))}
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border/60 rounded-bl-sm"}`}>
                {m.text}
                {m.role === "assistant" && m.source && <div className="mt-1.5 text-[10px] text-muted-foreground">{m.source === "phone" ? "Worked out on your phone" : "From your own AI · general information, not advice"}</div>}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border/60 rounded-2xl rounded-bl-sm px-4 py-3 text-sm flex items-center gap-2 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Chiku is working it out…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </Screen>

      {/* Input bar */}
      <div className="absolute bottom-[88px] inset-x-0 px-5 pb-2">
        <div className="bg-card border border-border rounded-2xl p-2 flex items-center gap-2 shadow-lg shadow-slate-200/50">
          <input
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
            placeholder="Ask about your money…"
            aria-label="Ask Chiku about your money"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-50"
          />
          <button onClick={() => send(input)} disabled={loading || !input.trim()} aria-label="Send" className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </div>
    </>
  );
}
