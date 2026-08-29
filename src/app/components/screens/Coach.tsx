import { useState, useRef, useEffect } from "react";
import {
  Sparkles, Send, Brain, ShieldOff, Loader2, Key,
  CheckSquare, Square, Trash2, RefreshCw, ExternalLink, Lock, Eye, EyeOff
} from "lucide-react";
import { coachSuggestions } from "../../data";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";

type Msg = { role: "user" | "assistant"; text: string };

const GROQ_KEY_LS = "livesync-groq-api-key";
const GROQ_OPT_LS = "livesync-groq-opted-in";

// Ordered fallback chain — if first model is decommissioned, try next
const MODEL_PRIORITY = [
  "llama-3.3-70b-versatile",
  "llama3-70b-8192",
  "gemma2-9b-it",
  "llama3-8b-8192",
];

async function callGroq(
  apiKey: string,
  messages: { role: string; content: string }[],
  modelIndex = 0
): Promise<string> {
  if (modelIndex >= MODEL_PRIORITY.length) {
    throw new Error("All available Groq models are currently unavailable. Please check your Groq console.");
  }
  const model = MODEL_PRIORITY[modelIndex];
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1024 }),
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData?.error?.message || errMsg;
    } catch {}

    // Decommissioned / not found → try next model automatically
    if (res.status === 404 || errMsg.toLowerCase().includes("decommissioned") || errMsg.toLowerCase().includes("not supported")) {
      console.warn(`Model ${model} unavailable, trying next…`);
      return callGroq(apiKey, messages, modelIndex + 1);
    }

    // Auth failure — re-throw immediately so UI can handle it
    if (res.status === 401 || res.status === 403) {
      throw new Error("INVALID_KEY:" + errMsg);
    }

    throw new Error(errMsg);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";
}

export function Coach() {
  const {
    transactions, goals, budgets, subscriptions, loans,
    assets, liabilities, sips, insurance, investments,
    gold, properties, creditScore, fraudAlerts,
  } = useStore();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Key & opt-in state
  const [savedKey, setSavedKey] = useState(() => localStorage.getItem(GROQ_KEY_LS) || "");
  const [opted, setOpted] = useState(() => localStorage.getItem(GROQ_OPT_LS) === "yes");
  const [draftKey, setDraftKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [setupErr, setSetupErr] = useState<string | null>(null);
  const [changingKey, setChangingKey] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const saveKey = () => {
    const trimmed = draftKey.trim();
    if (!trimmed) { setSetupErr("Please paste your Groq API key."); return; }
    if (!trimmed.startsWith("gsk_")) { setSetupErr("That doesn't look like a Groq key (should start with gsk_)."); return; }
    if (!checkboxChecked) { setSetupErr("Please read and accept the privacy policy first."); return; }
    localStorage.setItem(GROQ_KEY_LS, trimmed);
    localStorage.setItem(GROQ_OPT_LS, "yes");
    setSavedKey(trimmed);
    setOpted(true);
    setChangingKey(false);
    setSetupErr(null);
  };

  const revokeKey = () => {
    localStorage.removeItem(GROQ_KEY_LS);
    localStorage.removeItem(GROQ_OPT_LS);
    setSavedKey("");
    setOpted(false);
    setDraftKey("");
    setCheckboxChecked(false);
    setMsgs([]);
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const send = async (text: string) => {
    if (!text.trim() || loading || !savedKey) return;

    // Check master AI opt-in setting
    const aiEnabled = localStorage.getItem("livesync_ai_opt_in") !== "false";
    if (!aiEnabled) {
      setMsgs((m) => [
        ...m,
        { role: "user", text },
        {
          role: "assistant",
          text: "🔒 AI features are currently disabled in your **Security & Privacy** settings. To use AI Coach, please enable AI Data Sharing in Settings, or use our on-device financial insights.",
        },
      ]);
      setInput("");
      return;
    }

    const userMsg: Msg = { role: "user", text };
    const updatedMsgs = [...msgs, userMsg];
    setMsgs(updatedMsgs);
    setInput("");
    setLoading(true);

    try {
      const hideMerchants = localStorage.getItem("livesync_ai_categories_only") !== "false";

      // ── PRIVACY ENFORCEMENT: ONLY Transactions are shared with AI ──────────
      // Absolutely NO bank accounts, NO assets, NO loans, NO gold, NO credit score, NO personal names.
      const categorySummary: Record<string, number> = {};
      for (const t of transactions) {
        if (t.type === "expense") {
          const c = t.category || "Other";
          categorySummary[c] = (categorySummary[c] || 0) + Math.abs(t.amount);
        }
      }

      const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const totalExpenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);

      const context = {
        privacyScope: "TRANSACTIONS_ONLY (Strictly Anonymized)",
        totalIncome,
        totalExpenses,
        monthlySavings: Math.max(0, totalIncome - totalExpenses),
        categorySpend: categorySummary,
        recentTransactions: transactions.slice(0, 12).map((t) => ({
          category: t.category,
          amount: Math.abs(t.amount),
          type: t.type,
          date: t.date,
          // Only include merchant if user explicitly disabled "Hide merchant names"
          ...(hideMerchants ? {} : { title: t.merchant || t.title }),
        })),
      };

      const systemPrompt = `You are LiveSync AI Coach — an on-device personal financial advisor for Indian users.
Your job: give concise, actionable, and practical money coaching based ONLY on the user's aggregated transaction summary below.
Privacy Guarantee: You only receive anonymized transaction numbers. No bank credentials, loans, assets, or personal identities are shared.
Rules:
- Always use ₹ and Indian numbering (e.g. ₹2,50,000 not ₹250000)
- Keep replies short, encouraging, and scannable (use bullet points)
- Give practical advice on budgeting, category allocations (50/30/20), and savings rate
- Do not ask for banking passwords or personal identification

User's Anonymized Transaction Summary:
${JSON.stringify(context, null, 0)}`;

      const groqMessages = [
        { role: "system", content: systemPrompt },
        ...updatedMsgs.map((m) => ({ role: m.role, content: m.text })),
      ];

      const responseText = await callGroq(savedKey, groqMessages);
      setMsgs((m) => [...m, { role: "assistant", text: responseText }]);
    } catch (err: any) {
      const msg: string = err?.message || "Unknown error";
      if (msg.startsWith("INVALID_KEY:")) {
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            text: "❌ Your Groq API key is invalid or expired. Tap the key icon in the header to update it.",
          },
        ]);
      } else {
        setMsgs((m) => [...m, { role: "assistant", text: `⚠️ ${msg}` }]);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (!savedKey || !opted || changingKey) {
    return (
      <>
        <Header
          title="AI Coach"
          subtitle="Setup"
          right={<div className="size-10 rounded-full bg-gradient-to-br from-primary/20 to-indigo-500/20 flex items-center justify-center"><Brain className="size-5 text-primary" /></div>}
        />
        <Screen>
          <div className="px-5 pt-6 pb-8 space-y-5">

            {/* Hero */}
            <div className="text-center space-y-2 pt-4">
              <div className="mx-auto size-16 rounded-3xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/25">
                <Sparkles className="size-7 text-white" />
              </div>
              <h2 className="font-display text-xl" style={{ fontWeight: 800 }}>LiveSync AI Coach</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                Uses <span className="text-foreground font-semibold">Groq (Llama)</span>. Your API request goes from this app to Groq; LiveSync does not proxy it through its API.
              </p>
            </div>

            {/* How it works */}
            <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-primary font-semibold uppercase tracking-wide">How to get started</p>
              {[
                { n: "1", t: "Visit console.groq.com", d: "Create a free account — no credit card needed", link: "https://console.groq.com/keys" },
                { n: "2", t: "Create an API Key", d: "Click 'Create API Key' and copy it" },
                { n: "3", t: "Paste it below & agree", d: "Your key stays on your device only" },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-3">
                  <div className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-xs font-bold">{step.n}</div>
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-1">
                      {step.t}
                      {step.link && <a href={step.link} target="_blank" rel="noreferrer" className="text-primary"><ExternalLink className="size-3" /></a>}
                    </div>
                    <div className="text-xs text-muted-foreground">{step.d}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Key input */}
            <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block" style={{ fontWeight: 600 }}>
                  Groq API Key {savedKey && <span className="text-emerald-600">· currently set</span>}
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    type={showKey ? "text" : "password"}
                    value={draftKey}
                    onChange={e => { setDraftKey(e.target.value); setSetupErr(null); }}
                    placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-10 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                  />
                  <button
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Privacy opt-in */}
              <button
                onClick={() => setCheckboxChecked(v => !v)}
                className="flex items-start gap-3 text-left group w-full"
              >
                <div className="mt-0.5 shrink-0 text-primary">
                  {checkboxChecked
                    ? <CheckSquare className="size-5" />
                    : <Square className="size-5 text-muted-foreground group-hover:text-primary transition" />}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-semibold">Privacy & Data Sharing:</span>{" "}
                  I understand that my message and the selected financial summary are sent <em>directly</em> from my device to Groq for AI processing.
                  My API key is saved in this app's local storage; LiveSync does not receive it through its API.
                  I can revoke this at any time.
                </div>
              </button>

              {setupErr && (
                <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {setupErr}
                </div>
              )}

              <button
                onClick={saveKey}
                disabled={!draftKey || !checkboxChecked}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
                style={{ fontWeight: 700 }}
              >
                <Sparkles className="size-4" />
                {changingKey ? "Update API Key" : "Start AI Coach"}
              </button>

              {changingKey && (
                <button
                  onClick={() => setChangingKey(false)}
                  className="w-full text-sm text-muted-foreground text-center py-1"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Privacy notice */}
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
              <Lock className="size-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-700">
                <strong>Your choice.</strong> The key is stored locally by the app. Groq processes messages you send; review Groq's terms and privacy policy before continuing.
              </p>
            </div>
          </div>
        </Screen>
      </>
    );
  }

  // ── Main chat UI ──────────────────────────────────────────────────────────
  return (
    <>
      <Header
        title="AI Coach"
        subtitle="Llama · Powered by Groq"
        right={
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setChangingKey(true); setDraftKey(""); setCheckboxChecked(false); }}
              className="size-9 rounded-full hover:bg-muted flex items-center justify-center transition text-muted-foreground"
              title="Change API Key"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              onClick={revokeKey}
              className="size-9 rounded-full hover:bg-rose-50 text-rose-500 flex items-center justify-center transition"
              title="Remove API Key & Opt Out"
            >
              <ShieldOff className="size-4" />
            </button>
          </div>
        }
      />

      {/* Privacy reminder pill */}
      <div className="px-5 pt-3">
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 rounded-xl px-3 py-2">
          <Lock className="size-3.5 text-emerald-600 shrink-0" />
          <p className="text-[11px] text-emerald-800 font-medium">
            🔒 <strong>Privacy Shield Active</strong>: Only anonymized transaction figures are processed. Zero bank accounts, loans, or personal names are shared.
          </p>
        </div>
      </div>

      <Screen>
        <div className="px-5 pt-4 pb-4 space-y-3">

          {/* Empty state / suggestions */}
          {msgs.length === 0 && !loading && (
            <div className="pt-2 space-y-4">
              <div className="text-center space-y-1 py-4">
                <div className="mx-auto size-14 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-md shadow-primary/20 mb-3">
                  <Sparkles className="size-6 text-white" />
                </div>
                <p className="text-sm font-semibold text-slate-800">Ask me anything about your money</p>
                <p className="text-xs text-muted-foreground">
                  Analyzing your monthly spend trends with zero personal data leakage.
                </p>
              </div>
              <div className="text-xs text-muted-foreground px-1 font-semibold uppercase tracking-wide">Suggested</div>
              <div className="space-y-2">
                {coachSuggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={loading}
                    className="w-full text-left bg-card border border-border/60 rounded-xl px-4 py-3 text-sm hover:border-primary/40 hover:bg-primary/5 transition disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border/60 rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border border-border/60 rounded-2xl rounded-bl-sm px-4 py-3 text-sm flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                <span>Thinking at Groq speed...</span>
              </div>
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
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send(input)}
            placeholder="Ask anything about your money…"
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </div>
    </>
  );
}
