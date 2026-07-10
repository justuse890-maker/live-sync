import { Shield, Plane, Bike, Home, Plus, Sparkles } from "lucide-react";
import { goals } from "../../data";
import { Header, Screen } from "../Shell";
import { inr } from "../types";

const iconMap = { Shield, Plane, Bike, Home } as Record<string, any>;

export function Goals() {
  const total = goals.reduce((s, g) => s + g.current, 0);
  const target = goals.reduce((s, g) => s + g.target, 0);
  const pct = (total / target) * 100;

  return (
    <>
      <Header title="Goals" subtitle={`${goals.length} active`} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-5">
            <div className="text-white/70 text-xs uppercase tracking-wider">Total saved towards goals</div>
            <div className="font-display mt-1" style={{ fontSize: 28, fontWeight: 700 }}>{inr(total)}</div>
            <div className="text-white/80 text-sm">of {inr(target)} target</div>
            <div className="h-2 bg-white/20 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <button className="w-full rounded-2xl border-2 border-dashed border-border text-muted-foreground py-3 flex items-center justify-center gap-2 hover:bg-card transition">
            <Plus className="size-4" />
            <span className="text-sm" style={{ fontWeight: 600 }}>Create a new goal</span>
          </button>

          <div className="space-y-3">
            {goals.map((g) => {
              const Icon = iconMap[g.icon];
              const p = (g.current / g.target) * 100;
              const remaining = g.target - g.current;
              return (
                <div key={g.id} className="bg-card rounded-2xl p-4 border border-border/60">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="size-11 rounded-xl flex items-center justify-center" style={{ background: g.color + "15", color: g.color }}>
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm" style={{ fontWeight: 700 }}>{g.name}</div>
                      <div className="text-xs text-muted-foreground">by {g.deadline}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm" style={{ fontWeight: 700 }}>{p.toFixed(0)}%</div>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full" style={{ width: `${p}%`, background: g.color }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span><span className="text-foreground" style={{ fontWeight: 600 }}>{inr(g.current)}</span> saved</span>
                    <span>{inr(remaining)} to go</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/60 flex items-start gap-2">
                    <Sparkles className="size-3.5 text-primary mt-0.5" />
                    <div className="text-xs text-muted-foreground flex-1">
                      Save <span className="text-foreground" style={{ fontWeight: 600 }}>{inr(Math.round(remaining / 8))}/mo</span> to hit this goal on time.
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Screen>
    </>
  );
}
