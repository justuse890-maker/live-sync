import { useEffect, useMemo, useState } from "react";
import {
  Banknote, Plus, Loader2, AlertTriangle, Mic, MicOff, Check, X,
  ArrowDownToLine, Scale, Wallet, Users, Trash2, Sparkles,
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import { api } from "../../lib/api";
import { useVoiceLang } from "../../lib/voiceLangs";
import { VoiceLangPicker } from "../VoiceLangPicker";

type LedgerKind = "withdraw" | "reconcile" | "adjust" | "pocketTransfer";
type Ledger = {
  id: string;
  kind: LedgerKind;
  amount: number;
  note?: string;
  pocketId?: string;
  date: string;
  createdAt?: string;
};
type Pocket = {
  id: string;
  name: string;
  owner?: string;
  balance: number;
  color?: string;
  createdAt?: string;
};

const POCKET_COLORS = ["#10B981", "#1E40AF", "#F59E0B", "#8B5CF6", "#EC4899", "#0EA5E9"];

export function CashWallet({ onBack }: { onBack: () => void }) {
  const { transactions, addTransaction } = useStore();
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<null | "withdraw" | "reconcile" | "voice" | "pocket" | "missing">(null);

  const load = async () => {
    try {
      const [l, p] = await Promise.all([
        api.list<Ledger>("cashLedger"),
        api.list<Pocket>("cashPockets"),
      ]);
      setLedger(l);
      setPockets(p);
    } catch (e) { console.warn("cash load failed", e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Tracked cash spend pulled from existing transactions where any payment line is cash.
  const trackedCashSpend = useMemo(() => {
    let total = 0;
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      const cashLines = (t.payments || []).filter((p) => p.mode === "cash");
      if (cashLines.length) total += cashLines.reduce((s, p) => s + (p.amount || 0), 0);
      else if (!t.payments?.length) {
        // legacy txs with no payment split — skip; we can't assume cash
      }
    }
    return total;
  }, [transactions]);

  const totalWithdrawn = ledger.filter((l) => l.kind === "withdraw").reduce((s, l) => s + l.amount, 0);
  const totalReconciled = ledger.filter((l) => l.kind === "reconcile" || l.kind === "adjust").reduce((s, l) => s + l.amount, 0);
  const pocketTotal = pockets.reduce((s, p) => s + (p.balance || 0), 0);

  // Expected cash on hand = withdrawn − tracked cash spend ± reconciliation adjustments
  const expected = Math.max(0, totalWithdrawn - trackedCashSpend + totalReconciled);
  const lastReconcile = ledger.filter((l) => l.kind === "reconcile").sort((a, b) => (a.createdAt || "") < (b.createdAt || "") ? 1 : -1)[0];
  const actual = lastReconcile?.amount != null ? Math.max(0, totalWithdrawn - trackedCashSpend + totalReconciled) : expected;
  const missing = Math.max(0, totalWithdrawn - trackedCashSpend - (pocketTotal || expected));

  const addLedger = async (entry: Omit<Ledger, "id">) => {
    const created = await api.create<Ledger>("cashLedger", entry);
    setLedger((xs) => [created, ...xs]);
  };
  const addPocket = async (p: Omit<Pocket, "id">) => {
    const created = await api.create<Pocket>("cashPockets", p);
    setPockets((xs) => [...xs, created]);
  };
  const updatePocket = async (p: Pocket) => {
    const saved = await api.create<Pocket>("cashPockets", p);
    setPockets((xs) => xs.map((x) => (x.id === saved.id ? saved : x)));
  };
  const removePocket = async (id: string) => {
    await api.remove("cashPockets", id);
    setPockets((xs) => xs.filter((x) => x.id !== id));
  };

  return (
    <>
      <Header
        title="Cash Wallet"
        subtitle="Track every rupee you spend offline"
        showBack
        onBack={onBack}
      />
      <Screen>
        <div className="px-5 pt-4 space-y-5">
          {/* Hero */}
          <div className="rounded-3xl p-5 text-white" style={{ background: "linear-gradient(135deg,#10B981 0%,#1E40AF 100%)" }}>
            <div className="flex items-center gap-2">
              <Wallet className="size-5" />
              <div className="text-sm" style={{ fontWeight: 700 }}>Cash on hand (estimated)</div>
            </div>
            <div className="text-3xl mt-2" style={{ fontWeight: 700 }}>{inr(expected)}</div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Tile label="Withdrawn" value={inr(totalWithdrawn)} />
              <Tile label="Tracked spend" value={inr(trackedCashSpend)} />
              <Tile label="In pockets" value={inr(pocketTotal)} />
            </div>
          </div>

          {/* Action grid */}
          <div className="grid grid-cols-4 gap-2">
            <Action icon={ArrowDownToLine} label="Withdraw" tint="#10B981" onClick={() => setSheet("withdraw")} />
            <Action icon={Scale} label="Reconcile" tint="#F59E0B" onClick={() => setSheet("reconcile")} />
            <Action icon={Mic} label="Voice" tint="#8B5CF6" onClick={() => setSheet("voice")} />
            <Action icon={Users} label="Pocket" tint="#EC4899" onClick={() => setSheet("pocket")} />
          </div>

          {/* Missing cash alert */}
          {missing > 100 && (
            <button
              onClick={() => setSheet("missing")}
              className="w-full rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3 text-left"
            >
              <div className="size-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-4 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-amber-900" style={{ fontWeight: 700 }}>
                  {inr(missing)} cash unaccounted
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5">
                  You withdrew {inr(totalWithdrawn)} and tracked {inr(trackedCashSpend)}. Tap to allocate.
                </div>
              </div>
              <Sparkles className="size-4 text-amber-700 mt-0.5" />
            </button>
          )}

          {/* Pockets */}
          <section>
            <SectionTitle icon={Users}>Family cash pockets</SectionTitle>
            {loading ? (
              <Spin />
            ) : pockets.length === 0 ? (
              <button
                onClick={() => setSheet("pocket")}
                className="w-full bg-card border border-dashed border-border rounded-2xl p-4 text-sm text-muted-foreground"
              >
                + Create a pocket (e.g. Father Cash, House Cash)
              </button>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {pockets.map((p) => (
                  <PocketRow key={p.id} p={p} onUpdate={updatePocket} onRemove={() => removePocket(p.id)} />
                ))}
                <button
                  onClick={() => setSheet("pocket")}
                  className="w-full px-4 py-3 border-t border-border/60 text-primary text-sm text-left flex items-center gap-2"
                  style={{ fontWeight: 600 }}
                >
                  <Plus className="size-4" /> Add pocket
                </button>
              </div>
            )}
          </section>

          {/* Ledger */}
          <section>
            <SectionTitle icon={Banknote}>Recent cash activity</SectionTitle>
            {loading ? <Spin /> : ledger.length === 0 ? (
              <EmptyHint>No cash activity yet. Log your last ATM withdrawal to begin.</EmptyHint>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {ledger.slice(0, 12).map((l) => <LedgerRow key={l.id} l={l} />)}
              </div>
            )}
          </section>

          <div className="bg-card border border-border/60 rounded-2xl p-4 text-xs text-muted-foreground leading-relaxed">
            Cash Wallet only stores entries you log — no SMS reading, no bank scraping. India sees ~40% of small purchases in cash;
            this is the safest way to keep them in the picture without compromising privacy.
          </div>
        </div>
      </Screen>

      {sheet === "withdraw" && <WithdrawSheet onClose={() => setSheet(null)} onSave={async (amt, note) => {
        await addLedger({ kind: "withdraw", amount: amt, note, date: today() });
        setSheet(null);
      }} />}
      {sheet === "reconcile" && <ReconcileSheet expected={expected} onClose={() => setSheet(null)} onSave={async (actualAmt, note) => {
        const diff = actualAmt - expected;
        await addLedger({ kind: "reconcile", amount: diff, note: note || `Reconciled to ${inr(actualAmt)}`, date: today() });
        setSheet(null);
      }} />}
      {sheet === "voice" && <VoiceCashSheet onClose={() => setSheet(null)} onConfirm={async (items) => {
        for (const i of items) {
          await addTransaction({
            title: i.label,
            category: "Cash",
            amount: -i.amount,
            type: "expense",
            date: today(),
            payments: [{ mode: "cash", amount: i.amount }],
          });
        }
        setSheet(null);
      }} />}
      {sheet === "pocket" && <PocketSheet onClose={() => setSheet(null)} onSave={async (p) => {
        await addPocket({ ...p, createdAt: new Date().toISOString() });
        setSheet(null);
      }} />}
      {sheet === "missing" && (
        <MissingSheet
          missing={missing}
          pockets={pockets}
          onClose={() => setSheet(null)}
          onAllocate={async ({ pocketId, amount, note }) => {
            if (pocketId) {
              const p = pockets.find((x) => x.id === pocketId);
              if (p) await updatePocket({ ...p, balance: (p.balance || 0) + amount });
            }
            await addLedger({ kind: "adjust", amount: -amount, note: note || "Allocated missing cash", date: today(), pocketId });
            setSheet(null);
          }}
        />
      )}
    </>
  );
}

// ───────────────────────── components ─────────────────────────

function Action({ icon: Icon, label, tint, onClick }: { icon: any; label: string; tint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-card border border-border rounded-2xl py-3 flex flex-col items-center gap-1.5">
      <div className="size-9 rounded-full flex items-center justify-center" style={{ background: tint + "15", color: tint }}>
        <Icon className="size-4" />
      </div>
      <div className="text-[11px]" style={{ fontWeight: 600 }}>{label}</div>
    </button>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur-sm p-2 text-center">
      <div className="text-sm" style={{ fontWeight: 700 }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-80" style={{ fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-2">
      <Icon className="size-3.5 text-muted-foreground" />
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>{children}</div>
    </div>
  );
}

function PocketRow({ p, onUpdate, onRemove }: { p: Pocket; onUpdate: (p: Pocket) => void; onRemove: () => void }) {
  const color = p.color || "#1E40AF";
  return (
    <div className="px-4 py-3 border-b border-border/60 last:border-0 flex items-center gap-3">
      <div className="size-9 rounded-full flex items-center justify-center" style={{ background: color + "20", color }}>
        <Wallet className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" style={{ fontWeight: 700 }}>{p.name}</div>
        {p.owner && <div className="text-[11px] text-muted-foreground truncate">{p.owner}</div>}
      </div>
      <div className="text-sm" style={{ fontWeight: 700, color }}>{inr(p.balance || 0)}</div>
      <button
        onClick={() => {
          const next = prompt(`New balance for ${p.name}`, String(p.balance || 0));
          if (next == null) return;
          const n = Number(next.replace(/[^0-9.]/g, ""));
          if (!Number.isFinite(n)) return;
          onUpdate({ ...p, balance: n });
        }}
        className="text-[11px] text-muted-foreground px-2"
        style={{ fontWeight: 600 }}
      >
        Edit
      </button>
      <button onClick={onRemove} className="text-muted-foreground hover:text-rose-600">
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function LedgerRow({ l }: { l: Ledger }) {
  const meta: Record<LedgerKind, { label: string; tint: string }> = {
    withdraw:       { label: "ATM withdrawal",       tint: "#10B981" },
    reconcile:      { label: "Reconciliation",       tint: "#F59E0B" },
    adjust:         { label: "Adjustment",           tint: "#8B5CF6" },
    pocketTransfer: { label: "Pocket transfer",      tint: "#1E40AF" },
  };
  const m = meta[l.kind];
  const isOut = l.amount < 0;
  return (
    <div className="px-4 py-3 border-b border-border/60 last:border-0 flex items-center gap-3">
      <div className="size-9 rounded-full flex items-center justify-center" style={{ background: m.tint + "15", color: m.tint }}>
        <Banknote className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate" style={{ fontWeight: 600 }}>{m.label}</div>
        <div className="text-[11px] text-muted-foreground truncate">{l.note || l.date}</div>
      </div>
      <div className="text-sm" style={{ fontWeight: 700, color: isOut ? "#EF4444" : m.tint }}>
        {isOut ? "−" : "+"}{inr(Math.abs(l.amount))}
      </div>
    </div>
  );
}

function Spin() {
  return <div className="flex justify-center py-6"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>;
}
function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="bg-card border border-dashed border-border rounded-2xl p-4 text-sm text-muted-foreground">{children}</div>;
}

// ───────────────────────── sheets ─────────────────────────

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 animate-in fade-in" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200">
        <div className="flex justify-between items-center mb-4">
          <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AmountInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="bg-muted/60 rounded-2xl p-5 text-center">
      <div className="text-xs text-muted-foreground mb-1">Amount</div>
      <div className="flex items-center justify-center gap-2">
        <span className="font-display text-muted-foreground" style={{ fontSize: 24 }}>₹</span>
        <input
          autoFocus={autoFocus}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0"
          className="bg-transparent outline-none w-40 text-center font-display"
          style={{ fontSize: 32, fontWeight: 700 }}
        />
      </div>
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm disabled:opacity-40 flex items-center justify-center gap-2 mt-4" style={{ fontWeight: 700 }}>
      {children}
    </button>
  );
}

function WithdrawSheet({ onClose, onSave }: { onClose: () => void; onSave: (amt: number, note?: string) => Promise<void> }) {
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Sheet title="Log cash withdrawal" onClose={onClose}>
      <AmountInput value={amt} onChange={setAmt} autoFocus />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. SBI ATM Indiranagar)" className="mt-3 w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
      <PrimaryBtn disabled={!amt || saving} onClick={async () => { setSaving(true); await onSave(Number(amt), note || undefined); }}>
        {saving && <Loader2 className="size-4 animate-spin" />} Save withdrawal
      </PrimaryBtn>
      <p className="text-[11px] text-muted-foreground text-center mt-2">This is a transfer Bank→Cash, not an expense.</p>
    </Sheet>
  );
}

function ReconcileSheet({ expected, onClose, onSave }: { expected: number; onClose: () => void; onSave: (actual: number, note?: string) => Promise<void> }) {
  const [actual, setActual] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const a = Number(actual || 0);
  const diff = a - expected;
  return (
    <Sheet title="Reconcile cash" onClose={onClose}>
      <div className="bg-muted/40 rounded-xl p-3 text-sm flex justify-between mb-3">
        <span className="text-muted-foreground">Expected</span>
        <span style={{ fontWeight: 700 }}>{inr(expected)}</span>
      </div>
      <AmountInput value={actual} onChange={setActual} autoFocus />
      {actual && (
        <div className={`mt-3 rounded-xl p-3 text-sm flex justify-between ${Math.abs(diff) < 1 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
          <span>{Math.abs(diff) < 1 ? "Balanced ✓" : diff < 0 ? "Untracked spend" : "Found extra"}</span>
          <span style={{ fontWeight: 700 }}>{diff === 0 ? "—" : (diff > 0 ? "+" : "−") + inr(Math.abs(diff))}</span>
        </div>
      )}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="mt-3 w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
      <PrimaryBtn disabled={!actual || saving} onClick={async () => { setSaving(true); await onSave(a, note || undefined); }}>
        {saving && <Loader2 className="size-4 animate-spin" />} Save reconciliation
      </PrimaryBtn>
    </Sheet>
  );
}

function VoiceCashSheet({ onClose, onConfirm }: { onClose: () => void; onConfirm: (items: { label: string; amount: number }[]) => Promise<void> }) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [items, setItems] = useState<{ label: string; amount: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useVoiceLang();

  const parse = (text: string) => {
    const lines = text.split(/[\n,;]|(?:\s+and\s+)/i).map((s) => s.trim()).filter(Boolean);
    const out: { label: string; amount: number }[] = [];
    for (const line of lines) {
      const m = line.match(/(.+?)\s*(\d+(?:\.\d+)?)/);
      if (m) {
        const label = m[1].trim().replace(/[.:-]+$/, "");
        const amount = Number(m[2]);
        if (label && amount > 0) out.push({ label: label.charAt(0).toUpperCase() + label.slice(1), amount });
      }
    }
    return out;
  };

  const startVoice = () => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { alert("Voice not supported on this device. Type instead."); return; }
    const r = new SR();
    r.lang = lang;
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e: any) => {
      const text = Array.from(e.results).map((x: any) => x[0].transcript).join(" ");
      setTranscript(text);
      setItems(parse(text));
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setListening(true);
    r.start();
  };

  return (
    <Sheet title="Voice cash entry" onClose={onClose}>
      <div className="mb-3">
        <VoiceLangPicker value={lang} onChange={setLang} />
      </div>
      <p className="text-xs text-muted-foreground mb-3">Say items like "milk 40, auto 80, tea 20" — works in your chosen language.</p>
      <button
        onClick={listening ? undefined : startVoice}
        className={`w-full rounded-2xl py-5 flex flex-col items-center gap-2 border ${listening ? "border-rose-300 bg-rose-50" : "border-primary/30 bg-primary/5"}`}
      >
        <div className={`size-12 rounded-full flex items-center justify-center ${listening ? "bg-rose-500 text-white animate-pulse" : "bg-primary text-primary-foreground"}`}>
          {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </div>
        <div className="text-sm" style={{ fontWeight: 700 }}>{listening ? "Listening…" : "Tap to speak"}</div>
      </button>
      <textarea
        value={transcript}
        onChange={(e) => { setTranscript(e.target.value); setItems(parse(e.target.value)); }}
        placeholder="…or type: milk 40, tea 20"
        rows={2}
        className="mt-3 w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none"
      />
      {items.length > 0 && (
        <div className="mt-3 bg-card border border-border rounded-2xl overflow-hidden">
          {items.map((it, i) => (
            <div key={i} className="px-4 py-2.5 border-b border-border/60 last:border-0 flex justify-between text-sm">
              <span style={{ fontWeight: 600 }}>{it.label}</span>
              <span style={{ fontWeight: 700, color: "#10B981" }}>{inr(it.amount)}</span>
            </div>
          ))}
        </div>
      )}
      <PrimaryBtn disabled={items.length === 0 || saving} onClick={async () => { setSaving(true); await onConfirm(items); }}>
        {saving && <Loader2 className="size-4 animate-spin" />}
        <Check className="size-4" /> Save {items.length || ""} cash expense{items.length === 1 ? "" : "s"}
      </PrimaryBtn>
    </Sheet>
  );
}

function PocketSheet({ onClose, onSave }: { onClose: () => void; onSave: (p: Omit<Pocket, "id">) => Promise<void> }) {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [balance, setBalance] = useState("");
  const [color, setColor] = useState(POCKET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  return (
    <Sheet title="New cash pocket" onClose={onClose}>
      <Label>Name</Label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. House Cash, Father Cash" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm mb-3 outline-none" />
      <Label>Owner (optional)</Label>
      <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g. Mom" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm mb-3 outline-none" />
      <Label>Starting balance</Label>
      <input inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm mb-3 outline-none" />
      <Label>Colour</Label>
      <div className="flex gap-2 mb-2">
        {POCKET_COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} className={`size-7 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
        ))}
      </div>
      <PrimaryBtn disabled={!name || saving} onClick={async () => { setSaving(true); await onSave({ name, owner: owner || undefined, balance: Number(balance || 0), color }); }}>
        {saving && <Loader2 className="size-4 animate-spin" />} Create pocket
      </PrimaryBtn>
    </Sheet>
  );
}

function MissingSheet({ missing, pockets, onClose, onAllocate }:
  { missing: number; pockets: Pocket[]; onClose: () => void; onAllocate: (x: { pocketId?: string; amount: number; note?: string }) => Promise<void> }
) {
  const [amount, setAmount] = useState(String(missing));
  const [pocketId, setPocketId] = useState<string | undefined>(pockets[0]?.id);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Sheet title="Allocate missing cash" onClose={onClose}>
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 mb-3">
        <div style={{ fontWeight: 700 }}>{inr(missing)} unaccounted</div>
        <div className="text-[11px] mt-0.5">Allocate to a pocket, family member, or mark as untracked spend.</div>
      </div>
      <Label>Amount</Label>
      <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm mb-3 outline-none" />
      {pockets.length > 0 && (
        <>
          <Label>Move to pocket (optional)</Label>
          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={() => setPocketId(undefined)} className={`px-3 py-1.5 rounded-full text-xs ${!pocketId ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`} style={{ fontWeight: 600 }}>
              Untracked spend
            </button>
            {pockets.map((p) => (
              <button key={p.id} onClick={() => setPocketId(p.id)} className={`px-3 py-1.5 rounded-full text-xs ${pocketId === p.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`} style={{ fontWeight: 600 }}>
                {p.name}
              </button>
            ))}
          </div>
        </>
      )}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. festival, family share)" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm mb-1 outline-none" />
      <PrimaryBtn disabled={!Number(amount) || saving} onClick={async () => { setSaving(true); await onAllocate({ pocketId, amount: Number(amount), note: note || undefined }); }}>
        {saving && <Loader2 className="size-4 animate-spin" />} Allocate
      </PrimaryBtn>
    </Sheet>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>{children}</div>;
}

function today() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}
