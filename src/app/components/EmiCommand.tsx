import { useMemo, useState } from "react";
import { Gauge, TrendingDown, Calculator, Info } from "lucide-react";
import { inr } from "./types";
import { CountUp } from "./FlowFx";
import { sanitizeAmountInput } from "../lib/currencyUtils";
import {
  DEFAULT_EMI_ALERT_PCT, emiBurden, emiOutflowTimeline, prepaymentImpact,
} from "../lib/emiPlanner";
import type { StructuredLoan } from "../store";

const ALERT_KEY = "ls_emi_alert_pct";
export const readEmiAlertPct = (): number => {
  try {
    const v = Number(localStorage.getItem(ALERT_KEY));
    return v >= 10 && v <= 70 ? v : DEFAULT_EMI_ALERT_PCT;
  } catch { return DEFAULT_EMI_ALERT_PCT; }
};

const LEVEL = {
  none: { label: "No EMIs", bar: "#94A3B8", box: "bg-slate-50 border-slate-200", text: "text-slate-700" },
  healthy: { label: "Comfortable", bar: "#10B981", box: "bg-emerald-50 border-emerald-200", text: "text-emerald-800" },
  watch: { label: "Getting heavy", bar: "#F59E0B", box: "bg-amber-50 border-amber-200", text: "text-amber-800" },
  high: { label: "Over your limit", bar: "#E11D48", box: "bg-rose-50 border-rose-200", text: "text-rose-800" },
  no_income: { label: "Add income to compare", bar: "#94A3B8", box: "bg-slate-50 border-slate-200", text: "text-slate-700" },
} as const;

/** How much of monthly income is already promised to EMIs, against a limit the user can set. */
export function EmiBurdenCard({ monthlyIncome, totalEmi }: { monthlyIncome: number; totalEmi: number }) {
  const [alertPct, setAlertPct] = useState(readEmiAlertPct);
  const b = emiBurden(monthlyIncome, totalEmi, alertPct);
  const L = LEVEL[b.level];
  const pct = b.ratioPct ?? 0;

  const setLimit = (v: number) => {
    setAlertPct(v);
    try { localStorage.setItem(ALERT_KEY, String(v)); } catch { /* storage unavailable — limit resets next launch */ }
  };

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${L.box}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className={`size-4 ${L.text}`} />
          <div className="text-sm font-bold text-slate-900">EMI vs income</div>
        </div>
        <span className={`text-[11px] font-bold ${L.text}`}>{L.label}</span>
      </div>

      <div className="flex items-end justify-between">
        <div className="font-display text-2xl font-black text-slate-900">{b.ratioPct == null ? "—" : <CountUp value={pct} format={(n) => `${Math.round(n)}%`} ms={900} />}</div>
        <div className="text-[11px] text-slate-600 text-right">
          {inr(totalEmi)} of {monthlyIncome > 0 ? inr(monthlyIncome) : "no income recorded"} a month
        </div>
      </div>

      <div className="relative h-2.5 rounded-full bg-white/80 overflow-hidden">
        <div className="ls-fill-x h-full rounded-full" style={{ ["--w" as string]: `${Math.min(100, pct)}%`, ["--d" as string]: "0.15s", background: L.bar, transition: "width 0.4s var(--ease-out), background-color 0.3s" }} />
        <div className="absolute top-0 bottom-0 w-0.5 bg-slate-700/60" style={{ left: `${Math.min(100, alertPct)}%` }} title={`Your limit: ${alertPct}%`} />
      </div>

      <div className="text-xs text-slate-700 leading-snug">
        {b.level === "high" && <>You’re {Math.round(pct - alertPct)} points over your {alertPct}% limit. Prepaying the costliest loan below is the quickest way down.</>}
        {b.level === "watch" && <>You can add about <b>{inr(b.headroom)}</b> more in EMIs before crossing your {alertPct}% limit.</>}
        {b.level === "healthy" && <>Room for about <b>{inr(b.headroom)}</b> more in EMIs before your {alertPct}% limit.</>}
        {b.level === "no_income" && <>Record your salary or other income so we can tell you how heavy your EMIs are.</>}
        {b.level === "none" && <>No active EMIs recorded.</>}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-600">
        <span>My limit</span>
        <input type="range" min={20} max={60} step={1} value={alertPct} onChange={(e) => setLimit(Number(e.target.value))} className="flex-1" aria-label="EMI limit as a percentage of income" />
        <span className="font-bold w-9 text-right">{alertPct}%</span>
      </div>
      <div className="flex items-start gap-1.5 text-[10px] text-slate-500"><Info className="size-3 mt-px shrink-0" />A planning guideline, not advice. Lenders often accept 40–50% of income, but a lower share leaves more room for savings and surprises.</div>
    </div>
  );
}

/** Next 12 months of EMI outflow, one bar per month. */
export function EmiOutflow({ loans }: { loans: StructuredLoan[] }) {
  const months = useMemo(() => emiOutflowTimeline(loans, 12), [loans]);
  const max = Math.max(1, ...months.map((m) => m.total));
  if (months.every((m) => m.total === 0)) return null;
  const first = months[0].total, last = months[months.length - 1].total;
  return (
    <div className="bg-card rounded-2xl border border-border/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-slate-900">EMIs, next 12 months</div>
        {last < first && <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1"><TrendingDown className="size-3" /> Falls to {inr(last)}</span>}
      </div>
      <div className="flex items-end gap-1 h-24" role="img" aria-label="Monthly EMI outflow for the next twelve months">
        {months.map((m, i) => (
          <div key={m.monthKey} className="flex-1 h-full flex flex-col items-center justify-end gap-1 min-w-0" title={`${m.monthKey}: ${inr(m.total)}`}>
            <div className="ls-grow-y w-full rounded-t-md bg-[#1E3A8A]/80 min-h-[3px]" style={{ height: `calc(${(m.total / max) * 100}% - 18px)`, ["--d" as string]: `${i * 45}ms` }} />
            <span className="text-[9px] text-muted-foreground">{new Date(`${m.monthKey}-01T00:00:00`).toLocaleDateString("en-IN", { month: "narrow" })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const monthsLabel = (n: number) => {
  const y = Math.floor(n / 12), m = n % 12;
  return [y ? `${y} yr` : "", m ? `${m} mo` : ""].filter(Boolean).join(" ") || "0 mo";
};

/** "What if I prepay ₹X?" — both bank options side by side, from the figures on this loan. */
export function PrepaymentSimulator({ loan, balance }: { loan: StructuredLoan; balance: number }) {
  const [raw, setRaw] = useState("");
  const extra = Number(raw) || 0;
  const r = useMemo(
    () => (extra > 0 && balance > 0 ? prepaymentImpact({ balance, ratePA: loan.interestRatePA, emi: loan.emiAmount, extra }) : null),
    [extra, balance, loan.interestRatePA, loan.emiAmount],
  );
  const presets = [10_000, 50_000, 100_000, 200_000].filter((p) => p < balance);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2"><Calculator className="size-4 text-primary" /><div className="text-sm font-bold text-slate-900">Pre-closure simulator</div></div>
      {balance <= 0 || loan.emiAmount <= 0 ? (
        <div className="text-xs text-muted-foreground">Nothing outstanding to prepay.</div>
      ) : (
        <>
          <div className="text-[11px] text-muted-foreground">If you pay a lump sum now on top of your EMI (outstanding about {inr(balance)} at {loan.interestRatePA}%):</div>
          <input inputMode="numeric" placeholder="Extra amount (₹)" value={raw} onChange={(e) => setRaw(sanitizeAmountInput(e.target.value))} className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm font-bold" />
          <div className="flex gap-1.5 flex-wrap">
            {presets.map((p) => <button key={p} onClick={() => setRaw(String(p))} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border bg-muted/50 active:scale-95">{inr(p)}</button>)}
          </div>
          {extra > balance && <div className="text-[11px] text-amber-700">That’s more than the outstanding balance — we’ll use {inr(balance)}.</div>}
          {extra > 0 && !r && <div className="text-xs text-rose-700">Your EMI doesn’t cover the monthly interest at this rate, so a schedule can’t be worked out. Check the rate and EMI.</div>}
          {r && (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="ls-pop rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-1">
                <div className="text-[10px] font-bold uppercase text-emerald-700">Keep EMI · finish sooner</div>
                <div className="text-base font-black text-emerald-900"><CountUp value={Math.round(r.reduceTenure?.interestSaved ?? 0)} format={(n) => inr(Math.round(n))} /></div>
                <div className="text-[11px] text-emerald-800">interest saved · {monthsLabel(r.reduceTenure?.monthsSaved ?? 0)} earlier</div>
              </div>
              <div className="ls-pop rounded-xl bg-sky-50 border border-sky-200 p-3 space-y-1" style={{ animationDelay: "90ms" }}>
                <div className="text-[10px] font-bold uppercase text-sky-700">Keep tenure · lower EMI</div>
                <div className="text-base font-black text-sky-900"><CountUp value={Math.round(r.reduceEmi?.interestSaved ?? 0)} format={(n) => inr(Math.round(n))} /></div>
                <div className="text-[11px] text-sky-800">interest saved · EMI {inr(r.reduceEmi?.emi ?? 0)}</div>
              </div>
            </div>
          )}
          <div className="flex items-start gap-1.5 text-[10px] text-slate-500"><Info className="size-3 mt-px shrink-0" />Estimate from the rate, EMI and balance you entered. Fees and rounding differ by lender (many charge no prepayment fee on floating-rate loans to individuals, fixed-rate and business loans can) — check your lender’s statement.</div>
        </>
      )}
    </div>
  );
}
