import { useMemo } from "react";
import { TrendingUp, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { netWorth, detectLeaks } from "../../lib/intelligence";

export function Health({ onBack }: { onBack: () => void }) {
  const { transactions, assets, liabilities, goals, subscriptions } = useStore();

  const metrics = useMemo(() => {
    const monthlyIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const monthlyExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
    const savings = Math.max(0, monthlyIncome - monthlyExpenses);
    const savingRate = monthlyIncome > 0 ? (savings / monthlyIncome) * 100 : 0;
    
    const nw = netWorth(assets, liabilities).netWorth;
    const leaks = detectLeaks(transactions, subscriptions).totalAnnual;
    
    const liquidAssets = assets.filter(a => a.category === "savings" || a.category === "cash").reduce((s, a) => s + a.value, 0);
    const emergencyMonths = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;

    let totalScore = 50; // base score
    
    // Savings score (out of 100)
    const savingsScore = Math.min(100, (savingRate / 30) * 100);
    if (savingRate > 0) totalScore += Math.min(20, (savingRate / 30) * 20);

    // Asset/NW score (out of 100)
    const assetScore = nw > 0 ? Math.min(100, 50 + (nw / 100000) * 10) : 10;
    if (nw > 0) totalScore += 10;

    // Emergency fund score (out of 100)
    const emergencyScore = Math.min(100, (emergencyMonths / 6) * 100);
    
    // Budget discipline score (out of 100)
    const budgetScore = leaks < monthlyIncome * 0.1 ? 80 : 40;
    if (leaks < monthlyIncome * 0.1) totalScore += 10;
    if (goals.length > 0) totalScore += 5;
    if (monthlyExpenses > 0 && monthlyIncome > monthlyExpenses) totalScore += 5;

    return {
      overall: Math.min(100, Math.round(totalScore)),
      breakdown: [
        { name: "Savings Rate", score: Math.round(savingsScore), color: "#10B981" },
        { name: "Asset Growth", score: Math.round(assetScore), color: "#3B82F6" },
        { name: "Emergency Fund", score: Math.round(emergencyScore), color: "#F59E0B" },
        { name: "Budget Discipline", score: Math.round(budgetScore), color: "#8B5CF6" },
      ],
      savingRate,
      emergencyMonths,
      leaks
    };
  }, [transactions, assets, liabilities, goals, subscriptions]);

  const recommendations = useMemo(() => {
    const recs: { title: string; body: string; tone: "warning" | "success" | "danger"; icon: any }[] = [];
    
    if (metrics.leaks > 2000) {
      recs.push({ title: "Trim subscriptions", body: `Detected potential leaks of ₹${Math.round(metrics.leaks)}/yr. Check your subscriptions.`, tone: "warning", icon: AlertTriangle });
    } else {
      recs.push({ title: "Strong budget discipline", body: "You're keeping your recurring costs low.", tone: "success", icon: CheckCircle2 });
    }

    if (metrics.emergencyMonths < 3) {
      recs.push({ title: "Build emergency fund", body: `You only have ${metrics.emergencyMonths.toFixed(1)} months of runway. Aim for 6 months.`, tone: "warning", icon: AlertTriangle });
    } else {
      recs.push({ title: "Solid emergency runway", body: `You have ${metrics.emergencyMonths.toFixed(1)} months of runway. Great job!`, tone: "success", icon: CheckCircle2 });
    }

    if (metrics.savingRate > 20) {
      recs.push({ title: "Excellent saving rate", body: `You're saving ${metrics.savingRate.toFixed(1)}% of your income.`, tone: "success", icon: TrendingUp });
    } else if (metrics.savingRate > 0) {
      recs.push({ title: "Increase saving rate", body: `You're saving ${metrics.savingRate.toFixed(1)}%. Try to hit 20%.`, tone: "warning", icon: TrendingDown });
    }
    
    return recs;
  }, [metrics]);

  return (
    <>
      <Header title="Financial Health" subtitle="Updated today" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-6 text-center">
            <div className="text-white/70 text-xs uppercase tracking-wider">Overall Score</div>
            <div className="font-display my-2" style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{metrics.overall}<span style={{ fontSize: 24 }} className="text-white/60">/100</span></div>
            <div className="inline-flex items-center gap-1.5 text-sm bg-white/15 px-3 py-1 rounded-full">
              {metrics.overall >= 70 ? <><TrendingUp className="size-3.5" /> Good standing</> : <><AlertTriangle className="size-3.5" /> Needs attention</>}
            </div>
          </div>

          <div className="space-y-2.5">
            {metrics.breakdown.map((s) => (
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
              {recommendations.map((r, i) => (
                <Suggestion key={i} icon={<r.icon className="size-4" />} tone={r.tone} title={r.title} body={r.body} />
              ))}
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
