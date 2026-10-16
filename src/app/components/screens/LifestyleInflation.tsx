import { useMemo } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import { lifestyleInflation, categoryInflation } from "../../lib/intelligence";
import { wantsSeries, wantsVerdict, WANTS_NUDGE_GAP_PCT } from "../../lib/wantsTrend";

export function LifestyleInflation({ onBack }: { onBack: () => void }) {
  const { transactions } = useStore();
  const r = useMemo(() => lifestyleInflation(transactions), [transactions]);
  const catInflation = useMemo(() => categoryInflation(transactions), [transactions]);
  const warning = r.verdict === "outpacing";
  const wants = useMemo(() => wantsSeries(transactions), [transactions]);
  const wv = useMemo(() => wantsVerdict(wants), [wants]);
  const wantsMax = Math.max(40, ...wants.map((m) => m.sharePct ?? 0));

  return (
    <>
      <Header title="Lifestyle Inflation" subtitle="Income vs expense growth" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className={`rounded-2xl p-5 text-white ${warning ? "bg-gradient-to-br from-amber-600 to-rose-600" : "bg-gradient-to-br from-emerald-600 to-teal-700"}`}>
            <div className="flex items-center gap-2">
              {warning ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />}
              <div className="text-sm" style={{ fontWeight: 700 }}>{warning ? "Expenses are outpacing income" : r.verdict === "disciplined" ? "Disciplined — expenses growing slower" : "Balanced growth"}</div>
            </div>
            <p className="text-xs text-white/90 mt-2 leading-relaxed">
              Comparing last 3 months vs the previous 3. Sustainable wealth-building requires expense growth ≤ income growth.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metric label="Income growth" value={`${r.incomeGrowth.toFixed(1)}%`} sub={`${inr(Math.round(r.oldIncome))} → ${inr(Math.round(r.recIncome))}`} positive={r.incomeGrowth >= 0} />
            <Metric label="Expense growth" value={`${r.expenseGrowth.toFixed(1)}%`} sub={`${inr(Math.round(r.oldExp))} → ${inr(Math.round(r.recExp))}`} positive={r.expenseGrowth <= r.incomeGrowth} />
          </div>

          <div className="bg-card rounded-2xl p-4 border border-border/60">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-3" style={{ fontWeight: 600 }}>The gap</div>
            <div className="flex items-end gap-3 mb-2">
              <div className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>{r.gap > 0 ? "+" : ""}{r.gap.toFixed(1)}%</div>
              <div className={`text-xs mb-1 ${warning ? "text-rose-600" : "text-emerald-600"}`} style={{ fontWeight: 600 }}>{warning ? "Lifestyle inflation" : "On track"}</div>
            </div>
            <Bar incomeGrowth={r.incomeGrowth} expenseGrowth={r.expenseGrowth} />
          </div>

          {/* Lifestyle share of income, 12 months */}
          {wants.some((m) => m.sharePct !== null) && (
            <div className="bg-card rounded-2xl p-4 border border-border/60 space-y-3">
              <div>
                <div className="text-sm" style={{ fontWeight: 700 }}>Lifestyle spending as a share of income</div>
                <div className="text-[11px] text-muted-foreground">Dining, shopping, travel and fun, month by month. Guideline: 30% or less.</div>
              </div>
              <div className="relative flex items-end gap-1 h-24" role="img" aria-label="Lifestyle share of income for the last twelve months">
                <div className="absolute inset-x-0 border-t border-dashed border-amber-400/70" style={{ bottom: `${(30 / wantsMax) * 100}%` }} title="30% guideline" />
                {wants.map((m) => (
                  <div key={m.key} className="relative flex-1 h-full flex flex-col items-center justify-end min-w-0" title={`${m.key}: ${m.sharePct === null ? "no income" : m.sharePct.toFixed(0) + "%"}`}>
                    <div className={`w-full rounded-t ${m.sharePct !== null && m.sharePct > 30 ? "bg-amber-500" : "bg-sky-600/80"} min-h-[2px]`} style={{ height: `${m.sharePct === null ? 0 : (m.sharePct / wantsMax) * 100}%` }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground"><span>{wants[0].key}</span><span>{wants[wants.length - 1].key}</span></div>
              {wv.verdict === "outpacing" && <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-snug">Lifestyle spending grew <b>{wv.wantsGrowthPct!.toFixed(0)}%</b> while income grew <b>{wv.incomeGrowthPct!.toFixed(0)}%</b> (latest six months vs the six before) — more than {WANTS_NUDGE_GAP_PCT} points ahead. Worth a look before it becomes the new normal.</div>}
              {wv.verdict === "easing" && <div className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl p-3">Lifestyle spending is growing slower than income. Nicely done.</div>}
              {wv.verdict === "not_enough_data" && <div className="text-[11px] text-muted-foreground">Needs about two months of income in each half of the year to compare growth.</div>}
            </div>
          )}

          {/* Per-category Inflation Breakdown */}
          {catInflation.length > 0 && (
            <div className="bg-card rounded-2xl p-4 border border-border/60 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="size-4 text-primary" />
                <div className="text-sm" style={{ fontWeight: 700 }}>Which categories are inflating?</div>
              </div>
              <div className="text-[11px] text-muted-foreground mb-2">
                Comparing avg monthly spend: last 3 months vs prior 3 months
              </div>
              <div className="divide-y divide-border/40">
                {catInflation.slice(0, 8).map((c) => {
                  const isUp = c.growthPct > 5;
                  const isDown = c.growthPct < -5;
                  return (
                    <div key={c.category} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className={`size-7 rounded-lg flex items-center justify-center ${isUp ? "bg-rose-50 text-rose-600" : isDown ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"}`}>
                          {isUp ? <ArrowUpRight className="size-3.5" /> : isDown ? <ArrowDownRight className="size-3.5" /> : <Minus className="size-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">{c.category}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {inr(Math.round(c.olderAvg))}/mo → {inr(Math.round(c.recentAvg))}/mo
                          </div>
                        </div>
                      </div>
                      <div className={`text-xs font-extrabold ${isUp ? "text-rose-600" : isDown ? "text-emerald-600" : "text-slate-500"}`}>
                        {c.growthPct > 0 ? "+" : ""}{c.growthPct.toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-card rounded-2xl p-4 border border-border/60">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="size-4 text-primary" />
              <div className="text-sm" style={{ fontWeight: 700 }}>What to do</div>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <li>• Hold expense growth ≤ income growth — channel raises into investments, not lifestyle.</li>
              <li>• Run Wealth Leakage to find silent monthly drags.</li>
              <li>• Set a savings-rate floor (e.g. 30%) and check it each month.</li>
              <li>• Check Spending Patterns to see which merchants are creeping up.</li>
            </ul>
          </div>
        </div>
      </Screen>
    </>
  );
}

function Metric({ label, value, sub, positive }: { label: string; value: string; sub: string; positive: boolean }) {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border/60">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`font-display mt-1 ${positive ? "text-emerald-600" : "text-rose-600"}`} style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function Bar({ incomeGrowth, expenseGrowth }: { incomeGrowth: number; expenseGrowth: number }) {
  const max = Math.max(10, Math.abs(incomeGrowth), Math.abs(expenseGrowth));
  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs text-muted-foreground mb-1">Income</div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${(Math.max(0, incomeGrowth) / max) * 100}%` }} />
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-1">Expense</div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-rose-500" style={{ width: `${(Math.max(0, expenseGrowth) / max) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

