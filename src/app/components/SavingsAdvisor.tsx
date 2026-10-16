import { useEffect, useMemo, useState } from "react";
import { Landmark, Mail, Shield, TrendingUp, Check, Info } from "lucide-react";
import { api } from "../lib/api";
import { inr } from "./types";
import { monthsUntil, RATES_AS_OF, recommend, SavingsPlan, Recommendation } from "../lib/savingsAdvisor";

const providerIcon = { Bank: Landmark, "Post Office": Mail, "Government scheme": Shield, "Mutual fund": TrendingUp } as const;

type Account = { id: string; bank: string; maskedNumber?: string; accountType?: string };

/**
 * "Where should this goal's money live?" — ranked, plain-language options for THIS goal's amount and deadline.
 * Picking one stores a SavingsPlan on the goal and can pre-fill the monthly target.
 */
export function SavingsAdvisor({
  name, targetAmount, targetDate, plan, onPlan, onUseMonthly,
}: {
  name: string; targetAmount: number; targetDate?: string;
  plan?: SavingsPlan; onPlan: (p: SavingsPlan | undefined) => void; onUseMonthly: (n: number) => void;
}) {
  const months = monthsUntil(targetDate);
  const recs = useMemo(() => (targetAmount > 0 ? recommend({ name, targetAmount, monthsLeft: months }) : []), [name, targetAmount, months]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api.list<Account>("accounts").then((a) => setAccounts(a.filter((x) => x.accountType !== "Credit Card"))).catch(() => {}); }, []);

  if (recs.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">Enter a target amount to see where it is smartest to save it.</div>;
  }

  const choose = (r: Recommendation) =>
    onPlan(plan?.vehicleId === r.vehicle.id ? undefined : { vehicleId: r.vehicle.id, provider: r.vehicle.provider, ratePA: r.vehicle.ratePA, ratesAsOf: RATES_AS_OF, accountId: plan?.accountId });

  return (
    <div className="rounded-2xl border border-border p-3.5 space-y-3">
      <div>
        <div className="text-sm font-bold">Where should you save this?</div>
        <div className="text-[11px] text-muted-foreground">
          {months ? `${months} month${months === 1 ? "" : "s"} to go · ${inr(targetAmount)} target` : "No date set — showing options for about 2 years. Add a target date for sharper advice."}
        </div>
      </div>

      <div className="space-y-2">
        {recs.map((r) => {
          const Icon = providerIcon[r.vehicle.provider];
          const selected = plan?.vehicleId === r.vehicle.id;
          const expanded = open === r.vehicle.id;
          return (
            <div key={r.vehicle.id} className={`rounded-2xl border p-3 transition-colors ${selected ? "border-primary bg-primary/[0.04]" : "border-border"}`}>
              <button type="button" onClick={() => setOpen(expanded ? null : r.vehicle.id)} className="w-full text-left flex items-start gap-3">
                <span className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0"><Icon className="size-4" /></span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold">{r.vehicle.name}</span>
                    {r.badge && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{r.badge}</span>}
                  </span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    {r.vehicle.provider} · {r.vehicle.ratePA}% p.a.{r.vehicle.risk === "Market-linked" ? " (illustrative, not guaranteed)" : " guaranteed"} · {r.vehicle.liquidity}
                  </span>
                </span>
              </button>

              {expanded && (
                <div className="mt-3 space-y-2 text-xs">
                  <p className="leading-relaxed">{r.reason}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Fact label="Lock-in" value={r.vehicle.lockIn} />
                    <Fact label="Safety" value={r.vehicle.safety} />
                    <Fact label="Tax" value={r.vehicle.tax} />
                    {months ? <Fact label="Save per month" value={`${inr(r.monthlyNeeded)}${r.extraEarned > 0 ? ` (earns ~${inr(r.extraEarned)} extra)` : ""}`} /> : null}
                  </div>
                  {r.vehicle.note && <p className="text-muted-foreground flex gap-1.5"><Info className="size-3.5 shrink-0 mt-0.5" />{r.vehicle.note}</p>}
                </div>
              )}

              <div className="mt-2.5 flex gap-2">
                <button type="button" onClick={() => choose(r)} className={`flex-1 rounded-full py-2 text-xs font-semibold ${selected ? "bg-primary text-primary-foreground" : "border border-border"}`}>
                  {selected ? <span className="inline-flex items-center gap-1"><Check className="size-3.5" /> Selected</span> : "Use this"}
                </button>
                {months ? (
                  <button type="button" onClick={() => onUseMonthly(r.monthlyNeeded)} className="rounded-full border border-border px-3 py-2 text-xs font-semibold">
                    Save {inr(r.monthlyNeeded)}/mo
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {plan && accounts.length > 0 && (
        <label className="block">
          <span className="text-xs text-muted-foreground font-bold">Money will sit in (optional)</span>
          <select value={plan.accountId ?? ""} onChange={(e) => onPlan({ ...plan, accountId: e.target.value || undefined })} className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none">
            <option value="">I'll decide later</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.bank}{a.maskedNumber ? ` ${a.maskedNumber}` : ""}</option>)}
          </select>
        </label>
      )}

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Indicative rates for {RATES_AS_OF}. Government scheme rates reset every quarter and banks change theirs anytime — confirm with the bank or post office before depositing.
        General information, not personal investment advice. Market-linked options can lose value.
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</div>
      <div className="text-[11px] mt-0.5 leading-snug">{value}</div>
    </div>
  );
}
