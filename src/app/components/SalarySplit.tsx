import { useMemo, useState } from "react";
import { Wallet, Undo2, AlertTriangle } from "lucide-react";
import { CountUp, SuccessBurst } from "./FlowFx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useStore } from "../store";
import { inr } from "./types";
import { sanitizeAmountInput } from "../lib/currencyUtils";
import { getCurrentMonthKey, formatMonthName } from "../lib/dateUtils";
import { planSalarySplit, suggestedSalary, BUCKET_KINDS } from "../lib/salarySplit";

const SPLIT_COLORS = ["#1E3A8A", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#F43F5E"];

/** Divide a salary across buckets by the % each one was given. Nothing moves until the user confirms; every step can be undone. */
export function SalarySplitSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { buckets, transactions, bucketContributions, addBucketContribution } = useStore();
  const monthKey = getCurrentMonthKey();
  const marker = `Salary split ${monthKey}`;
  const active = buckets.filter((b) => b.status === "active");
  const suggested = useMemo(() => suggestedSalary(transactions, monthKey), [transactions, monthKey]);
  const [raw, setRaw] = useState<string>("");
  const [applied, setApplied] = useState<Array<{ id: string; name: string; amount: number }> | null>(null);
  const [busy, setBusy] = useState(false);

  const salary = Number(raw !== "" ? raw : suggested ?? 0) || 0;
  const plan = useMemo(() => planSalarySplit(salary, active), [salary, active]);
  // Net of reversals: a split that was undone no longer counts, a split redone after an undo does.
  const alreadyDone = bucketContributions
    .filter((c) => (c.note || "") === marker || (c.note || "") === `Undo ${marker}`)
    .reduce((sum, c) => sum + c.amount, 0) > 0;

  const close = () => { setApplied(null); setRaw(""); onClose(); };

  const confirm = async () => {
    if (plan.problem || busy) return;
    setBusy(true);
    try {
      for (const r of plan.rows) if (r.amount > 0) await addBucketContribution(r.id, r.amount, marker);
      setApplied(plan.rows.filter((r) => r.amount > 0).map((r) => ({ id: r.id, name: r.name, amount: r.amount })));
    } finally { setBusy(false); }
  };

  const undo = async () => {
    if (!applied || busy) return;
    setBusy(true);
    try {
      for (const r of applied) await addBucketContribution(r.id, -r.amount, `Undo ${marker}`);
      setApplied(null);
    } finally { setBusy(false); }
  };

  const kindLabel = (id: string) => {
    const b = active.find((x) => x.id === id);
    return BUCKET_KINDS.find((k) => k.id === b?.kind)?.label;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Wallet className="size-4" /> Give every rupee a home</DialogTitle></DialogHeader>
        {applied ? (
          <div className="space-y-3">
            <SuccessBurst />
            <div className="text-center text-emerald-700 font-bold text-sm ls-rise">{formatMonthName(monthKey)} salary split</div>
            <div className="rounded-xl border divide-y text-sm">
              {applied.map((r, i) => (
                <div key={r.id} className="ls-row-in flex justify-between px-3 py-2" style={{ ["--i" as string]: i + 2 }}>
                  <span>{r.name}</span><b><CountUp value={r.amount} format={(n) => inr(Math.round(n))} /></b>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">This earmarks money inside LiveSync. It does not move money in your bank — do that yourself, or set a standing instruction with your bank.</p>
            <div className="flex gap-2">
              <button onClick={close} className="flex-1 h-11 rounded-xl bg-[#1E3A8A] text-white font-bold text-sm">Done</button>
              <button onClick={undo} disabled={busy} className="px-4 h-11 rounded-xl border font-bold text-sm flex items-center gap-1.5 disabled:opacity-40"><Undo2 className="size-4" /> Undo</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Salary / income to split (₹)</label>
              <input inputMode="decimal" value={raw} onChange={(e) => setRaw(sanitizeAmountInput(e.target.value))} placeholder={suggested ? String(suggested) : "e.g. 120000"} className="mt-1 w-full h-12 rounded-xl border border-border bg-background px-3 text-lg font-bold" />
              {suggested && raw === "" && <div className="text-[11px] text-muted-foreground mt-1">Using your {formatMonthName(monthKey)} salary entry. Type to change.</div>}
            </div>

            {alreadyDone && (
              <div className="flex items-start gap-2 text-[11px] bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-2.5"><AlertTriangle className="size-3.5 mt-0.5 shrink-0" />You already split this month’s salary. Splitting again adds the amounts a second time.</div>
            )}

            {plan.problem === "no_allocations" && <p className="text-sm text-muted-foreground">None of your buckets has a “% of salary” yet. Edit a bucket (or create one) and set its share — for example Rent 30%, SIP 20%.</p>}
            {plan.problem === "over_100" && <p className="text-sm text-rose-700">Your buckets add up to {plan.allocatedPct.toFixed(0)}% of salary. Bring it to 100% or less.</p>}
            {plan.problem === "no_salary" && <p className="text-sm text-muted-foreground">Enter the amount to split.</p>}

            {!plan.problem && (
              <>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-muted" role="img" aria-label="How the salary is divided across buckets">
                  {plan.rows.map((r, i) => (
                    <div key={r.id} className="ls-fill-x h-full" style={{ ["--w" as string]: `${r.pct}%`, ["--d" as string]: `${i * 80}ms`, background: SPLIT_COLORS[i % SPLIT_COLORS.length] }} />
                  ))}
                </div>
                <div className="rounded-xl border divide-y text-sm">
                  {plan.rows.map((r, i) => (
                    <div key={r.id} className="ls-row-in flex items-center justify-between px-3 py-2" style={{ ["--i" as string]: i }}>
                      <span className="min-w-0 truncate"><span className="inline-block size-2 rounded-full mr-1.5" style={{ background: SPLIT_COLORS[i % SPLIT_COLORS.length] }} />{r.name} <span className="text-[11px] text-muted-foreground">{kindLabel(r.id) ? `· ${kindLabel(r.id)} · ` : "· "}{r.pct}%</span></span>
                      <b><CountUp value={r.amount} format={(n) => inr(Math.round(n))} ms={450} /></b>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/40 text-xs">
                    <span className="text-muted-foreground">Left unassigned ({(100 - plan.allocatedPct).toFixed(0)}%)</span><b>{inr(plan.unallocated)}</b>
                  </div>
                </div>
                <button onClick={confirm} disabled={busy} className="w-full h-12 rounded-xl bg-[#1E3A8A] text-white font-bold disabled:opacity-40 active:scale-[0.98]">{busy ? "Splitting…" : "Split into buckets"}</button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
