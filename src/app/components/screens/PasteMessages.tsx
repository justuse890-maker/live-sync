import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardPaste, Check, ChevronDown, ChevronUp, Info, Lock } from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { useStore } from "../../store";
import { api } from "../../lib/api";
import { todayISO } from "../../lib/dateUtils";
import { ParsedMessage, Skipped, findDuplicates, matchInstrument, parsePasted } from "../../lib/messageParser";
import { notify } from "../../lib/notify";
import { takeSharedText } from "../../lib/shareTarget";

type Draft = ParsedMessage & { include: boolean; duplicate: boolean; accountId?: string; creditCardId?: string };
type Acct = { id: string; bank: string; maskedNumber?: string };

const field = "w-full h-10 rounded-lg border border-border bg-background px-2.5 text-sm";

export function PasteMessages({ onBack }: { onBack: () => void }) {
  const { allTransactions, categories, creditCards, addTransaction, addTransfer } = useStore();
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [skipped, setSkipped] = useState<Skipped[]>([]);
  const [showSkipped, setShowSkipped] = useState(false);
  const [accounts, setAccounts] = useState<Acct[]>([]);
  const [busy, setBusy] = useState(false);
  const [clipErr, setClipErr] = useState<string | null>(null);

  const [acctsLoaded, setAcctsLoaded] = useState(false);
  const [autoRead, setAutoRead] = useState(false);

  useEffect(() => { api.list<Acct>("accounts").then((a) => setAccounts(a || [])).catch(() => {}).finally(() => setAcctsLoaded(true)); }, []);

  // Text shared into LiveSync from another app lands here, already read and ready to review.
  useEffect(() => { const shared = takeSharedText(); if (shared) { setText(shared); setAutoRead(true); } }, []);
  useEffect(() => { if (autoRead && acctsLoaded && text) { setAutoRead(false); read(); } }, [autoRead, acctsLoaded, text]); // eslint-disable-line react-hooks/exhaustive-deps

  const pasteFromClipboard = async () => {
    setClipErr(null);
    try { setText(await navigator.clipboard.readText()); }
    catch { setClipErr("Couldn't read the clipboard. Touch and hold in the box, then choose Paste."); }
  };

  const read = () => {
    const res = parsePasted(text);
    const dups = findDuplicates(res.messages, allTransactions);
    setDrafts(res.messages.map((m, i) => ({ ...m, ...matchInstrument(m, accounts, creditCards), duplicate: dups.has(i), include: !dups.has(i) })));
    setSkipped(res.skipped);
  };

  const patch = (i: number, p: Partial<Draft>) => setDrafts((d) => d && d.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const selected = drafts?.filter((d) => d.include) ?? [];
  const label = (d: Draft) => {
    const a = accounts.find((x) => x.id === d.accountId); const c = creditCards.find((x) => x.id === d.creditCardId);
    return a ? `${a.bank} ${a.maskedNumber ?? ""}`.trim() : c ? `${c.bankName} card ••${c.last4Digits}` : d.last4 ? `Account/card ••${d.last4}` : null;
  };
  const total = useMemo(() => selected.filter((d) => d.kind !== "cash_withdrawal").reduce((s, d) => s + (d.direction === "credit" ? d.amount : -d.amount), 0), [selected]);

  const save = async () => {
    if (!selected.length || busy) return;
    setBusy(true);
    try {
      for (const d of selected) {
        const date = d.date ?? todayISO();
        if (d.kind === "cash_withdrawal") {
          await addTransfer({ amount: d.amount, date, fromAccountId: d.accountId, toAccountId: undefined, fromLabel: label(d) ?? "Bank account", toLabel: "Cash in hand" });
          continue;
        }
        const income = d.kind === "income";
        const category = income ? (d.category || "Income") : (d.category || "Other");
        await addTransaction({
          title: d.merchant || category, merchant: d.merchant, category,
          amount: income ? d.amount : -d.amount, type: income ? "income" : "expense", date,
          accountId: d.accountId, creditCardId: d.creditCardId,
          payments: income ? undefined : [{ mode: d.creditCardId ? "credit" : d.instrument === "upi" ? "upi" : "debit", amount: d.amount }],
          notes: `From bank alert${d.ref ? ` · Ref ${d.ref}` : ""}`,
        } as any, { silent: true });
      }
      notify.info(`${selected.length} ${selected.length === 1 ? "entry" : "entries"} added`);
      setDrafts(null); setText(""); setSkipped([]);
    } finally { setBusy(false); }
  };

  return (
    <>
      <Header title="Add from messages" subtitle="You choose what to paste" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 pb-28 space-y-4">
          <div className="rounded-2xl bg-card border border-emerald-200 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Lock className="size-4 text-emerald-600" /> We never read your inbox</div>
            <p className="text-xs text-slate-600 leading-relaxed">Copy bank or UPI alerts from your Messages app, paste them here, and LiveSync turns them into entries on this phone. Only the last four digits of an account are kept.</p>
          </div>

          {!drafts && (
            <div className="space-y-3">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={"Paste one or many alerts. Separate them with a blank line.\n\nRs.250.00 debited from a/c XX1234 on 10-10-26 to VPA chai@ybl (UPI Ref No 628199301234)."} className="w-full rounded-xl border border-border bg-background p-3 text-sm leading-relaxed" />
              {clipErr && <div className="text-xs text-amber-700">{clipErr}</div>}
              <div className="flex gap-2">
                <button onClick={pasteFromClipboard} className="flex-1 h-11 rounded-xl border font-bold text-sm flex items-center justify-center gap-1.5"><ClipboardPaste className="size-4" /> Paste</button>
                <button onClick={read} disabled={!text.trim()} className="flex-[2] h-11 rounded-xl bg-[#1E3A8A] text-white font-bold text-sm disabled:opacity-40">Read messages</button>
              </div>
            </div>
          )}

          {drafts && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900">{drafts.length} found{skipped.length ? ` · ${skipped.length} skipped` : ""}</span>
                <button onClick={() => { setDrafts(null); setSkipped([]); }} className="text-primary font-semibold">Back to text</button>
              </div>

              {drafts.length === 0 && <p className="text-sm text-muted-foreground">No transactions found. Alerts need an amount and the word debited, credited, spent, received or similar.</p>}

              {drafts.map((d, i) => (
                <div key={i} className={`rounded-2xl border p-3.5 space-y-2.5 ${d.include ? "bg-card border-border/60" : "bg-muted/40 border-border/40"}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={d.include} onChange={(e) => patch(i, { include: e.target.checked })} className="mt-1.5 size-4" aria-label="Include this entry" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className={`text-lg font-black ${d.direction === "credit" ? "text-emerald-700" : "text-slate-900"}`}>{d.direction === "credit" ? "+" : "−"}{inr(d.amount)}</div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">{d.kind === "cash_withdrawal" ? "Cash withdrawal" : d.direction === "credit" ? "Money in" : "Spent"} · {d.date ?? "today"}</span>
                      </div>
                      {label(d) && <div className="text-[11px] text-muted-foreground">{label(d)}</div>}
                    </div>
                  </div>

                  {d.kind === "cash_withdrawal" ? (
                    <div className="text-[11px] text-sky-800 bg-sky-50 border border-sky-200 rounded-lg p-2">Saved as money moved to cash — not spending. Record the spending when you spend the cash.</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <input className={field} value={d.merchant ?? ""} onChange={(e) => patch(i, { merchant: e.target.value })} placeholder="Merchant / person" aria-label="Merchant" />
                      <select className={field} value={d.category ?? (d.kind === "income" ? "Income" : "Other")} onChange={(e) => patch(i, { category: e.target.value })} aria-label="Category">
                        {[...new Set([d.category ?? (d.kind === "income" ? "Income" : "Other"), ...categories.filter((c) => c !== "All")])].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}

                  {d.duplicate && <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2"><AlertTriangle className="size-3.5 mt-px shrink-0" />Looks like an entry you already have. Left unticked — tick it if it’s a different payment.</div>}
                  {d.warnings.map((w) => <div key={w} className="flex items-start gap-1.5 text-[11px] text-slate-600"><Info className="size-3.5 mt-px shrink-0" />{w}</div>)}
                </div>
              ))}

              {skipped.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-card">
                  <button onClick={() => setShowSkipped((v) => !v)} className="w-full flex items-center justify-between p-3 text-xs font-semibold text-slate-700">
                    <span>{skipped.length} skipped</span>{showSkipped ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>
                  {showSkipped && <div className="divide-y border-t">{skipped.map((s, i) => <div key={i} className="p-3 text-[11px]"><div className="font-bold text-slate-800">{s.reason}</div><div className="text-muted-foreground line-clamp-2">{s.raw}</div></div>)}</div>}
                </div>
              )}

              {drafts.length > 0 && (
                <button onClick={save} disabled={!selected.length || busy} className="w-full h-12 rounded-xl bg-[#1E3A8A] text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98]">
                  <Check className="size-4" /> Save {selected.length} {selected.length === 1 ? "entry" : "entries"}{selected.length > 0 ? ` · net ${total < 0 ? "−" : "+"}${inr(Math.abs(total))}` : ""}
                </button>
              )}
            </div>
          )}
        </div>
      </Screen>
    </>
  );
}
