import { useState, useMemo } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Download, TrendingUp, TrendingDown } from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { useStore } from "../../store";

const ranges = ["Weekly", "Monthly", "Yearly"];

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

export function Reports({ onBack }: { onBack: () => void }) {
  const [range, setRange] = useState("Monthly");
  const { transactions } = useStore();

  const cashFlowData = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    return months.map(m => {
      const mTx = transactions.filter(t => t.date.startsWith(m));
      const income = mTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expenses = mTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { month: monthNames[parseInt(m.slice(5, 7), 10) - 1], income, expenses, rawMonth: m };
    });
  }, [transactions]);

  const { trend, trendUp } = useMemo(() => {
    if (cashFlowData.length < 2) return { trend: 0, trendUp: true };
    const curr = cashFlowData[cashFlowData.length - 1];
    const prev = cashFlowData[cashFlowData.length - 2];
    const currSavings = curr.income - curr.expenses;
    const prevSavings = prev.income - prev.expenses;
    if (prevSavings === 0) return { trend: currSavings > 0 ? 100 : 0, trendUp: currSavings > 0 };
    const pct = ((currSavings - prevSavings) / Math.abs(prevSavings)) * 100;
    return { trend: Math.round(Math.abs(pct)), trendUp: pct >= 0 };
  }, [cashFlowData]);

  const pieData = useMemo(() => {
    if (cashFlowData.length === 0) return [];
    const currMonth = cashFlowData[cashFlowData.length - 1].rawMonth;
    const mTx = transactions.filter(t => t.date.startsWith(currMonth) && t.type === "expense");
    
    const byCategory: Record<string, number> = {};
    for (const t of mTx) {
      byCategory[t.category] = (byCategory[t.category] || 0) + Math.abs(t.amount);
    }
    
    const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    return sorted.map(([name, value], i) => ({
      name,
      value,
      color: COLORS[i % COLORS.length]
    }));
  }, [transactions, cashFlowData]);

  const hasData = transactions.length > 0;

  return (
    <>
      <Header title="Reports" subtitle="Financial trends" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="bg-card rounded-2xl p-1 border border-border/60 flex">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`flex-1 py-2 rounded-xl text-sm transition ${
                  range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
                style={{ fontWeight: 600 }}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="bg-card rounded-2xl p-4 border border-border/60">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="text-sm" style={{ fontWeight: 600 }}>Income vs Expenses</div>
                <div className="text-xs text-muted-foreground">Last 6 months</div>
              </div>
              {hasData && (
                <div className={`flex items-center gap-1 text-xs ${trendUp ? 'text-emerald-600' : 'text-rose-600'}`} style={{ fontWeight: 600 }}>
                  {trendUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {trendUp ? "+" : "-"}{trend}% savings
                </div>
              )}
            </div>
            {hasData ? (
              <div className="h-44 -mx-2">
                <ResponsiveContainer>
                  <BarChart data={cashFlowData}>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<ChartTip />} />
                    <Bar dataKey="income" fill="#1E40AF" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expenses" fill="#EF4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-muted-foreground text-center">
                Add transactions to see your<br />income and expense trends
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl p-4 border border-border/60">
            <div className="text-sm mb-3" style={{ fontWeight: 600 }}>Spending by category (This month)</div>
            {pieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="size-32 shrink-0">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" innerRadius={32} outerRadius={56} paddingAngle={2}>
                        {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="size-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="flex-1 text-muted-foreground truncate">{d.name}</span>
                      <span style={{ fontWeight: 600 }}>{inr(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 flex items-center justify-center text-xs text-muted-foreground text-center">
                No expenses logged for this month yet.
              </div>
            )}
          </div>

          <button className="w-full bg-card rounded-2xl p-4 border border-border/60 flex items-center justify-center gap-2 text-sm disabled:opacity-50" style={{ fontWeight: 600 }} disabled={!hasData}>
            <Download className="size-4" /> Export PDF report
          </button>
        </div>
      </Screen>
    </>
  );
}

function ChartTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-2 shadow-md text-xs">
      {payload.map((p: any, idx: number) => (
        <div key={`${p.dataKey ?? "v"}-${idx}`} className="flex items-center gap-2 py-0.5">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.dataKey}</span>
          <span style={{ fontWeight: 600 }}>{inr(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
