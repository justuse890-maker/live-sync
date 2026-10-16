import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Check, X, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tx, useStore } from "../store";
import { api } from "../lib/api";
import { inr } from "./types";
import { sanitizeAmountInput } from "../lib/currencyUtils";
import { localISO } from "../lib/intelligence";
import { clearTransfer } from "../lib/transfers";
import { MoneyFlow, SuccessBurst } from "./FlowFx";

type Acct = { id: string; bank: string; accountType?: string; maskedNumber?: string };
export const CASH = "__cash__";
export const acctLabel = (a: Acct) => `${a.bank}${a.maskedNumber ? ` ${a.maskedNumber}` : ""}`;

export function useAccounts() {
  const [accounts, setAccounts] = useState<Acct[]>([]);
  useEffect(() => {
    let live = true;
    api.list<Acct>("accounts").then((a) => { if (live) setAccounts(a || []); }).catch(() => {});
    return () => { live = false; };
  }, []);
  return accounts;
}

const DISMISS_KEY = "ls_transfer_dismissed";
const readDismissed = (): string[] => {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]"); } catch { return []; }
};
const writeDismissed = (v: string[]) => {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(v.slice(-200))); } catch { /* storage unavailable — suggestion simply reappears */ }
};

/** "Is this you moving your own money?" — shows at most two likely pairs; the user always confirms. */
export function TransferSuggestions() {
  const { transferSuggestions, allTransactions, linkTransfer } = useStore();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const byId = useMemo(() => new Map(allTransactions.map((t) => [t.id, t])), [allTransactions]);
  const pairs = transferSuggestions.filter((s) => !dismissed.includes(`${s.outId}|${s.inId}`)).slice(0, 2);
  if (pairs.length === 0) return null;

  const dismiss = (key: string) => { const next = [...dismissed, key]; setDismissed(next); writeDismissed(next); };

  return (
    <div className="space-y-2">
      {pairs.map((s) => {
        const o = byId.get(s.outId), i = byId.get(s.inId);
        if (!o || !i) return null;
        const key = `${s.outId}|${s.inId}`;
        return (
          <div key={key} className="rounded-2xl border border-sky-200 bg-sky-50 p-3.5 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <ArrowRightLeft className="size-4 text-sky-700 mt-0.5 shrink-0" />
              <div className="text-xs text-sky-900 leading-snug">
                <div className="font-bold">Did you move {inr(s.amount)} between your own accounts?</div>
                <div className="mt-1 text-sky-800/90">Out: {o.merchant || o.title} · In: {i.merchant || i.title}. If yes, we won’t count it as spending or income.</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => linkTransfer(s.outId, s.inId)} className="flex-1 bg-sky-700 text-white text-xs font-bold py-2 rounded-xl active:scale-95 flex items-center justify-center gap-1.5"><Check className="size-3.5" /> Yes, my own money</button>
              <button onClick={() => dismiss(key)} className="px-4 bg-white border border-sky-200 text-sky-800 text-xs font-bold py-2 rounded-xl active:scale-95">No</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Record money moved between own accounts / cash (bank → ATM cash, savings → FD account, wallet top-up…). */
export function AddTransferSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addTransfer } = useStore();
  const accounts = useAccounts();
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(localISO());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { if (open) { setAmount(""); setFrom(""); setTo(""); setDate(localISO()); setDone(false); } }, [open]);

  const options = [...accounts.map((a) => ({ id: a.id, label: acctLabel(a) })), { id: CASH, label: "Cash in hand" }];
  const label = (id: string) => options.find((o) => o.id === id)?.label;
  const amt = Number(amount);
  const same = !!from && from === to;
  const valid = amt > 0 && !!from && !!to && !same;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await addTransfer({
        amount: amt, date,
        fromAccountId: from === CASH ? undefined : from, toAccountId: to === CASH ? undefined : to,
        fromLabel: label(from), toLabel: label(to),
      });
      setDone(true);
      setTimeout(onClose, 1100);
    } finally { setBusy(false); }
  };

  const Select = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm">
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="size-4" /> Move your own money</DialogTitle></DialogHeader>
        {done ? (
          <div className="space-y-3 py-4 text-center">
            <SuccessBurst />
            <div className="font-bold text-emerald-700 ls-rise">{inr(amt)} moved</div>
            <div className="text-xs text-muted-foreground ls-rise">{label(from)} → {label(to)} · not counted as spending or income</div>
          </div>
        ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/50 rounded-xl p-2.5">
            <Info className="size-3.5 mt-0.5 shrink-0" />
            <span>Bank → bank, ATM withdrawal, wallet top-up. This is <b>not</b> income or spending, so it never changes your totals. Spending is recorded when you actually spend the cash.</span>
          </div>
          <input inputMode="decimal" placeholder="Amount (₹)" value={amount} onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))} className="w-full h-12 rounded-xl border border-border bg-background px-3 text-lg font-bold" />
          <div className="grid grid-cols-2 gap-2">
            <div><div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">From</div><Select value={from} onChange={setFrom} placeholder="Choose" /></div>
            <div><div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">To</div><Select value={to} onChange={setTo} placeholder="Choose" /></div>
          </div>
          {same && <div className="text-xs text-rose-600 flex items-center gap-1"><X className="size-3" /> Choose two different places</div>}
          <MoneyFlow from={label(from)} to={label(to)} active={valid} />
          {accounts.length === 0 && <div className="text-[11px] text-muted-foreground">Tip: add your bank accounts in Profile → Accounts so transfers show which account they touch.</div>}
          <input type="date" value={date} max={localISO()} onChange={(e) => setDate(e.target.value)} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm" />
          <button disabled={!valid || busy} onClick={submit} className="w-full h-12 rounded-xl bg-[#1E3A8A] text-white font-bold disabled:opacity-40 active:scale-[0.98]">
            {busy ? "Saving…" : "Save transfer"}
          </button>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Tap a transfer row → explains why it isn't counted, and lets the user undo it. */
export function TransferDetail({ tx, onClose }: { tx: Tx | null; onClose: () => void }) {
  const { allTransactions, updateTransaction, deleteTransaction } = useStore();
  const legs = tx?.transferId ? allTransactions.filter((t) => t.transferId === tx.transferId) : tx ? [tx] : [];
  const out = legs.find((l) => l.transferRole === "out");
  const inn = legs.find((l) => l.transferRole === "in");
  return (
    <Dialog open={!!tx} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader><DialogTitle>Why isn’t this counted?</DialogTitle></DialogHeader>
        {tx && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{inr(Math.abs(tx.amount))} moved between your own accounts. It isn’t income and it isn’t spending, so your totals, budgets and savings rate ignore it. Account balances still include it.</p>
            <div className="rounded-xl border p-3 space-y-1 text-xs">
              {out && <div>Out: <b>{out.title}</b></div>}
              {inn && <div>In: <b>{inn.title}</b></div>}
              {!out && !inn && <div><b>{tx.title}</b></div>}
            </div>
            <div className="flex gap-2">
              <button onClick={async () => { for (const l of legs) await updateTransaction(clearTransfer(l)); onClose(); }} className="flex-1 h-11 rounded-xl border font-bold text-sm active:scale-95">Not a transfer — count it</button>
              <button onClick={async () => { for (const l of legs) await deleteTransaction(l.id); onClose(); }} className="px-4 h-11 rounded-xl border border-rose-200 text-rose-700 font-bold text-sm active:scale-95">Delete</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** From / To pickers shared by the Quick Add transfer tab. */
export function TransferPicker({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  const accounts = useAccounts();
  const options = [...accounts.map((a) => ({ id: a.id, label: acctLabel(a) })), { id: CASH, label: "Cash in hand" }];
  const cls = "w-full h-11 rounded-xl border border-border bg-background px-3 text-sm";
  return (
    <div className="space-y-2 mb-4">
      <div className="grid grid-cols-2 gap-2">
        <div><div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">From</div>
          <select value={from} onChange={(e) => onFrom(e.target.value)} className={cls}><option value="">Choose</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
        <div><div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">To</div>
          <select value={to} onChange={(e) => onTo(e.target.value)} className={cls}><option value="">Choose</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
      </div>
      {from && from === to && <div className="text-xs text-rose-600">Choose two different places</div>}
      <div className="text-[11px] text-muted-foreground">Moving your own money isn’t income or spending, so it won’t change your totals.</div>
    </div>
  );
}

export const transferLabelFor = (accounts: Acct[], id: string) => (id === CASH ? "Cash in hand" : (() => { const a = accounts.find((x) => x.id === id); return a ? acctLabel(a) : undefined; })());
