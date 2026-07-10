import { useEffect, useState } from "react";
import { Plus, ShieldCheck, X, Building2, Trash2, Loader2, Info, RefreshCw, CheckCircle2 } from "lucide-react";
import { Header, Screen } from "../Shell";
import { api } from "../../lib/api";

type Account = {
  id: string;
  bank: string;
  accountType: "Savings" | "Current" | "Credit Card";
  maskedNumber: string;
  consentExpiry: string;
  aggregator: string;
  scope: string[];
  status: "active" | "expired" | "revoked";
  lastSyncedAt?: string;
  txCount?: number;
  balance?: number;
};

const banks = [
  { code: "HDFC", name: "HDFC Bank" },
  { code: "ICICI", name: "ICICI Bank" },
  { code: "SBI", name: "State Bank of India" },
  { code: "AXIS", name: "Axis Bank" },
  { code: "KOTAK", name: "Kotak Mahindra Bank" },
  { code: "PNB", name: "Punjab National Bank" },
  { code: "YES", name: "Yes Bank" },
  { code: "IDFC", name: "IDFC FIRST Bank" },
];
const aggregators = ["Finvu", "OneMoney", "Setu", "NADL", "Anumati"];

export function ConnectedAccounts({ onBack }: { onBack: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [flowOpen, setFlowOpen] = useState(false);

  const load = async () => {
    try {
      const items = await api.list<Account>("accounts");
      setAccounts(items);
    } catch (e) {
      console.error("Loading accounts failed:", e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const revoke = async (id: string) => {
    try {
      await api.remove("accounts", id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.error("Revoke account failed:", e);
    }
  };

  // Simulates an Account Aggregator data fetch. In a real AA integration this
  // would POST a FI-Request to the AA, poll for FI-Data, parse it, and upsert
  // transactions/balances. For now we mimic latency + persist sync metadata.
  const sync = async (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    setAccounts((prev) => prev.map((a) => a.id === id ? { ...a, status: "active" } : a));
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 600));
    const added = 8 + Math.floor(Math.random() * 18);
    const balance = 25000 + Math.floor(Math.random() * 200000);
    const next: Account = {
      ...acc,
      lastSyncedAt: new Date().toISOString(),
      txCount: (acc.txCount ?? 0) + added,
      balance,
    };
    setAccounts((prev) => prev.map((a) => a.id === id ? next : a));
  };

  return (
    <>
      <Header title="Connected Accounts" subtitle="RBI Account Aggregator" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              <div className="text-sm" style={{ fontWeight: 700 }}>Secured by RBI's AA framework</div>
            </div>
            <p className="text-xs text-white/80 mt-2 leading-relaxed">
              LiveSync never sees your bank credentials. Read-only data flows through an RBI-licensed Account Aggregator with end-to-end encryption and a consent you can revoke any time.
            </p>
          </div>

          <button onClick={() => setFlowOpen(true)} className="w-full rounded-2xl border-2 border-dashed border-border text-muted-foreground py-3 flex items-center justify-center gap-2 hover:bg-card transition">
            <Plus className="size-4" />
            <span className="text-sm" style={{ fontWeight: 600 }}>Link a bank account</span>
          </button>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No accounts linked yet. Linking lets LiveSync auto-import transactions read-only.
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => <AccountRow key={a.id} account={a} onRevoke={() => revoke(a.id)} onSync={() => sync(a.id)} />)}
            </div>
          )}

          <InfoCard />
        </div>
      </Screen>
      {flowOpen && (
        <ConsentFlow
          onClose={() => setFlowOpen(false)}
          onConnected={async (a) => {
            setAccounts((p) => [a, ...p]);
            setFlowOpen(false);
            // Initial post-link sync — like a real AA flow that immediately
            // fetches the first batch of FI-Data after consent is signed.
            sync(a.id);
          }}
        />
      )}
    </>
  );
}

function AccountRow({ account, onRevoke, onSync }: { account: Account; onRevoke: () => void; onSync: () => void | Promise<void> }) {
  const [syncing, setSyncing] = useState(false);
  const days = Math.ceil((new Date(account.consentExpiry).getTime() - Date.now()) / 86400000);
  const lastSync = account.lastSyncedAt ? timeAgo(account.lastSyncedAt) : null;

  const doSync = async () => {
    setSyncing(true);
    try { await onSync(); } finally { setSyncing(false); }
  };

  return (
    <div className="bg-card rounded-2xl p-4 border border-border/60">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Building2 className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="text-sm truncate" style={{ fontWeight: 700 }}>{account.bank}</div>
            {account.status === "active" && (
              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
            )}
          </div>
          <div className="text-xs text-muted-foreground">{account.accountType} · {account.maskedNumber}</div>
        </div>
        <button
          onClick={doSync}
          disabled={syncing}
          className="size-9 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 disabled:opacity-50"
          aria-label="Sync now"
          title="Sync now"
        >
          {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </button>
        <button onClick={onRevoke} className="size-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600" aria-label="Revoke">
          <Trash2 className="size-4" />
        </button>
      </div>

      {(account.balance != null || account.txCount != null || lastSync) && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <SyncStat label="Balance" value={account.balance != null ? `₹${account.balance.toLocaleString("en-IN")}` : "—"} />
          <SyncStat label="Imported" value={account.txCount != null ? `${account.txCount} txn` : "—"} />
          <SyncStat label="Synced" value={lastSync ?? "Never"} />
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-muted-foreground">Aggregator</div>
          <div style={{ fontWeight: 600 }}>{account.aggregator}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Consent expires</div>
          <div style={{ fontWeight: 600, color: days < 30 && days > 0 ? "#B45309" : days <= 0 ? "#DC2626" : undefined }}>
            {days > 0 ? `in ${days} days` : "Expired"}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {account.scope.map((s) => (
          <span key={s} className="text-[10px] px-2 py-0.5 bg-muted rounded-full" style={{ fontWeight: 600 }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

function SyncStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-lg px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>{label}</div>
      <div className="text-xs truncate" style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function InfoCard() {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border/60">
      <div className="flex items-center gap-2 mb-2">
        <Info className="size-4 text-primary" />
        <div className="text-sm" style={{ fontWeight: 700 }}>What you're agreeing to</div>
      </div>
      <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
        <li>• <span className="text-foreground">Read-only access</span> to transactions and balances — no money can move.</li>
        <li>• <span className="text-foreground">Time-bound consent</span> (default 12 months) with daily revocation in this screen.</li>
        <li>• <span className="text-foreground">Data Processing Agreement</span> with the Account Aggregator under RBI Master Directions.</li>
        <li>• Data is encrypted in transit (TLS 1.3) and at rest (AES-256).</li>
      </ul>
    </div>
  );
}

function ConsentFlow({ onClose, onConnected }: { onClose: () => void; onConnected: (a: Account) => void }) {
  const [step, setStep] = useState<"bank" | "consent" | "otp" | "linking">("bank");
  const [bank, setBank] = useState(banks[0]);
  const [aggregator, setAggregator] = useState(aggregators[0]);
  const [scope, setScope] = useState<string[]>(["Transactions", "Balance"]);
  const [otp, setOtp] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleScope = (s: string) => setScope((sc) => sc.includes(s) ? sc.filter((x) => x !== s) : [...sc, s]);

  const finish = async () => {
    setSaving(true);
    const expiry = new Date(); expiry.setMonth(expiry.getMonth() + 12);
    try {
      const created = await api.create<Account>("accounts", {
        bank: bank.name,
        accountType: "Savings",
        maskedNumber: `XXXX XXXX ${Math.floor(1000 + Math.random() * 9000)}`,
        consentExpiry: expiry.toISOString().slice(0, 10),
        aggregator,
        scope,
        status: "active",
      });
      onConnected(created);
    } catch (e) {
      console.error("Account linking failed:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8">
        <div className="flex justify-between items-center mb-4">
          <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>Link account</div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>

        <Steps current={step} />

        {step === "bank" && (
          <>
            <div className="text-xs text-muted-foreground mb-2 mt-4" style={{ fontWeight: 600 }}>Choose your bank</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {banks.map((b) => (
                <button key={b.code} onClick={() => setBank(b)} className={`p-3 rounded-xl border text-sm text-left ${bank.code === b.code ? "border-primary bg-primary/5 text-primary" : "border-border bg-muted/40"}`} style={{ fontWeight: 600 }}>
                  {b.name}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground mb-2" style={{ fontWeight: 600 }}>Account Aggregator</div>
            <select value={aggregator} onChange={(e) => setAggregator(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm mb-4">
              {aggregators.map((a) => <option key={a}>{a}</option>)}
            </select>
            <button onClick={() => setStep("consent")} className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm" style={{ fontWeight: 700 }}>Continue</button>
          </>
        )}

        {step === "consent" && (
          <>
            <div className="text-xs text-muted-foreground mb-3 mt-4">
              You'll grant <span className="text-foreground" style={{ fontWeight: 600 }}>{bank.name}</span> permission to share the following with LiveSync via <span className="text-foreground" style={{ fontWeight: 600 }}>{aggregator}</span> for 12 months. You can revoke any time.
            </div>
            <div className="space-y-2 mb-4">
              {["Transactions", "Balance", "Profile", "Statements"].map((s) => (
                <label key={s} className="flex items-center gap-3 bg-muted/40 rounded-xl p-3 cursor-pointer">
                  <input type="checkbox" checked={scope.includes(s)} onChange={() => toggleScope(s)} className="size-4 accent-primary" />
                  <div className="flex-1 text-sm" style={{ fontWeight: 600 }}>{s}</div>
                </label>
              ))}
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800 mb-4">
              Purpose: Personal finance management. Data fetched fortnightly. No sharing with third parties.
            </div>
            <button onClick={() => setStep("otp")} className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm" style={{ fontWeight: 700 }}>I consent — Continue</button>
          </>
        )}

        {step === "otp" && (
          <>
            <div className="text-xs text-muted-foreground mb-3 mt-4">
              {bank.name} will send an OTP to your registered mobile to confirm.
            </div>
            <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" placeholder="6-digit OTP" className="w-full bg-muted/60 rounded-xl px-3.5 py-3 text-center text-lg tracking-widest mb-4" />
            <button onClick={async () => { setStep("linking"); await finish(); }} disabled={otp.length < 4 || saving} className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm disabled:opacity-40 flex items-center justify-center gap-2" style={{ fontWeight: 700 }}>
              {saving && <Loader2 className="size-4 animate-spin" />} Verify & link
            </button>
          </>
        )}

        {step === "linking" && (
          <div className="py-10 text-center">
            <Loader2 className="size-6 animate-spin mx-auto text-primary mb-3" />
            <div className="text-sm" style={{ fontWeight: 600 }}>Linking your account…</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Steps({ current }: { current: "bank" | "consent" | "otp" | "linking" }) {
  const steps = ["bank", "consent", "otp"];
  const idx = steps.indexOf(current === "linking" ? "otp" : current);
  return (
    <div className="flex gap-1.5">
      {steps.map((_, i) => (
        <div key={i} className={`flex-1 h-1 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />
      ))}
    </div>
  );
}

