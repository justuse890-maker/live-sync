import { useEffect, useState } from "react";
import { Sparkles, Send, Mic, Brain, EyeOff, ShieldOff } from "lucide-react";
import { coachInitial, coachSuggestions } from "../../data";
import { Header, Screen } from "../Shell";
import { api } from "../../lib/api";

type Msg = { role: "user" | "assistant"; text: string };

type Prefs = { aiOptIn: boolean; aiShareCategoriesOnly: boolean };
const DEFAULT_PREFS: Prefs = { aiOptIn: true, aiShareCategoriesOnly: true };

const cannedReplies: Record<string, string> = {
  default: "Based on your current cash flow and savings rate of 35%, you're in a solid position. I'd recommend redirecting the ₹1,675 from {{merchant:Adobe CC}} (which you haven't used in 45 days) into your emergency fund. Want me to draft a cancellation request?",
  afford: "At ₹120k income and ₹78k expenses, you have ~₹42k of monthly slack. A ₹70k phone on a 6-month EMI (~₹12k/mo) would cut your savings rate from 35% to 25%. Doable, but it pushes your Goa goal back 6 weeks. My take: wait a month and pay in full.",
  save: "Three quick wins: (1) cancel {{merchant:Adobe CC}} → ₹1,675/mo, (2) trim dining from ₹6,400 → ₹4,500/mo, (3) cancel duplicate {{merchant:Disney+ Hotstar}} → ₹299/mo. Total: ₹3,874/mo extra, or ~₹46k/year.",
  overspending: "Dining is up 42% this month — ₹6,400 vs your usual ₹4,500. 60% of it was on weekends. Try a ₹4,500 weekend cap and you'll be back on track by end of month.",
};

function redact(text: string, hideMerchants: boolean) {
  return text.replace(/\{\{merchant:([^}]+)\}\}/g, (_, name) => hideMerchants ? "a subscription" : name);
}

function reply(q: string, prefs: Prefs) {
  const lower = q.toLowerCase();
  let raw: string;
  if (lower.includes("afford") || lower.includes("phone") || lower.includes("car")) raw = cannedReplies.afford;
  else if (lower.includes("save")) raw = cannedReplies.save;
  else if (lower.includes("overspend") || lower.includes("why")) raw = cannedReplies.overspending;
  else raw = cannedReplies.default;
  return redact(raw, prefs.aiShareCategoriesOnly);
}

export function Coach() {
  const [msgs, setMsgs] = useState<Msg[]>(coachInitial);
  const [input, setInput] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    (async () => {
      try {
        const items = await api.list<Prefs & { id: string }>("settings");
        const found = items.find((x) => x.id === "preferences");
        if (found) setPrefs({ aiOptIn: found.aiOptIn ?? true, aiShareCategoriesOnly: found.aiShareCategoriesOnly ?? true });
      } catch (e) {
        console.error("Coach: failed to load AI prefs:", e);
      }
    })();
  }, []);

  const send = (text: string) => {
    if (!text.trim()) return;
    if (!prefs.aiOptIn) {
      setMsgs((m) => [...m, { role: "user", text }, { role: "assistant", text: "AI Coach is turned off. Enable it in Security → AI data sharing to get personalised insights." }]);
    } else {
      setMsgs((m) => [...m, { role: "user", text }, { role: "assistant", text: reply(text, prefs) }]);
    }
    setInput("");
  };

  if (!prefs.aiOptIn) {
    return (
      <>
        <Header title="AI Coach" subtitle="Disabled" right={<div className="size-10 rounded-full bg-muted flex items-center justify-center"><ShieldOff className="size-5 text-muted-foreground" /></div>} />
        <Screen>
          <div className="px-5 pt-10 text-center">
            <div className="mx-auto size-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Brain className="size-6 text-muted-foreground" />
            </div>
            <div className="font-display mb-2" style={{ fontSize: 18, fontWeight: 700 }}>AI Coach is off</div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              You've opted out of AI insights. Your data isn't sent to any AI model. Re-enable it any time from Profile → Security &amp; Privacy.
            </p>
          </div>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Header
        title="AI Coach"
        subtitle={prefs.aiShareCategoriesOnly ? "Privacy mode · categories only" : "Always here"}
        right={
          <div className="size-10 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center">
            <Sparkles className="size-5 text-white" />
          </div>
        }
      />
      <Screen>
        <div className="px-5 pt-4 space-y-3">
          {prefs.aiShareCategoriesOnly && (
            <div className="rounded-xl bg-muted/60 border border-border/60 px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
              <EyeOff className="size-3.5" />
              Merchant names are hidden from AI. Only categories and totals are shared.
            </div>
          )}

          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border/60 rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {msgs.length <= 1 && (
            <div className="pt-4">
              <div className="text-xs text-muted-foreground mb-2 px-1" style={{ fontWeight: 600 }}>SUGGESTED</div>
              <div className="space-y-2">
                {coachSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left bg-card border border-border/60 rounded-xl px-4 py-3 text-sm hover:border-primary/40 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Screen>

      <div className="absolute bottom-[88px] inset-x-0 px-5 pb-2">
        <div className="bg-card border border-border rounded-2xl p-2 flex items-center gap-2 shadow-lg shadow-slate-200/50">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask anything about your money..."
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          />
          <button className="size-9 rounded-xl flex items-center justify-center text-muted-foreground">
            <Mic className="size-4" />
          </button>
          <button onClick={() => send(input)} className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </>
  );
}
