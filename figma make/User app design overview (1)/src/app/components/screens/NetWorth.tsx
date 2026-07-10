import { useMemo, useState } from "react";
import { Plus, Trash2, X, TrendingUp, TrendingDown, Wallet, Loader2 } from "lucide-react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import { Asset, Liability, ASSET_LABELS, LIABILITY_LABELS, DEFAULT_RETURN, netWorth } from "../../lib/intelligence";

export function NetWorth({ onBack }: { onBack: () => void }) {
  const { assets, liabilities, upsertAsset, removeAsset, upsertLiability, removeLiability, ready } = useStore();
  const [editing, setEditing] = useState<{ kind: "asset" } | { kind: "liability" } | null>(null);

  const { totalAssets, totalLiab, netWorth: nw } = useMemo(() => netWorth(assets, liabilities), [assets, liabilities]);

  // Annualised growth projection
  const projected = useMemo(() => {
    const annualGain = assets.reduce((s, a) => s + a.value * ((a.expectedReturn ?? DEFAULT_RETURN[a.kind]) / 100), 0);
    const annualInterest = liabilities.reduce((s, l) => s + l.outstanding * (l.interestRate / 100), 0);
    return { annualGain, annualInterest, net: annualGain - annualInterest };
  }, [assets, liabilities]);

  return (
    <>
      <Header title="Net Worth" subtitle="North-star metric" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-5">
            <div className="text-xs uppercase tracking-wider text-white/70">Total net worth</div>
            <div className="font-display mt-1" style={{ fontSize: 32, fontWeight: 700 }}>{inr(nw)}</div>
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/15">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/70">Assets</div>
                <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>{inr(totalAssets)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/70">Liabilities</div>
                <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>{inr(totalLiab)}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-white/85 flex items-center gap-1.5">
              <TrendingUp className="size-3.5" /> Projected +{inr(Math.round(projected.net))}/yr at current returns
            </div>
          </div>

          <Section title="Assets" right={
            <button onClick={() => setEditing({ kind: "asset" })} className="text-xs text-primary flex items-center gap-1" style={{ fontWeight: 600 }}>
              <Plus className="size-3.5" /> Add
            </button>
          }>
            {!ready ? <Empty>Loading…</Empty>
              : assets.length === 0 ? <Empty>No assets yet. Add savings, MFs, EPF, gold, property.</Empty>
              : assets.map((a) => <Row key={a.id} primary={a.name} secondary={`${ASSET_LABELS[a.kind]} · ${a.expectedReturn ?? DEFAULT_RETURN[a.kind]}% p.a.`} amount={inr(a.value)} onDelete={() => removeAsset(a.id)} />)}
          </Section>

          <Section title="Liabilities" right={
            <button onClick={() => setEditing({ kind: "liability" })} className="text-xs text-primary flex items-center gap-1" style={{ fontWeight: 600 }}>
              <Plus className="size-3.5" /> Add
            </button>
          }>
            {liabilities.length === 0 ? <Empty>No loans tracked. Add home loan, credit card, etc.</Empty>
              : liabilities.map((l) => <Row key={l.id} primary={l.name} secondary={`${LIABILITY_LABELS[l.kind]} · ${l.interestRate}% p.a.${l.emi ? ` · EMI ${inr(l.emi)}` : ""}`} amount={inr(l.outstanding)} negative onDelete={() => removeLiability(l.id)} />)}
          </Section>

          <div className="bg-card rounded-2xl p-4 border border-border/60">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2" style={{ fontWeight: 600 }}>This year</div>
            <div className="flex items-center gap-2 text-sm mb-1">
              <TrendingUp className="size-4 text-emerald-600" />
              Asset growth: <span style={{ fontWeight: 700 }}>{inr(Math.round(projected.annualGain))}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <TrendingDown className="size-4 text-rose-600" />
              Interest paid: <span style={{ fontWeight: 700 }}>{inr(Math.round(projected.annualInterest))}</span>
            </div>
          </div>
        </div>
      </Screen>

      {editing?.kind === "asset" && <AssetSheet onClose={() => setEditing(null)} onSave={async (a) => { await upsertAsset(a); setEditing(null); }} />}
      {editing?.kind === "liability" && <LiabilitySheet onClose={() => setEditing(null)} onSave={async (l) => { await upsertLiability(l); setEditing(null); }} />}
    </>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-xs text-muted-foreground uppercase tracking-wider" style={{ fontWeight: 600 }}>{title}</div>
        {right}
      </div>
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ primary, secondary, amount, negative, onDelete }: { primary: string; secondary: string; amount: string; negative?: boolean; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3.5 border-b border-border/60 last:border-0">
      <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        <Wallet className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" style={{ fontWeight: 600 }}>{primary}</div>
        <div className="text-xs text-muted-foreground truncate">{secondary}</div>
      </div>
      <div className={`text-sm ${negative ? "text-rose-600" : ""}`} style={{ fontWeight: 700 }}>{negative ? "−" : ""}{amount}</div>
      <button onClick={onDelete} className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600">
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-6 text-sm text-muted-foreground">{children}</div>;
}

function AssetSheet({ onClose, onSave }: { onClose: () => void; onSave: (a: Omit<Asset, "id">) => Promise<void> }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Asset["kind"]>("mf");
  const [value, setValue] = useState(0);
  const [ret, setRet] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  return (
    <Sheet onClose={onClose} title="Add asset">
      <Field label="Name (e.g. Zerodha — Nifty 50)"><Input value={name} onChange={setName} /></Field>
      <Field label="Type">
        <select value={kind} onChange={(e) => setKind(e.target.value as Asset["kind"])} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm">
          {Object.entries(ASSET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="Current value (₹)"><Num value={value} onChange={setValue} /></Field>
      <Field label={`Expected return % p.a. (default ${DEFAULT_RETURN[kind]}%)`}>
        <Input value={ret === "" ? "" : String(ret)} onChange={(s) => setRet(s === "" ? "" : Number(s))} inputMode="decimal" />
      </Field>
      <button disabled={!name || !value || busy} onClick={async () => { setBusy(true); await onSave({ name, kind, value, expectedReturn: ret === "" ? undefined : Number(ret) }); setBusy(false); }}
        className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm disabled:opacity-40 flex items-center justify-center gap-2" style={{ fontWeight: 700 }}>
        {busy && <Loader2 className="size-4 animate-spin" />} Save asset
      </button>
    </Sheet>
  );
}

function LiabilitySheet({ onClose, onSave }: { onClose: () => void; onSave: (l: Omit<Liability, "id">) => Promise<void> }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Liability["kind"]>("home");
  const [outstanding, setOutstanding] = useState(0);
  const [rate, setRate] = useState(8.5);
  const [emi, setEmi] = useState(0);
  const [busy, setBusy] = useState(false);

  return (
    <Sheet onClose={onClose} title="Add liability">
      <Field label="Name (e.g. HDFC Home Loan)"><Input value={name} onChange={setName} /></Field>
      <Field label="Type">
        <select value={kind} onChange={(e) => setKind(e.target.value as Liability["kind"])} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm">
          {Object.entries(LIABILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="Outstanding (₹)"><Num value={outstanding} onChange={setOutstanding} /></Field>
      <Field label="Interest rate % p.a."><Num value={rate} onChange={setRate} decimal /></Field>
      <Field label="Monthly EMI (₹, optional)"><Num value={emi} onChange={setEmi} /></Field>
      <button disabled={!name || !outstanding || busy} onClick={async () => { setBusy(true); await onSave({ name, kind, outstanding, interestRate: rate, emi: emi || undefined }); setBusy(false); }}
        className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm disabled:opacity-40 flex items-center justify-center gap-2" style={{ fontWeight: 700 }}>
        {busy && <Loader2 className="size-4 animate-spin" />} Save liability
      </button>
    </Sheet>
  );
}

export function Sheet({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8">
        <div className="flex justify-between items-center mb-4">
          <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

export function Input({ value, onChange, inputMode }: { value: string; onChange: (s: string) => void; inputMode?: "decimal" | "numeric" | "text" }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm" />;
}

export function Num({ value, onChange, decimal }: { value: number; onChange: (n: number) => void; decimal?: boolean }) {
  return (
    <input
      inputMode={decimal ? "decimal" : "numeric"}
      value={value === 0 ? "" : value}
      onChange={(e) => {
        const v = e.target.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "");
        onChange(v === "" ? 0 : Number(v));
      }}
      placeholder="0"
      className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm"
    />
  );
}
