import { useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Download, TrendingUp } from "lucide-react";
import { cashFlow, budgets } from "../../data";
import { Header, Screen } from "../Shell";
import { inr } from "../types";

const ranges = ["Weekly", "Monthly", "Yearly"];

export function Reports({ onBack }: { onBack: () => void }) {
  const [range, setRange] = useState("Monthly");
  const pieData = budgets.map((b) => ({ name: b.category, value: b.spent, color: b.color }));

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
              <div className="flex items-center gap-1 text-xs text-emerald-600" style={{ fontWeight: 600 }}>
                <TrendingUp className="size-3" /> +18%
              </div>
            </div>
            <div className="h-44 -mx-2">
              <ResponsiveContainer>
                <BarChart data={cashFlow}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                  <Bar dataKey="income" fill="#1E40AF" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" fill="#EF4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-4 border border-border/60">
            <div className="text-sm mb-3" style={{ fontWeight: 600 }}>Spending by category</div>
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
              <div className="flex-1 space-y-1.5">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="size-2 rounded-full" style={{ background: d.color }} />
                    <span className="flex-1 text-muted-foreground">{d.name}</span>
                    <span style={{ fontWeight: 600 }}>{inr(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button className="w-full bg-card rounded-2xl p-4 border border-border/60 flex items-center justify-center gap-2 text-sm" style={{ fontWeight: 600 }}>
            <Download className="size-4" /> Export PDF report
          </button>
        </div>
      </Screen>
    </>
  );
}
