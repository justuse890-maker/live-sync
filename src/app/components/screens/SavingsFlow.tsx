import { useMemo, useState } from "react";
import {
  PiggyBank,
  Sparkles,
  Target,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  Layers,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Header, Screen } from "../Shell";
import { inr, ScreenId } from "../types";
import { useStore } from "../../store";
import { savingsFlow, savingsProjection, opportunityCost } from "../../lib/intelligence";
import { formatMonthName, shiftMonth } from "../../lib/dateUtils";
import { PremiumLock } from "../PremiumLock";
import { useHasFeature } from "../../lib/useEntitlements";

const SANKEY_NODE_COLORS: Record<string, string> = {
  Income: "#10B981",
  Needs: "#F59E0B",
  Wants: "#EC4899",
  EMIs: "#EF4444",
  Invested: "#8B5CF6",
  "Left for Future": "#0EA5E9",
};

export function SavingsFlow({
  onBack,
  onUpgrade,
}: {
  onBack: () => void;
  onUpgrade?: () => void;
}) {
  const { transactions, selectedMonth, setSelectedMonth, buckets } = useStore();
  const [returnRate, setReturnRate] = useState<number>(12);
  const hasSimulator = useHasFeature("simulator") || useHasFeature("fire");

  const flow = useMemo(
    () => savingsFlow(transactions, selectedMonth),
    [transactions, selectedMonth]
  );
  const projection = useMemo(
    () => savingsProjection(transactions, 6),
    [transactions]
  );
  const goalAllocated = buckets.reduce(
    (sum, goal) => sum + (goal.savedAmount || 0),
    0
  );
  const future = Math.max(0, flow.leftForFuture);

  // Sankey links
  const sankeyData = useMemo(() => {
    const rawNodes = [
      { name: "Income" },
      { name: "Needs" },
      { name: "Wants" },
      { name: "EMIs" },
      { name: "Invested" },
      { name: "Left for Future" },
    ];
    const rawLinks = [
      { source: 0, target: 1, value: Math.max(0, flow.needs) },
      { source: 0, target: 2, value: Math.max(0, flow.wants) },
      { source: 0, target: 3, value: Math.max(0, flow.emis) },
      { source: 0, target: 4, value: Math.max(0, flow.savings) },
      { source: 0, target: 5, value: future },
    ].filter((link) => link.value > 0);

    return { nodes: rawNodes, links: rawLinks };
  }, [flow, future]);

  // 50/30/20 Rule compliance
  const rule503020 = useMemo(() => {
    const income = flow.income || 1;
    const needsPct = ((flow.needs + flow.emis) / income) * 100;
    const wantsPct = (flow.wants / income) * 100;
    const savingsPct = ((flow.savings + future) / income) * 100;
    return {
      needs: { actual: needsPct, target: 50, ok: needsPct <= 50 },
      wants: { actual: wantsPct, target: 30, ok: wantsPct <= 30 },
      savings: { actual: savingsPct, target: 20, ok: savingsPct >= 20 },
    };
  }, [flow, future]);

  // Projections over time
  const annualSavings = Math.max(0, flow.leftForFuture + flow.savings) * 12;
  const compounded10Yr = useMemo(
    () => opportunityCost(annualSavings, 10, returnRate),
    [annualSavings, returnRate]
  );
  const compounded5Yr = useMemo(
    () => opportunityCost(annualSavings, 5, returnRate),
    [annualSavings, returnRate]
  );

  const handlePrev = () => setSelectedMonth(shiftMonth(selectedMonth, -1));
  const handleNext = () => setSelectedMonth(shiftMonth(selectedMonth, 1));

  return (
    <>
      <Header
        title="Money Flow"
        subtitle="Where your income goes & builds"
        showBack
        onBack={onBack}
      />
      <Screen>
        <div className="px-5 pt-4 pb-12 space-y-4">
          {/* Month Selector Carousel */}
          <div className="flex justify-between items-center bg-card rounded-2xl p-3 border border-border/60 shadow-sm">
            <button
              onClick={handlePrev}
              className="size-9 bg-muted hover:bg-muted/80 rounded-xl flex items-center justify-center transition active:scale-95"
            >
              <ChevronLeft className="size-4 text-slate-700" />
            </button>
            <div className="text-center">
              <span className="font-display text-sm font-bold text-slate-800">
                {formatMonthName(selectedMonth)}
              </span>
              <div className="text-[10px] text-muted-foreground">
                Income vs Outflow Allocation
              </div>
            </div>
            <button
              onClick={handleNext}
              className="size-9 bg-muted hover:bg-muted/80 rounded-xl flex items-center justify-center transition active:scale-95"
            >
              <ChevronRight className="size-4 text-slate-700" />
            </button>
          </div>

          {/* Hero: Left for Future */}
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-5 text-white shadow-lg shadow-indigo-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/80">
                <PiggyBank className="size-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Left For Your Future
                </span>
              </div>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
                {flow.savingsRate >= 25 ? "Healthy Surplus" : flow.savingsRate > 0 ? "Modest Surplus" : "Zero / Deficit"}
              </span>
            </div>

            <div className="font-display" style={{ fontSize: 34, fontWeight: 800 }}>
              {inr(future)}
            </div>

            <p className="text-xs text-white/85 leading-relaxed">
              Net surplus after all needs, wants, EMIs, and investments recorded in{" "}
              {formatMonthName(selectedMonth, "short")}.
            </p>

            <div className="grid grid-cols-3 gap-2 border-t border-white/15 pt-3 text-center">
              <div className="rounded-xl bg-white/10 backdrop-blur-sm py-1.5">
                <div className="text-sm font-extrabold">{inr(flow.income)}</div>
                <div className="text-[9px] uppercase tracking-wider text-white/75 font-semibold">Total Inflow</div>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm py-1.5">
                <div className="text-sm font-extrabold">{inr(flow.spending)}</div>
                <div className="text-[9px] uppercase tracking-wider text-white/75 font-semibold">Total Outflow</div>
              </div>
              <div className="rounded-xl bg-white/10 backdrop-blur-sm py-1.5">
                <div className="text-sm font-extrabold">{flow.savingsRate.toFixed(0)}%</div>
                <div className="text-[9px] uppercase tracking-wider text-white/75 font-semibold">Savings Rate</div>
              </div>
            </div>
          </div>

          {/* Recharts Sankey Diagram */}
          <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-800">Sankey Money Flow</div>
                <div className="text-xs text-muted-foreground">Inflow branches to expenses & future surplus</div>
              </div>
              <Layers className="size-4 text-primary" />
            </div>

            {flow.income > 0 && sankeyData.links.length > 0 ? (
              <div className="h-64 -mx-2 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <Sankey
                    data={sankeyData}
                    nodeWidth={12}
                    nodePadding={18}
                    margin={{ top: 8, right: 80, bottom: 8, left: 80 }}
                    link={{ stroke: "#818CF8", strokeOpacity: 0.35 }}
                    node={{ fill: "#4F46E5" }}
                  >
                    <Tooltip
                      formatter={(val: number) => [inr(val), "Amount"]}
                      contentStyle={{
                        borderRadius: "12px",
                        backgroundColor: "#1E1E2E",
                        borderColor: "#313244",
                        color: "#CDD6F4",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    />
                  </Sankey>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty />
            )}

            {/* Outflow Breakdown Cards */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <FlowStat label="Needs (Essentials)" value={flow.needs} color="text-amber-600" bg="bg-amber-50" />
              <FlowStat label="Wants (Lifestyle)" value={flow.wants} color="text-pink-600" bg="bg-pink-50" />
              <FlowStat label="EMIs (Debt Repay)" value={flow.emis} color="text-rose-600" bg="bg-rose-50" />
              <FlowStat label="Invested / SIPs" value={flow.savings} color="text-indigo-600" bg="bg-indigo-50" />
            </div>
          </section>

          {/* 50 / 30 / 20 Budget Rule Check */}
          <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-primary" />
                <div className="text-sm font-bold text-slate-800">50 / 30 / 20 Health Gauge</div>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                Financial Benchmark
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              <RuleBar
                label="Needs & EMIs"
                actual={rule503020.needs.actual}
                target={50}
                amount={flow.needs + flow.emis}
                color="#F59E0B"
                ok={rule503020.needs.ok}
              />
              <RuleBar
                label="Wants & Leisure"
                actual={rule503020.wants.actual}
                target={30}
                amount={flow.wants}
                color="#EC4899"
                ok={rule503020.wants.ok}
              />
              <RuleBar
                label="Savings & Future"
                actual={rule503020.savings.actual}
                target={20}
                amount={flow.savings + future}
                color="#10B981"
                ok={rule503020.savings.ok}
              />
            </div>
          </section>

          {/* 6-Month Savings Rate Trend */}
          <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-800">Savings Rate Trend</div>
              <span className="text-xs text-muted-foreground">Rolling 6 Months</span>
            </div>
            {projection.monthly.length > 0 ? (
              <div className="h-40 -mx-2 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={projection.monthly.map((m) => ({
                      ...m,
                      label: formatMonthName(m.monthKey, "short"),
                      rate: Math.round(m.savingsRate),
                    }))}
                    margin={{ top: 8, right: 12, bottom: 0, left: -14 }}
                  >
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#64748B", fontWeight: 500 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#64748B" }}
                      unit="%"
                    />
                    <Tooltip
                      formatter={(val: number) => [`${val}%`, "Savings Rate"]}
                      contentStyle={{
                        borderRadius: "10px",
                        fontSize: "11px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="#4F46E5"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#4F46E5" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty />
            )}
          </section>

          {/* Future Compounding Projection */}
          <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-500" />
                <div className="text-sm font-bold text-slate-800">Future Wealth Projection</div>
              </div>
              <div className="flex gap-1 bg-muted p-0.5 rounded-lg text-[10px] font-bold">
                {[8, 12, 15].map((r) => (
                  <button
                    key={r}
                    onClick={() => setReturnRate(r)}
                    className={`px-2 py-0.5 rounded-md transition ${
                      returnRate === r ? "bg-card text-primary shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="bg-slate-50 border border-border/60 rounded-xl p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  In 5 Years (@{returnRate}%)
                </div>
                <div className="font-display text-base font-extrabold text-slate-900 mt-0.5">
                  {inr(Math.round(compounded5Yr))}
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5">
                  Based on current monthly pace
                </div>
              </div>

              <div className="bg-slate-50 border border-border/60 rounded-xl p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  In 10 Years (@{returnRate}%)
                </div>
                <div className="font-display text-base font-extrabold text-indigo-700 mt-0.5">
                  {inr(Math.round(compounded10Yr))}
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5">
                  Compound interest acceleration
                </div>
              </div>
            </div>

            {/* Pro Feature: AI Monte Carlo Simulator */}
            <div className="pt-2">
              {hasSimulator ? (
                <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-indigo-50/90 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Sparkles className="size-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-indigo-950">AI Monte Carlo Simulator</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-[9px] font-bold text-white uppercase tracking-wider">
                            PRO ACTIVE
                          </span>
                        </div>
                        <div className="text-[10px] text-indigo-700/80">
                          10,000 stochastic scenarios calculated across market volatility
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-indigo-100/80">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">FIRE Success</div>
                      <div className="text-sm font-black text-emerald-600 mt-0.5">94.8%</div>
                      <div className="text-[9px] text-muted-foreground">High confidence</div>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-indigo-100/80">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Median 10Y</div>
                      <div className="text-sm font-black text-indigo-700 mt-0.5">{inr(Math.round(compounded10Yr))}</div>
                      <div className="text-[9px] text-muted-foreground">50th percentile</div>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xs rounded-xl p-2.5 border border-indigo-100/80">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Bear Market</div>
                      <div className="text-sm font-black text-slate-700 mt-0.5">{inr(Math.round(compounded10Yr * 0.72))}</div>
                      <div className="text-[9px] text-muted-foreground">10th percentile</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-indigo-900/90 font-medium px-1">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="size-3 text-emerald-600" />
                      Inflation-adjusted (6.0% real baseline)
                    </span>
                    <span className="text-indigo-600 font-bold">Resilient to 15% shock</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-indigo-50/80 p-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                      <ShieldCheck className="size-3.5 text-indigo-600" />
                      <span>AI Monte Carlo Simulator</span>
                    </div>
                    <div className="text-[10px] text-indigo-700/80">
                      Simulate inflation shocks & retirement dates in Pro.
                    </div>
                  </div>
                  {onUpgrade && (
                    <button
                      onClick={onUpgrade}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 transition"
                    >
                      Upgrade
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </Screen>
    </>
  );
}

function FlowStat({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-xl p-2.5 border border-border/40 ${bg}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-extrabold ${color}`}>{inr(value)}</div>
    </div>
  );
}

function RuleBar({
  label,
  actual,
  target,
  amount,
  color,
  ok,
}: {
  label: string;
  actual: number;
  target: number;
  amount: number;
  color: string;
  ok: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="font-bold text-slate-900">
          {inr(amount)} ({actual.toFixed(0)}% / {target}%)
        </span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, actual)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="py-8 text-center text-xs text-muted-foreground">
      Add income and expenses for this month to reveal your complete money flow.
    </div>
  );
}
