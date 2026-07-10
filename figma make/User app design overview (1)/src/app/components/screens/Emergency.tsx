import { Shield, Briefcase, TrendingDown, Stethoscope, Flame } from "lucide-react";
import { financial } from "../../data";
import { Header, Screen } from "../Shell";
import { inr } from "../types";

const scenarios = [
  { id: "1", icon: Briefcase, label: "If salary stops", months: 6.2, tone: "ok" },
  { id: "2", icon: TrendingDown, label: "If income drops 25%", months: 14.8, tone: "ok" },
  { id: "3", icon: Stethoscope, label: "Medical emergency ₹1L", months: 3.4, tone: "warn" },
  { id: "4", icon: Flame, label: "Rent increases 20%", months: 5.1, tone: "ok" },
];

export function Emergency({ onBack }: { onBack: () => void }) {
  return (
    <>
      <Header title="Emergency Survival" subtitle="Stress test your finances" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-6 text-center">
            <Shield className="size-7 mx-auto mb-2 text-white/80" />
            <div className="text-white/80 text-sm">If your income stops today</div>
            <div className="font-display my-2" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1 }}>
              {financial.emergencyMonths}<span style={{ fontSize: 20 }} className="text-white/70"> months</span>
            </div>
            <div className="inline-flex items-center text-sm bg-white/15 px-3 py-1 rounded-full" style={{ fontWeight: 600 }}>
              Safe zone — aim for 6+
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl p-4 border border-border/60">
              <div className="text-xs text-muted-foreground">Emergency fund</div>
              <div className="font-display mt-1" style={{ fontSize: 18, fontWeight: 700 }}>{inr(financial.emergencyFund)}</div>
            </div>
            <div className="bg-card rounded-2xl p-4 border border-border/60">
              <div className="text-xs text-muted-foreground">Burn rate</div>
              <div className="font-display mt-1" style={{ fontSize: 18, fontWeight: 700 }}>{inr(financial.burnRate)}<span className="text-xs text-muted-foreground"> /mo</span></div>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1" style={{ fontWeight: 600 }}>Scenario simulator</div>
            <div className="space-y-2">
              {scenarios.map((s) => {
                const tone = s.tone === "ok" ? "text-emerald-600" : "text-amber-600";
                return (
                  <button key={s.id} className="w-full bg-card rounded-2xl p-4 border border-border/60 flex items-center gap-3 hover:border-primary/40 transition">
                    <div className="size-10 rounded-xl bg-muted flex items-center justify-center">
                      <s.icon className="size-4" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm" style={{ fontWeight: 600 }}>{s.label}</div>
                      <div className="text-xs text-muted-foreground">Tap to simulate</div>
                    </div>
                    <div className={`text-right ${tone}`}>
                      <div className="font-display" style={{ fontSize: 17, fontWeight: 700 }}>{s.months}m</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Screen>
    </>
  );
}
