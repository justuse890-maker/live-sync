import { TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { financial, healthBreakdown } from "../../data";
import { Header, Screen } from "../Shell";

export function Health({ onBack }: { onBack: () => void }) {
  return (
    <>
      <Header title="Financial Health" subtitle="Updated today" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-6 text-center">
            <div className="text-white/70 text-xs uppercase tracking-wider">Overall Score</div>
            <div className="font-display my-2" style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{financial.healthScore}<span style={{ fontSize: 24 }} className="text-white/60">/100</span></div>
            <div className="inline-flex items-center gap-1.5 text-sm bg-white/15 px-3 py-1 rounded-full">
              <TrendingUp className="size-3.5" /> Good · +4 from last month
            </div>
          </div>

          <div className="space-y-2.5">
            {healthBreakdown.map((s) => (
              <div key={s.name} className="bg-card rounded-2xl p-4 border border-border/60">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm" style={{ fontWeight: 600 }}>{s.name}</span>
                  <span className="font-display" style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.score}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.score}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1" style={{ fontWeight: 600 }}>Recommendations</div>
            <div className="space-y-2">
              <Suggestion icon={<AlertTriangle className="size-4" />} tone="warning" title="Trim subscriptions" body="3 unused or duplicate subscriptions cost ₹2,473/mo." />
              <Suggestion icon={<CheckCircle2 className="size-4" />} tone="success" title="Strong budget discipline" body="You stayed under budget in 5 of 6 categories." />
              <Suggestion icon={<AlertTriangle className="size-4" />} tone="warning" title="Build emergency fund" body="Add ₹20k/mo to reach 6-month coverage by Oct." />
            </div>
          </div>
        </div>
      </Screen>
    </>
  );
}

function Suggestion({ icon, tone, title, body }: { icon: React.ReactNode; tone: "warning" | "success" | "danger"; title: string; body: string }) {
  const styles = {
    warning: "bg-amber-50 text-amber-700",
    success: "bg-emerald-50 text-emerald-700",
    danger: "bg-rose-50 text-rose-700",
  }[tone];
  return (
    <div className={`rounded-2xl p-3.5 flex gap-3 ${styles}`}>
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-sm" style={{ fontWeight: 700 }}>{title}</div>
        <div className="text-xs opacity-80 mt-0.5">{body}</div>
      </div>
    </div>
  );
}
