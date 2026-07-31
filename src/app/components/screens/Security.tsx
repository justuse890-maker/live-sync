import { useEffect, useState } from "react";
import { Shield, Fingerprint, Download, Trash2, Brain, Eye, EyeOff, Server, AlertTriangle, Loader2, CheckCircle2, Globe } from "lucide-react";
import { Header, Screen } from "../Shell";
import { api, supabase } from "../../lib/api";
import { registerBiometric, clearBiometric, platformAuthenticatorAvailable, isWebAuthnSupported } from "../../lib/webauthn";
import { COUNTRY_OPTIONS, CountryCode, TAX_PACKS } from "../../lib/taxPacks";
import { useCountry } from "../../lib/useCountry";
import { useHasFeature } from "../../lib/useEntitlements";
import { projectId, publicAnonKey } from "../../../../utils/supabase/info";

type Settings = {
  id: string;
  biometric: boolean;
  aiOptIn: boolean;
  aiShareCategoriesOnly: boolean;
  marketingOptIn: boolean;
};

const DEFAULTS: Settings = {
  id: "preferences",
  biometric: false,
  aiOptIn: true,
  aiShareCategoriesOnly: true,
  marketingOptIn: false,
};

export function Security({ onBack }: { onBack: () => void }) {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const [bioErr, setBioErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const items = await api.list<Settings>("settings");
        const found = items.find((x) => x.id === "preferences");
        if (found) setS({ ...DEFAULTS, ...found });
      } catch (e) {
        console.error("Load settings failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    setS(next);
    try {
      await api.create<Settings>("settings", next);
    } catch (e) {
      console.error("Save settings failed:", e);
    }
  };

  const setupBiometric = async () => {
    setBioErr(null);
    if (s.biometric) {
      clearBiometric();
      update({ biometric: false });
      return;
    }
    if (!isWebAuthnSupported()) {
      setBioErr("This browser doesn't support WebAuthn.");
      return;
    }
    const platformOk = await platformAuthenticatorAvailable();
    if (!platformOk) {
      setBioErr("No platform authenticator found (Face ID / Touch ID / Windows Hello / Android biometrics).");
      return;
    }
    setBioBusy(true);
    try {
      const session = await api.session();
      const uid = session?.user?.id || "anonymous";
      const email = session?.user?.email || "user@livesync.app";
      await registerBiometric(uid, email);
      await update({ biometric: true });
    } catch (e: any) {
      console.error("Biometric registration failed:", e);
      setBioErr(e.message || "Biometric setup failed");
    } finally {
      setBioBusy(false);
    }
  };

  const exportData = async () => {
    try {
      const [tx, loans, goals, docs] = await Promise.all([
        api.list("transactions"), api.list("loans"), api.list("goals"), api.list("documents"),
      ]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), transactions: tx, loans, goals, documents: docs }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `livesync-export-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
    }
  };

  const deleteAccount = async () => {
    try {
      await api.deleteAccount();
      await api.signout();
      window.location.reload();
    } catch (e: any) {
      console.error("Delete account failed:", e);
      alert(e.message || "Could not delete account");
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Security" showBack onBack={onBack} />
        <Screen><div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div></Screen>
      </>
    );
  }

  return (
    <>
      <Header title="Security & Privacy" subtitle="Your data protection settings" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-5">
            <div className="flex items-center gap-2">
              <Shield className="size-5" />
              <div className="text-sm" style={{ fontWeight: 700 }}>Cloud security</div>
            </div>
            <p className="text-xs text-white/80 mt-2 leading-relaxed">
              TLS 1.3 encryption in transit, AES-256 encryption at rest (Supabase platform-level). All data is user-isolated via authenticated API access. You can export or delete your data at any time.
            </p>
          </div>

          <CountrySection />

          <Section title="Account access">
            <Toggle icon={bioBusy ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />} label="Biometric unlock" sub={bioErr || (s.biometric ? "Passkey registered on this device" : "WebAuthn / device passkey")} value={s.biometric} onChange={setupBiometric} />
          </Section>

          <Section title="AI data sharing">
            <div className="p-4 border-b border-border/60">
              <div className="flex items-center gap-2 mb-1.5" style={{ fontWeight: 700 }}>
                <Brain className="size-4 text-primary" />
                <span className="text-sm">How we use AI</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                LiveSync uses AI to generate insights, coaching tips and category suggestions. We process the <span className="text-foreground" style={{ fontWeight: 600 }}>minimum data necessary</span>, with strict redaction.
              </p>
            </div>
            <SharingRow ok label="Aggregated category totals (e.g. ₹4,200 on Food this week)" />
            <SharingRow ok label="Goal progress, budget utilisation, runway months" />
            <SharingRow ok={s.aiShareCategoriesOnly ? false : true} label="Individual transaction merchants (e.g. 'Swiggy', 'BigBasket')" warn={!s.aiShareCategoriesOnly} />
            <SharingRow ok={false} label="Bank account numbers, balances, PAN / Aadhaar — NEVER shared" never />
            <SharingRow ok={false} label="Documents in your vault — NEVER shared" never />
            <div className="p-3 border-t border-border/60 space-y-3">
              <Toggle icon={<Brain className="size-4" />} label="AI Coach insights" sub="Personalised tips on spending & goals" value={s.aiOptIn} onChange={() => update({ aiOptIn: !s.aiOptIn })} flat />
              <Toggle icon={s.aiShareCategoriesOnly ? <EyeOff className="size-4" /> : <Eye className="size-4" />} label="Hide merchant names from AI" sub="Send only categories, not individual shops" value={s.aiShareCategoriesOnly} onChange={() => update({ aiShareCategoriesOnly: !s.aiShareCategoriesOnly })} flat />
            </div>
            <div className="p-3 bg-muted/40 border-t border-border/60 text-[11px] text-muted-foreground leading-relaxed">
              <div className="flex items-center gap-1.5 mb-1 text-foreground" style={{ fontWeight: 600 }}>
                <Server className="size-3" /> How AI works
              </div>
              Server-side AI features use Google Gemini. Bring-your-own-key mode uses Groq (Llama). AI prompts are not stored after processing. No data is used to train third-party models.
            </div>
          </Section>

          <Section title="Your data">
            <ActionRow icon={<Download className="size-4" />} label="Export all my data" sub="JSON of transactions, loans, goals, documents" onClick={exportData} />
            <ActionRow icon={<Trash2 className="size-4" />} label="Delete my account & data" sub="Irreversible — auth, records, vault files" danger onClick={() => setConfirmDelete(true)} />
          </Section>

          <div className="bg-card rounded-2xl p-4 border border-border/60 text-xs text-muted-foreground leading-relaxed">
            <div className="flex items-center gap-2 text-foreground mb-2" style={{ fontWeight: 700 }}>
              <Shield className="size-3.5 text-primary" /> Support
            </div>
            For privacy concerns, email <span className="text-foreground">privacy@livesync.app</span>. We respond within 7 business days.
          </div>
        </div>
      </Screen>

      {confirmDelete && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => setConfirmDelete(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-8">
            <div className="flex items-center gap-2 mb-2 text-rose-600" style={{ fontWeight: 700 }}>
              <AlertTriangle className="size-4" /> Permanently delete account?
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              This erases your transactions, loans, goals, documents, and sign-in credentials. Deletion completes immediately. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 bg-muted rounded-xl py-3 text-sm" style={{ fontWeight: 600 }}>Cancel</button>
              <button onClick={deleteAccount} className="flex-1 bg-rose-600 text-white rounded-xl py-3 text-sm" style={{ fontWeight: 700 }}>Delete forever</button>
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

function Toggle({ icon, label, sub, value, onChange, flat }: { icon: React.ReactNode; label: string; sub?: string; value: boolean; onChange: () => void; flat?: boolean }) {
  return (
    <button onClick={onChange} className={`w-full flex items-center gap-3 p-3.5 ${flat ? "" : "border-b border-border/60 last:border-0"} hover:bg-muted/40 transition`}>
      <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      <div className="flex-1 text-left">
        <div className="text-sm" style={{ fontWeight: 600 }}>{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className={`w-10 h-6 rounded-full transition relative ${value ? "bg-primary" : "bg-muted"}`}>
        <div className={`absolute top-0.5 size-5 rounded-full bg-white transition shadow ${value ? "left-[18px]" : "left-0.5"}`} />
      </div>
    </button>
  );
}



function SharingRow({ label, ok, warn, never }: { label: string; ok: boolean; warn?: boolean; never?: boolean }) {
  const tone = never ? "text-rose-600" : ok ? "text-emerald-600" : warn ? "text-amber-600" : "text-muted-foreground";
  return (
    <div className="flex items-start gap-2.5 px-4 py-2.5 border-b border-border/60 last:border-0">
      <div className={`mt-0.5 size-4 ${tone}`}>
        {never ? <Trash2 className="size-4" /> : ok ? <CheckCircle2 className="size-4" /> : <EyeOff className="size-4" />}
      </div>
      <div className="text-xs leading-relaxed">{label}</div>
    </div>
  );
}



function CountrySection() {
  const { country, pack, refresh } = useCountry();
  const allowed = useHasFeature("country");
  const [pending, setPending] = useState<CountryCode | null>(null);
  const [typed, setTyped] = useState("");
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const switchTo = async () => {
    if (!pending) return;
    const expectedName = TAX_PACKS[pending].name;
    if (typed.trim().toLowerCase() !== expectedName.toLowerCase()) {
      setErr(`Type "${expectedName}" exactly to confirm.`);
      return;
    }
    setWorking(true); setErr(null);
    try {
      const { data } = await supabase().auth.getSession();
      const token = data.session?.access_token ?? publicAnonKey;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-a3fe149f/me/switch-country`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ country: pending }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Switch failed: ${res.status}`);
      await refresh();
      setPending(null);
      setTyped("");
      window.location.reload();
    } catch (e: any) {
      console.error("Country switch failed:", e);
      setErr(e.message || "Switch failed");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Section title="Region & tax">
      <div className="p-3.5 border-b border-border/60 flex items-start gap-3">
        <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Globe className="size-4" /></div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="text-sm" style={{ fontWeight: 600 }}>Country</div>
            {!allowed && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 font-semibold">PRO</span>}
          </div>
          <div className="text-xs text-muted-foreground">{pack.flag} {pack.name} · {pack.currency} · {pack.notes}</div>
        </div>
      </div>
      <div className="p-3 grid grid-cols-1 gap-1.5">
        {COUNTRY_OPTIONS.map((opt) => {
          const active = opt.code === country;
          return (
            <button
              key={opt.code}
              disabled={!allowed || active}
              onClick={() => { setPending(opt.code); setTyped(""); setErr(null); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition ${active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"} disabled:opacity-60`}
            >
              <span className="text-base">{opt.flag}</span>
              <span className="flex-1 text-left" style={{ fontWeight: 500 }}>{opt.name}</span>
              {active && <CheckCircle2 className="size-4 text-primary" />}
            </button>
          );
        })}
      </div>

      {pending && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => !working && setPending(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-8">
            <div className="flex items-center gap-2 mb-2 text-amber-600" style={{ fontWeight: 700 }}>
              <AlertTriangle className="size-4" /> Switch to {TAX_PACKS[pending].name}?
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              <span style={{ fontWeight: 600 }} className="text-foreground">Cloud-synced data will be cleared</span> to keep your books consistent with {TAX_PACKS[pending].name}'s tax year and currency. Data stored only on this device is unaffected — it's like opening a fresh book.
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={`Type "${TAX_PACKS[pending].name}" to confirm`}
              className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm mb-2"
            />
            {err && <div className="text-xs text-rose-500 mb-2">{err}</div>}
            <div className="flex gap-2">
              <button disabled={working} onClick={() => setPending(null)} className="flex-1 bg-muted rounded-xl py-3 text-sm" style={{ fontWeight: 600 }}>Cancel</button>
              <button disabled={working} onClick={switchTo} className="flex-1 bg-amber-600 text-white rounded-xl py-3 text-sm inline-flex items-center justify-center gap-2" style={{ fontWeight: 700 }}>
                {working && <Loader2 className="size-4 animate-spin" />}
                Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function ActionRow({ icon, label, sub, danger, onClick }: { icon: React.ReactNode; label: string; sub?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-3.5 border-b border-border/60 last:border-0 hover:bg-muted/40 transition text-left">
      <div className={`size-9 rounded-lg flex items-center justify-center ${danger ? "bg-rose-50 text-rose-600" : "bg-primary/10 text-primary"}`}>{icon}</div>
      <div className="flex-1">
        <div className={`text-sm ${danger ? "text-rose-600" : ""}`} style={{ fontWeight: 600 }}>{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </button>
  );
}
