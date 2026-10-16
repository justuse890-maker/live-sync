import { useMemo, useState } from "react";
import { Check, Eye, EyeOff, ExternalLink, Key, Loader2, Lock, ShieldOff, Sparkles } from "lucide-react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { buildAiContext } from "../../lib/aiPrivacy";
import { AiConfig, AiError, PROVIDERS, Provider, keyWarning, providerInfo, validateConfig } from "../../lib/byok";
import { askAi, clearAiConfig, consentRecord, loadAiConfig, recordConsent, saveAiConfig } from "../../lib/aiClient";

const field = "w-full h-11 rounded-xl border border-border bg-background px-3 text-sm";

export function AiSettings({ onBack }: { onBack: () => void }) {
  const { transactions } = useStore();
  const existing = loadAiConfig();
  const [provider, setProvider] = useState<Provider>(existing?.provider ?? "gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(existing?.model ?? providerInfo(existing?.provider ?? "gemini").model);
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? "");
  const [show, setShow] = useState(false);
  const [agreed, setAgreed] = useState(!!consentRecord());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [connected, setConnected] = useState<AiConfig | null>(existing && consentRecord() ? existing : null);
  const [showPayload, setShowPayload] = useState(false);
  const [editing, setEditing] = useState(!existing);

  const info = providerInfo(provider);
  const draft: AiConfig = { provider, apiKey: apiKey || (existing && existing.provider === provider ? existing.apiKey : ""), model: model.trim(), baseUrl: provider === "custom" ? baseUrl.trim() : undefined };
  const warn = apiKey ? keyWarning(draft) : null;
  const payload = useMemo(() => JSON.stringify(buildAiContext(transactions as any), null, 2), [transactions]);

  const pick = (p: Provider) => { setProvider(p); setModel(providerInfo(p).model); setMsg(null); if (p !== existing?.provider) setApiKey(""); };

  const saveAndTest = async () => {
    const problem = validateConfig(draft);
    if (problem) { setMsg({ ok: false, text: problem }); return; }
    if (!agreed) { setMsg({ ok: false, text: "Please read and accept the terms first." }); return; }
    setBusy(true); setMsg(null);
    try {
      await askAi(draft, { messages: [{ role: "user", content: "Reply with the single word OK." }], maxTokens: 10, temperature: 0 });
      saveAiConfig(draft);
      recordConsent();
      setConnected(draft); setApiKey(""); setEditing(false);
      setMsg({ ok: true, text: "Connected. Your key is saved on this phone only." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof AiError ? e.message : "Couldn't connect. Check the key and try again." });
    } finally { setBusy(false); }
  };

  const remove = () => {
    clearAiConfig();
    setConnected(null); setApiKey(""); setAgreed(false); setEditing(true); setMsg({ ok: true, text: "Key and consent removed from this phone." });
  };

  return (
    <>
      <Header title="AI Assistant" subtitle="Optional · your own key" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 pb-28 space-y-4">
          <div className="rounded-2xl bg-card border border-emerald-200 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Lock className="size-4 text-emerald-600" /> LiveSync doesn’t provide AI</div>
            <p className="text-xs text-slate-600 leading-relaxed">Everything in the app works without it. If you want a coach or smart clean-up, you connect an AI service <b>you</b> have an account with. Requests go from your phone straight to that provider. We never see your key or your questions.</p>
          </div>

          {connected && !editing && (
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-700"><Check className="size-4" /> Connected</div>
              <div className="text-xs text-slate-600">{providerInfo(connected.provider).label} · {connected.model}{connected.baseUrl ? ` · ${connected.baseUrl}` : ""}</div>
              <div className="text-[11px] text-muted-foreground">Key: ••••{connected.apiKey.slice(-4)} · accepted terms {consentRecord() ? new Date(consentRecord()!.at).toLocaleDateString("en-IN") : ""}</div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)} className="flex-1 h-10 rounded-xl border text-xs font-bold">Change</button>
                <button onClick={remove} className="flex-1 h-10 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5"><ShieldOff className="size-3.5" /> Remove key</button>
              </div>
            </div>
          )}

          {editing && (
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3.5">
              <div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">Provider</div>
                <div className="flex flex-wrap gap-1.5">
                  {PROVIDERS.map((p) => (
                    <button key={p.id} onClick={() => pick(p.id)} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${provider === p.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{p.label}</button>
                  ))}
                </div>
                {info.getKeyUrl && <a href={info.getKeyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary font-semibold mt-2">Get a key from {info.label} <ExternalLink className="size-3" /></a>}
              </div>

              {provider === "custom" && (
                <div><div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Endpoint (https)</div><input className={field} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" /></div>
              )}

              <div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">API key</div>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input className={`${field} pl-9 pr-10 font-mono`} type={show ? "text" : "password"} autoComplete="off" spellCheck={false} value={apiKey} onChange={(e) => { setApiKey(e.target.value); setMsg(null); }} placeholder={existing && existing.provider === provider ? "Leave blank to keep the saved key" : info.keyHint} />
                  <button onClick={() => setShow((v) => !v)} aria-label={show ? "Hide key" : "Show key"} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                </div>
                {warn && <div className="text-[11px] text-amber-700 mt-1">{warn}</div>}
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Model</div>
                <input className={field} value={model} onChange={(e) => setModel(e.target.value)} placeholder={provider === "custom" ? "e.g. meta-llama/llama-3.3-70b-instruct" : info.model} />
                <div className="text-[10px] text-muted-foreground mt-1">Providers retire models now and then. If one stops working, type a current model name here.</div>
              </div>

              <button onClick={() => setShowPayload((v) => !v)} className="w-full text-left flex items-start gap-2 bg-emerald-50 border border-emerald-200/80 rounded-xl px-3 py-2">
                <Lock className="size-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="flex-1 text-[11px] text-emerald-900 font-medium">Only rounded monthly totals are shared — no names, dates, merchants or account numbers. <span className="underline">{showPayload ? "Hide" : "See exactly what AI sees"}</span></span>
              </button>
              {showPayload && <pre className="max-h-44 overflow-auto text-[10px] leading-snug bg-muted rounded-xl p-3 whitespace-pre-wrap">{payload}</pre>}

              <label className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 shrink-0" />
                <span className="text-[11px] text-slate-600 leading-relaxed">
                  <b className="text-slate-900 block text-xs mb-0.5">I understand and agree</b>
                  • Summaries of my money (rounded monthly totals) are sent to <b>{info.label}</b> using <b>my own</b> API key. If I use import clean-up, the merchant names in my file are sent too, with numbers and IDs removed.<br />
                  • My use of that service is under its own terms, and any charges are billed to me by them, not by LiveSync.<br />
                  • LiveSync does not run, monitor or store this AI. Replies are general information, not financial, tax or legal advice, and may be wrong.<br />
                  • I can remove the key and this consent at any time.
                </span>
              </label>

              <button onClick={saveAndTest} disabled={busy} className="w-full h-12 rounded-xl bg-[#1E3A8A] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Test and save
              </button>
              {existing && <button onClick={() => { setEditing(false); setApiKey(""); setMsg(null); }} className="w-full text-xs text-muted-foreground py-1">Cancel</button>}
            </div>
          )}

          {msg && <div className={`text-xs rounded-xl px-3 py-2.5 border ${msg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>{msg.text}</div>}
        </div>
      </Screen>
    </>
  );
}
