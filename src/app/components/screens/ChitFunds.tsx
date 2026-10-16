import { useEffect, useState } from "react";
import { Plus, Trash2, Trophy, Users, CalendarClock, Info } from "lucide-react";
import { Header, Screen } from "../Shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { inr } from "../types";
import { api } from "../../lib/api";
import { useStore } from "../../store";
import { sanitizeAmountInput } from "../../lib/currencyUtils";
import { localISO } from "../../lib/intelligence";
import { Chit, chitDueDate, nextChitDue, summarizeChit, validateEntry } from "../../lib/chit";

const CATEGORY = "Chit Fund";
const field = "w-full h-11 rounded-xl border border-border bg-background px-3 text-sm";
const newId = () => (globalThis.crypto?.randomUUID?.() ?? `chit-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function ChitFunds({ onBack }: { onBack: () => void }) {
  const { addTransaction } = useStore();
  const [chits, setChits] = useState<Chit[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [active, setActive] = useState<Chit | null>(null);

  const load = async () => {
    try { setChits(((await api.list<Chit>("chits")) || []).map((c) => ({ ...c, entries: c.entries || [] }))); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async (c: Chit) => { await api.create<Chit>("chits", c); await load(); setActive((cur) => (cur && cur.id === c.id ? c : cur)); };
  const remove = async (c: Chit) => {
    if (!confirm(`Delete "${c.name}"? Expenses you already logged stay in your ledger.`)) return;
    await api.remove("chits", c.id); setActive(null); await load();
  };

  const totalSaved = chits.filter((c) => !c.closed).reduce((s, c) => s + summarizeChit(c).netPaid, 0);

  return (
    <>
      <Header title="Chit Funds" subtitle="Committee & kitty tracker" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 pb-24 space-y-4">
          <div className="rounded-2xl bg-card border border-amber-200 p-5">
            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Paid into chits so far</div>
            <div className="font-display text-3xl font-black mt-1 text-slate-900">{inr(totalSaved)}</div>
            <div className="text-xs text-slate-600 mt-1">{chits.filter((c) => !c.closed).length} running · your own record, not the organiser’s statement</div>
          </div>

          <button onClick={() => setAdding(true)} className="w-full rounded-2xl border-2 border-dashed border-border py-3.5 flex items-center justify-center gap-2 text-muted-foreground active:scale-[0.99]">
            <Plus className="size-4" /><span className="text-sm font-bold">Add a chit fund</span>
          </button>

          {!loading && chits.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8 leading-relaxed">Track your committee instalments, dividends and the month you win the pot — in one place, with the next due date on every chit.</div>
          )}

          <div className="space-y-3">
            {chits.map((c) => {
              const s = summarizeChit(c);
              const due = nextChitDue(c);
              const pct = (s.monthsPaid / c.tenure) * 100;
              return (
                <button key={c.id} onClick={() => setActive(c)} className="w-full text-left bg-card rounded-2xl border border-border/60 p-4 space-y-2.5 active:scale-[0.99]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="font-bold text-slate-900 truncate">{c.name}</div><div className="text-[11px] text-muted-foreground">{c.organiser ? `${c.organiser} · ` : ""}{inr(c.instalment)} × {c.tenure} months</div></div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${s.status === "won" ? "bg-emerald-100 text-emerald-800" : s.status === "done" ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-800"}`}>{s.status === "won" ? "Pot won" : s.status === "done" ? "Completed" : "Saving"}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-amber-500" style={{ width: `${pct}%` }} /></div>
                  <div className="flex justify-between text-[11px] text-muted-foreground"><span>{s.monthsPaid}/{c.tenure} months paid · {inr(s.netPaid)}</span>{due && <span className="flex items-center gap-1"><CalendarClock className="size-3" /> Month {due.month} due {due.dueDate.slice(8)}/{due.dueDate.slice(5, 7)}</span>}</div>
                </button>
              );
            })}
          </div>
        </div>
      </Screen>

      <AddChitSheet open={adding} onClose={() => setAdding(false)} onSave={async (c) => { await save(c); setAdding(false); }} />
      <ChitSheet
        chit={active}
        onClose={() => setActive(null)}
        onDelete={remove}
        onLog={async (c, entry) => {
          const err = validateEntry(c, entry);
          if (err) return err;
          await save({ ...c, entries: [...c.entries, entry].sort((a, b) => a.month - b.month) });
          await addTransaction({ title: `Chit instalment — ${c.name} (${entry.month}/${c.tenure})`, category: CATEGORY, amount: entry.paid, type: "expense", date: entry.date, notes: entry.dividend ? `Dividend ${inr(entry.dividend)} adjusted` : undefined } as any);
          return null;
        }}
        onWin={async (c, amount, date, month) => {
          await save({ ...c, won: { month, amount, date } });
          // The pot is your own pooled money coming back plus a loan against future instalments — not income.
          await addTransaction({ title: `Chit pot received — ${c.name}`, category: CATEGORY, amount, type: "income", date, isTransfer: true, transferRole: "in" } as any, { silent: true });
        }}
      />
    </>
  );
}

function AddChitSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (c: Chit) => Promise<void> }) {
  const [name, setName] = useState(""); const [organiser, setOrganiser] = useState("");
  const [instalment, setInstalment] = useState(""); const [tenure, setTenure] = useState("");
  const [dueDay, setDueDay] = useState("5"); const [start, setStart] = useState(localISO().slice(0, 8) + "01");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setName(""); setOrganiser(""); setInstalment(""); setTenure(""); setDueDay("5"); setStart(localISO().slice(0, 8) + "01"); } }, [open]);
  const ok = name.trim() && Number(instalment) > 0 && Number(tenure) >= 2 && Number(tenure) <= 120 && Number(dueDay) >= 1 && Number(dueDay) <= 28;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader><DialogTitle>New chit fund</DialogTitle></DialogHeader>
        <div className="space-y-2.5">
          <input className={field} placeholder="Name (e.g. Sharma Chit 2026)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={field} placeholder="Organiser / foreman (optional)" value={organiser} onChange={(e) => setOrganiser(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className={field} inputMode="numeric" placeholder="Monthly ₹" value={instalment} onChange={(e) => setInstalment(sanitizeAmountInput(e.target.value))} />
            <input className={field} inputMode="numeric" placeholder="Months (members)" value={tenure} onChange={(e) => setTenure(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Due day (1–28)</div><input className={field} inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ""))} /></div>
            <div><div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">First month</div><input className={field} type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          </div>
          <button disabled={!ok || busy} onClick={async () => { setBusy(true); try { await onSave({ id: newId(), name: name.trim(), organiser: organiser.trim() || undefined, instalment: Number(instalment), tenure: Number(tenure), dueDay: Number(dueDay), startDate: start, entries: [] }); } finally { setBusy(false); } }} className="w-full h-12 rounded-xl bg-[#1E3A8A] text-white font-bold disabled:opacity-40">{busy ? "Saving…" : "Save chit"}</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChitSheet({ chit, onClose, onDelete, onLog, onWin }: {
  chit: Chit | null; onClose: () => void; onDelete: (c: Chit) => void;
  onLog: (c: Chit, e: { month: number; paid: number; dividend?: number; date: string }) => Promise<string | null>;
  onWin: (c: Chit, amount: number, date: string, month: number) => Promise<void>;
}) {
  const [paid, setPaid] = useState(""); const [dividend, setDividend] = useState(""); const [date, setDate] = useState(localISO());
  const [prize, setPrize] = useState(""); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { setPaid(chit ? String(chit.instalment) : ""); setDividend(""); setPrize(""); setErr(null); setDate(localISO()); }, [chit?.id, chit?.entries.length]);
  if (!chit) return <Dialog open={false}><DialogContent /></Dialog>;
  const s = summarizeChit(chit);
  const month = s.nextMonth;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[420px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="size-4" />{chit.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-muted/50 p-2.5"><div className="text-muted-foreground">Paid in</div><div className="font-bold text-sm">{inr(s.netPaid)}</div></div>
            <div className="rounded-xl bg-muted/50 p-2.5"><div className="text-muted-foreground">Dividends</div><div className="font-bold text-sm">{inr(s.dividendTotal)}</div></div>
            <div className="rounded-xl bg-muted/50 p-2.5"><div className="text-muted-foreground">Still to pay (nominal)</div><div className="font-bold text-sm">{inr(s.nominalLeft)}</div></div>
            <div className="rounded-xl bg-muted/50 p-2.5"><div className="text-muted-foreground">{chit.won ? "Pot held after paying in" : "Months left"}</div><div className="font-bold text-sm">{chit.won ? inr(s.prizeHeld ?? 0) : s.monthsLeft}</div></div>
          </div>

          {month !== null && !chit.closed && (
            <div className="rounded-xl border p-3 space-y-2">
              <div className="font-bold">Log month {month} of {chit.tenure} <span className="text-[11px] font-normal text-muted-foreground">· due {chitDueDate(chit, month)}</span></div>
              <div className="grid grid-cols-2 gap-2">
                <div><div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">You paid ₹</div><input className={field} inputMode="decimal" value={paid} onChange={(e) => setPaid(sanitizeAmountInput(e.target.value))} /></div>
                <div><div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Dividend ₹ (info)</div><input className={field} inputMode="decimal" value={dividend} onChange={(e) => setDividend(sanitizeAmountInput(e.target.value))} placeholder="0" /></div>
              </div>
              <input className={field} type="date" value={date} max={localISO()} onChange={(e) => setDate(e.target.value)} />
              {err && <div className="text-xs text-rose-700">{err}</div>}
              <button disabled={busy} onClick={async () => { setBusy(true); try { setErr(await onLog(chit, { month, paid: Number(paid), dividend: Number(dividend) || undefined, date })); } finally { setBusy(false); } }} className="w-full h-11 rounded-xl bg-[#1E3A8A] text-white font-bold disabled:opacity-40">Record instalment</button>
              <div className="text-[10px] text-muted-foreground flex gap-1.5"><Info className="size-3 mt-px shrink-0" />Adds an expense under “Chit Fund”, which Reports counts as savings.</div>
            </div>
          )}

          {!chit.won && month !== null && (
            <div className="rounded-xl border p-3 space-y-2">
              <div className="font-bold flex items-center gap-1.5"><Trophy className="size-4 text-amber-600" />Won the pot?</div>
              <input className={field} inputMode="decimal" placeholder="Amount you received ₹" value={prize} onChange={(e) => setPrize(sanitizeAmountInput(e.target.value))} />
              <button disabled={!(Number(prize) > 0) || busy} onClick={async () => { setBusy(true); try { await onWin(chit, Number(prize), date, month ?? 1); } finally { setBusy(false); } }} className="w-full h-11 rounded-xl border font-bold disabled:opacity-40">Record prize</button>
              <div className="text-[10px] text-muted-foreground">Not counted as income — it is your pooled money returning, and you keep paying the remaining instalments.</div>
            </div>
          )}
          {chit.won && <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">You received {inr(chit.won.amount)} on {chit.won.date}. {s.nominalLeft > 0 ? `${inr(s.nominalLeft)} of instalments remain — treat it as a loan you are repaying.` : ""}</div>}

          <button onClick={() => onDelete(chit)} className="w-full h-10 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-1.5"><Trash2 className="size-3.5" /> Delete this chit</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
