import { useMemo } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import { lifestyleInflation, categoryInflation } from "../../lib/intelligence";

export function LifestyleInflation({ onBack }: { onBack: () => void }) {
  const { transactions } = useStore();
  const r = useMemo(() => lifestyleInflation(transactions), [transactions]);
  const catInflation = useMemo(() => categoryInflation(transactions), [transactions]);
  const warning = r.verdict === "outpacing";

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

