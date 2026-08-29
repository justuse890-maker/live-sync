// [P0] Cash Flow Forecast Card — the single most-requested fintech feature:
// "will I have enough money on the 28th?" instead of only showing history.
// Pure client-side math (see intelligence.ts forecastCashFlow). Deliberately
// has NO Gemini call — the roadmap calls this out explicitly: the math is
// deterministic, so narrating it with an LLM would only add latency, cost,
// and a chance of the model contradicting its own numbers.
import { useMemo } from "react";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { Tx } from "../store";
import { forecastCashFlow } from "../lib/intelligence";
import { inr } from "./types";
import { Card } from "./screens/Dashboard";

export function ForecastCard({
  transactions,
  currentBalance,
  safetyLine = 0,
  daysAhead = 30,
}: {
  transactions: Tx[];
  currentBalance: number;
  safetyLine?: number;
  daysAhead?: number;
}) {
  const forecast = useMemo(
    () => forecastCashFlow(transactions, currentBalance, daysAhead, safetyLine),
    [transactions, currentBalance, daysAhead, safetyLine]
  );

  const sentence = useMemo(() => {
    const endDate = new Date(forecast.points[forecast.points.length - 1]?.date || Date.now());
    const endLabel = endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    if (forecast.willGoBelowSafetyLine && forecast.daysUntilRisk != null) {
      const riskDate = new Date(forecast.points[forecast.daysUntilRisk]?.date || Date.now());
      const riskLabel = riskDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      return `Projected to dip below your ${inr(safetyLine)} safety line by ${riskLabel} — trending toward ${inr(forecast.lowestPoint.projectedBalance)}.`;
    }
    return `On track — projected balance on ${endLabel} is ${inr(forecast.endOfMonthBalance)}.`;
  }, [forecast, safetyLine]);

  const isAtRisk = forecast.willGoBelowSafetyLine;
  const chartData = forecast.points.map((p) => ({ date: p.date, balance: p.projectedBalance }));
  const hasEnoughHistory = transactions.length >= 5;

  return (
    <Card className={isAtRisk ? "border-rose-200" : ""}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="text-sm" style={{ fontWeight: 700 }}>Cash flow forecast</div>
          <div className="text-xs text-muted-foreground">Next {daysAhead} days · projected, not guaranteed</div>
        </div>
        <div className={`size-9 rounded-lg flex items-center justify-center ${isAtRisk ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
          {isAtRisk ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
        </div>
      </div>

      {!hasEnoughHistory ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          Add a few more transactions to unlock your forecast — it needs recurring patterns to project from.
        </div>
      ) : (
        <>
          <div className="h-20 -mx-2 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="forecast-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isAtRisk ? "#EF4444" : "#10B981"} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={isAtRisk ? "#EF4444" : "#10B981"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={["dataMin - 500", "dataMax + 500"]} />
                <Tooltip
                  formatter={(v: number) => [inr(v), "Projected balance"]}
                  labelFormatter={(d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area type="monotone" dataKey="balance" stroke={isAtRisk ? "#EF4444" : "#10B981"} strokeWidth={2} fill="url(#forecast-grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className={`flex items-start gap-2 rounded-xl p-3 ${isAtRisk ? "bg-rose-50" : "bg-emerald-50"}`}>
            {isAtRisk && <AlertTriangle className="size-4 text-rose-600 mt-0.5 shrink-0" />}
            <p className={`text-xs ${isAtRisk ? "text-rose-800" : "text-emerald-800"}`}>{sentence}</p>
          </div>
        </>
      )}
    </Card>
  );
}
