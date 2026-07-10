import { Plus } from "lucide-react";
import { budgets } from "../../data";
import { Header, Screen } from "../Shell";
import { inr } from "../types";

export function Budgets({ onBack }: { onBack: () => void }) {
  const spent = budgets.reduce((s, b) => s + b.spent, 0);
  const limit = budgets.reduce((s, b) => s + b.limit, 0);

  return (
    <>
      <Header title="Budgets" subtitle="June 2026" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="bg-card rounded-2xl p-5 border border-border/60">
            <div className="flex justify-between items-baseline">
              <div>
                <div className="text-xs text-muted-foreground">Total spent this month</div>
                <div className="font-display mt-1" style={{ fontSize: 28, fontWeight: 700 }}>{inr(spent)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">of {inr(limit)}</div>
                <div className="text-sm text-emerald-600" style={{ fontWeight: 600 }}>{inr(limit - spent)} left</div>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mt-4">
              <div className="h-full bg-primary rounded-full" style={{ width: `${(spent / limit) * 100}%` }} />
            </div>
          </div>

          <button className="w-full rounded-2xl border-2 border-dashed border-border text-muted-foreground py-3 flex items-center justify-center gap-2">
            <Plus className="size-4" />
            <span className="text-sm" style={{ fontWeight: 600 }}>Add category budget</span>
          </button>

          <div className="space-y-2.5">
            {budgets.map((b) => {
              const p = (b.spent / b.limit) * 100;
              const over = p >= 90;
              return (
                <div key={b.category} className="bg-card rounded-2xl p-4 border border-border/60">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm" style={{ fontWeight: 600 }}>{b.category}</span>
                    <span className="text-xs text-muted-foreground">
                      <span className="text-foreground" style={{ fontWeight: 700 }}>{inr(b.spent)}</span> / {inr(b.limit)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(p, 100)}%`, background: over ? "#F59E0B" : b.color }} />
                  </div>
                  {over && <div className="text-xs text-amber-600 mt-1.5" style={{ fontWeight: 600 }}>⚠ {p.toFixed(0)}% used — slow down</div>}
                </div>
              );
            })}
          </div>
        </div>
      </Screen>
    </>
  );
}
