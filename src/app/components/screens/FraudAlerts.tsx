import { ShieldAlert, Sparkles, Check, HelpCircle, AlertTriangle } from "lucide-react";
import { useStore, FraudAlert } from "../../store";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { Card } from "../screens/Dashboard";

export function FraudAlerts({ onBack }: { onBack: () => void }) {
  const { fraudAlerts, resolveFraudAlert, transactions } = useStore();

  const pendingAlerts = fraudAlerts.filter((a) => a.status === "pending");
  const resolvedAlerts = fraudAlerts.filter((a) => a.status !== "pending");

  const handleResolve = async (id: string, action: "resolved" | "ignored") => {
    await resolveFraudAlert(id, action);
  };

  const getSeverityStyle = (severity: "low" | "medium" | "high") => {
    switch (severity) {
      case "high":
        return { bg: "bg-rose-50 border-rose-200", badge: "bg-rose-100 text-rose-700", text: "text-rose-950", iconColor: "text-rose-600" };
      case "medium":
        return { bg: "bg-amber-50 border-amber-200", badge: "bg-amber-100 text-amber-700", text: "text-amber-950", iconColor: "text-amber-600" };
      default:
        return { bg: "bg-blue-50 border-blue-200", badge: "bg-blue-100 text-blue-700", text: "text-blue-950", iconColor: "text-blue-600" };
    }
  };

  return (
    <>
      <Header title="AI Fraud Alerts" subtitle="Autonomous Anomaly Detection" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          {/* Header Summary */}
          <div className="rounded-2xl bg-card border border-border/60 p-5 shadow-sm text-center">
            <ShieldAlert className="size-8 mx-auto text-primary mb-2" />
            <h3 className="font-display font-bold text-lg">Family Wallet Guardian</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
              We monitor transaction sizes, payment modes, time of day, and frequency to keep your accounts secure.
            </p>
            <div className="mt-4 pt-4 border-t border-border flex justify-around text-center">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-bold">Unreviewed Anomaly</div>
                <div className={`font-display font-extrabold text-lg mt-0.5 ${pendingAlerts.length > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {pendingAlerts.length} Active
                </div>
              </div>
              <div className="border-r border-border h-8" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase font-bold">Protection State</div>
                <div className="font-display font-extrabold text-emerald-600 text-lg mt-0.5">Secure</div>
              </div>
            </div>
          </div>

          {/* Active Alerts */}
          <div className="space-y-2.5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider px-1 font-semibold flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" /> Pending Review
            </div>
            
            {pendingAlerts.length === 0 ? (
              <div className="text-center py-10 bg-card rounded-2xl border border-dashed border-border/80">
                <ShieldAlert className="size-8 mx-auto text-emerald-600/80 mb-2" />
                <div className="text-sm font-semibold">No anomalous behavior detected</div>
                <div className="text-xs text-muted-foreground mt-1">All transactions align with typical spending habits.</div>
              </div>
            ) : (
              pendingAlerts.map((a) => {
                const s = getSeverityStyle(a.severity);
                const matchingTx = transactions.find((t) => t.id === a.txId);
                return (
                  <div key={a.id} className={`rounded-2xl border p-4 transition ${s.bg}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex gap-2.5">
                        <AlertTriangle className={`size-5 shrink-0 ${s.iconColor} mt-0.5`} />
                        <div>
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${s.badge}`}>
                            {a.severity} risk
                          </span>
                          <h4 className={`font-display text-sm font-bold mt-1.5 ${s.text}`}>{a.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{a.body}</p>
                          {matchingTx && (
                            <div className="mt-2.5 bg-white/50 border border-black/5 rounded-xl p-2.5 text-xs text-slate-800">
                              <span className="font-semibold">{matchingTx.title}</span> · {matchingTx.category} · {inr(matchingTx.amount)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => handleResolve(a.id, "resolved")} className="flex-1 inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs gap-1 py-1.5 h-8 font-medium transition">
                        <Check className="size-3.5" /> Legitimate
                      </button>
                      <button onClick={() => handleResolve(a.id, "ignored")} className="flex-1 inline-flex items-center justify-center border border-slate-300 hover:bg-slate-100 rounded-xl text-xs gap-1 py-1.5 h-8 font-medium transition">
                        <HelpCircle className="size-3.5" /> Block / Flag
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Log / History */}
          {resolvedAlerts.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider px-1 font-semibold">Alert History</div>
              <div className="space-y-2">
                {resolvedAlerts.map((a) => (
                  <Card key={a.id} className="p-3 bg-muted/40 flex justify-between items-center opacity-70">
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-semibold text-xs truncate">{a.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{a.date} · {a.status === "resolved" ? "Confirmed Safe" : "Flagged"}</div>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded capitalize">{a.status}</span>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </Screen>
    </>
  );
}
