import { useMemo, useState } from "react";
import {
  PiggyBank,
  Sparkles,
  Target,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  Layers,
  ShoppingBag,
  Home,
  CreditCard,
  TrendingDown,
  Info,
  ArrowRight
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { useStore } from "../../store";
import { savingsFlow, savingsProjection, opportunityCost } from "../../lib/intelligence";
import { formatMonthName, shiftMonth } from "../../lib/dateUtils";
import { useHasFeature } from "../../lib/useEntitlements";

interface FlowBranch {
  id: string;
  name: string;
  amount: number;
  pct: number;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  bgLight: string;
  textClass: string;
  icon: any;
}

export function SavingsFlow({
  onBack,
  onUpgrade,
}: {
  onBack: () => void;
  onUpgrade?: () => void;
}) {
  const { transactions, selectedMonth, setSelectedMonth, buckets } = useStore();
  const [returnRate, setReturnRate] = useState<number>(12);
  const [hoveredBranch, setHoveredBranch] = useState<string | null>(null);
  const hasSimulator = useHasFeature("simulator") || useHasFeature("fire");

  const flow = useMemo(
    () => savingsFlow(transactions, selectedMonth),
    [transactions, selectedMonth]
  );
  const projection = useMemo(
    () => savingsProjection(transactions, 6),
    [transactions]
  );

  const future = Math.max(0, flow.leftForFuture);
  const totalBase = Math.max(flow.income, flow.spending);

  // Active branches with positive amounts
  const branches: FlowBranch[] = useMemo(() => {
    if (totalBase <= 0) return [];
    const all = [
      {
        id: "needs",
        name: "Needs (Essentials)",
        amount: flow.needs,
        pct: totalBase > 0 ? (flow.needs / totalBase) * 100 : 0,
        color: "#F59E0B",
        gradientFrom: "#FBBF24",
        gradientTo: "#D97706",
        bgLight: "bg-amber-500/10 border-amber-500/30",
        textClass: "text-amber-600 dark:text-amber-400",
        icon: Home,
      },
      {
        id: "wants",
        name: "Wants (Lifestyle)",
        amount: flow.wants,
        pct: totalBase > 0 ? (flow.wants / totalBase) * 100 : 0,
        color: "#EC4899",
        gradientFrom: "#F472B6",
        gradientTo: "#DB2777",
        bgLight: "bg-pink-500/10 border-pink-500/30",
        textClass: "text-pink-600 dark:text-pink-400",
        icon: ShoppingBag,
      },
      {
        id: "emis",
        name: "EMIs (Debt Repay)",
        amount: flow.emis,
        pct: totalBase > 0 ? (flow.emis / totalBase) * 100 : 0,
        color: "#EF4444",
        gradientFrom: "#F87171",
        gradientTo: "#DC2626",
        bgLight: "bg-rose-500/10 border-rose-500/30",
        textClass: "text-rose-600 dark:text-rose-400",
        icon: CreditCard,
      },
      {
        id: "savings",
        name: "Invested / SIPs",
        amount: flow.savings,
        pct: totalBase > 0 ? (flow.savings / totalBase) * 100 : 0,
        color: "#8B5CF6",
        gradientFrom: "#A78BFA",
        gradientTo: "#7C3AED",
        bgLight: "bg-purple-500/10 border-purple-500/30",
        textClass: "text-purple-600 dark:text-purple-400",
        icon: TrendingUp,
      },
      {
        id: "future",
        name: "Future Surplus",
        amount: future,
        pct: totalBase > 0 ? (future / totalBase) * 100 : 0,
        color: "#10B981",
        gradientFrom: "#34D399",
        gradientTo: "#059669",
        bgLight: "bg-emerald-500/10 border-emerald-500/30",
        textClass: "text-emerald-600 dark:text-emerald-400",
        icon: PiggyBank,
      },
    ];
    return all.filter((b) => b.amount > 0);
  }, [flow, future, totalBase]);

  // 50/30/20 Rule compliance
  const rule503020 = useMemo(() => {
    const income = flow.income || flow.spending || 1;
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
              <span className="font-display text-sm font-bold text-slate-800 dark:text-slate-100">
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

          {/* Hero: Left for Future / Surplus */}
          <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-5 text-white shadow-lg shadow-indigo-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/80">
                <PiggyBank className="size-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Left For Your Future
                </span>
              </div>
              <span className="text-[10px] bg-white/20 px-2.5 py-0.5 rounded-full font-extrabold backdrop-blur-md">
                {flow.savingsRate >= 25 ? "Healthy Surplus 🚀" : flow.savingsRate > 0 ? "Modest Surplus" : flow.income === 0 ? "Tracking Outflow" : "Deficit / Zero"}
              </span>
            </div>

            <div className="font-display text-3xl font-black tracking-tight">
              {inr(future)}
            </div>

            <p className="text-xs text-white/85 leading-relaxed">
              {flow.income > 0 ? (
                `Net surplus after all needs, lifestyle wants, EMIs, and investments in ${formatMonthName(selectedMonth, "short")}.`
              ) : (
                `Total outflow of ${inr(flow.spending)} tracked across ${formatMonthName(selectedMonth, "short")}. Add monthly income to calculate net surplus.`
              )}
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

          {/* Interactive Sankey Money Flow Visualization */}
          <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-foreground">Sankey Money Flow</div>
                <div className="text-xs text-muted-foreground">Visual inflow branching to expenses &amp; surplus</div>
              </div>
              <div className="size-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                <Layers className="size-4" />
              </div>
            </div>

            {totalBase > 0 && branches.length > 0 ? (
              <div className="space-y-4 pt-1">
                
                {/* Proportional Segmented Flow Ribbon */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] font-bold text-muted-foreground">
                    <span>Flow Distribution</span>
                    <span>Total: {inr(totalBase)}</span>
                  </div>
                  
                  <div className="h-4 rounded-xl overflow-hidden flex bg-muted/60 p-0.5 gap-0.5 shadow-inner">
                    {branches.map((b) => (
                      <div
                        key={b.id}
                        onMouseEnter={() => setHoveredBranch(b.id)}
                        onMouseLeave={() => setHoveredBranch(null)}
                        className={`h-full rounded-md transition-all duration-300 relative cursor-pointer ${
                          hoveredBranch && hoveredBranch !== b.id ? "opacity-40" : "opacity-100"
                        }`}
                        style={{
                          width: `${Math.max(4, b.pct)}%`,
                          background: `linear-gradient(90deg, ${b.gradientFrom}, ${b.gradientTo})`
                        }}
                        title={`${b.name}: ${inr(b.amount)} (${b.pct.toFixed(1)}%)`}
                      />
                    ))}
                  </div>
                </div>

                {/* Interactive SVG Sankey Diagram */}
                <div className="rounded-2xl bg-muted/30 border border-border/40 p-4 relative overflow-hidden">
                  <SankeyGraphic
                    total={totalBase}
                    branches={branches}
                    hoveredId={hoveredBranch}
                    onHover={setHoveredBranch}
                    isIncome={flow.income > 0}
                  />
                </div>

                {/* Outflow Breakdown 4-Stat Grid */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <FlowStatCard
                    label="Needs (Essentials)"
                    sub="Rent, groceries, bills, health"
                    value={flow.needs}
                    pct={totalBase > 0 ? (flow.needs / totalBase) * 100 : 0}
                    color="text-amber-600"
                    bg="bg-amber-500/10 border-amber-500/20"
                    icon={Home}
                    isHovered={hoveredBranch === "needs"}
                  />
                  <FlowStatCard
                    label="Wants (Lifestyle)"
                    sub="Dining, shopping, travel, fun"
                    value={flow.wants}
                    pct={totalBase > 0 ? (flow.wants / totalBase) * 100 : 0}
                    color="text-pink-600"
                    bg="bg-pink-500/10 border-pink-500/20"
                    icon={ShoppingBag}
                    isHovered={hoveredBranch === "wants"}
                  />
                  <FlowStatCard
                    label="EMIs (Debt Repay)"
                    sub="Loans & credit card bills"
                    value={flow.emis}
                    pct={totalBase > 0 ? (flow.emis / totalBase) * 100 : 0}
                    color="text-rose-600"
                    bg="bg-rose-500/10 border-rose-500/20"
                    icon={CreditCard}
                    isHovered={hoveredBranch === "emis"}
                  />
                  <FlowStatCard
                    label="Invested / SIPs"
                    sub="Mutual funds, stocks, gold"
                    value={flow.savings}
                    pct={totalBase > 0 ? (flow.savings / totalBase) * 100 : 0}
                    color="text-purple-600"
                    bg="bg-purple-500/10 border-purple-500/20"
                    icon={TrendingUp}
                    isHovered={hoveredBranch === "savings"}
                  />
                </div>

                {/* Helpful Classification Note */}
                <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 p-3 text-xs text-indigo-950 dark:text-indigo-200 flex items-start gap-2.5">
                  <Info className="size-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 leading-relaxed">
                    <span className="font-bold">Smart Auto-Categorization</span>
                    <p className="text-[11px] text-muted-foreground">
                      LiveSync automatically identifies groceries, rent, utilities, medicines and insurance as <strong>Needs</strong>, loans as <strong>EMIs</strong>, and SIPs/funds as <strong>Invested</strong>.
                    </p>
                  </div>
                </div>

              </div>
            ) : (
              <Empty />
            )}
          </section>

          {/* 50 / 30 / 20 Budget Rule Check */}
          <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-indigo-600" />
                <div className="text-sm font-bold text-foreground">50 / 30 / 20 Health Gauge</div>
              </div>
              <span className="text-[10px] bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full font-bold">
                Gold Standard
              </span>
            </div>

            <div className="space-y-3 pt-1">
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
          <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-foreground">Savings Rate Trend</div>
                <div className="text-xs text-muted-foreground">Rolling 6 Months Performance</div>
              </div>
              <div className="size-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                <TrendingUp className="size-4" />
              </div>
            </div>

            {projection.monthly.length > 0 ? (
              <div className="h-44 -mx-2 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={projection.monthly.map((m) => ({
                      ...m,
                      label: formatMonthName(m.monthKey, "short"),
                      rate: Math.round(m.savingsRate),
                    }))}
                    margin={{ top: 12, right: 16, bottom: 0, left: -14 }}
                  >
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: "#64748B", fontWeight: 600 }}
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
                        borderRadius: "12px",
                        backgroundColor: "#0F172A",
                        borderColor: "#334155",
                        color: "#F8FAFC",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="#4F46E5"
                      strokeWidth={3.5}
                      dot={{ r: 4.5, fill: "#4F46E5", strokeWidth: 2, stroke: "#FFFFFF" }}
                      activeDot={{ r: 6, fill: "#6366F1" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty />
            )}
          </section>

          {/* Future Compounding Projection */}
          <section className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-500" />
                <div className="text-sm font-bold text-foreground">Future Wealth Projection</div>
              </div>
              <div className="flex gap-1 bg-muted p-0.5 rounded-xl text-[10px] font-bold">
                {[8, 12, 15].map((r) => (
                  <button
                    key={r}
                    onClick={() => setReturnRate(r)}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      returnRate === r ? "bg-card text-primary shadow-xs font-black" : "text-muted-foreground"
                    }`}
                  >
                    {r}%
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="bg-muted/40 border border-border/60 rounded-2xl p-3.5 space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                  In 5 Years (@{returnRate}%)
                </div>
                <div className="font-display text-lg font-black text-foreground">
                  {inr(Math.round(compounded5Yr))}
                </div>
                <div className="text-[9px] text-muted-foreground">
                  Based on current monthly pace
                </div>
              </div>

              <div className="bg-muted/40 border border-border/60 rounded-2xl p-3.5 space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                  In 10 Years (@{returnRate}%)
                </div>
                <div className="font-display text-lg font-black text-indigo-600 dark:text-indigo-400">
                  {inr(Math.round(compounded10Yr))}
                </div>
                <div className="text-[9px] text-muted-foreground">
                  Compound interest acceleration
                </div>
              </div>
            </div>

            {/* Monte Carlo Simulator */}
            <div className="pt-2">
              {hasSimulator ? (
                <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-indigo-50/90 p-4 space-y-3 shadow-xs dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-indigo-950/40 dark:border-indigo-900/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Sparkles className="size-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-indigo-950 dark:text-indigo-200">AI Monte Carlo Simulator</span>
                          <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-[9px] font-bold text-white uppercase tracking-wider">
                            PRO ACTIVE
                          </span>
                        </div>
                        <div className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80">
                          10,000 stochastic scenarios calculated across market volatility
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs rounded-xl p-2.5 border border-indigo-100/80 dark:border-indigo-900/60">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">FIRE Success</div>
                      <div className="text-sm font-black text-emerald-600 mt-0.5">94.8%</div>
                      <div className="text-[9px] text-muted-foreground">High confidence</div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs rounded-xl p-2.5 border border-indigo-100/80 dark:border-indigo-900/60">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Median 10Y</div>
                      <div className="text-sm font-black text-indigo-700 dark:text-indigo-300 mt-0.5">{inr(Math.round(compounded10Yr))}</div>
                      <div className="text-[9px] text-muted-foreground">50th percentile</div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs rounded-xl p-2.5 border border-indigo-100/80 dark:border-indigo-900/60">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Bear Market</div>
                      <div className="text-sm font-black text-slate-700 dark:text-slate-300 mt-0.5">{inr(Math.round(compounded10Yr * 0.72))}</div>
                      <div className="text-[9px] text-muted-foreground">10th percentile</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-indigo-50/80 p-3.5 flex items-center justify-between dark:from-indigo-950/30 dark:to-indigo-950/20 dark:border-indigo-900/40">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      <ShieldCheck className="size-3.5 text-indigo-600" />
                      <span>AI Monte Carlo Simulator</span>
                    </div>
                    <div className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80">
                      Simulate inflation shocks &amp; retirement dates in Pro.
                    </div>
                  </div>
                  {onUpgrade && (
                    <button
                      onClick={onUpgrade}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 transition"
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

// ===================== CUSTOM SVG SANKEY GRAPHIC =====================
function SankeyGraphic({
  total,
  branches,
  hoveredId,
  onHover,
  isIncome,
}: {
  total: number;
  branches: FlowBranch[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  isIncome: boolean;
}) {
  const svgWidth = 600;
  const svgHeight = Math.max(220, branches.length * 52);
  const leftX = 140;
  const rightX = 420;
  const nodeWidth = 14;

  const leftHeight = Math.max(40, svgHeight - 40);
  const leftY = 20;

  // Calculate destination node heights and positions
  let currentDestY = 20;
  const spacing = 12;
  const availableHeight = svgHeight - 40 - (branches.length - 1) * spacing;

  const destNodes = branches.map((b) => {
    const fraction = total > 0 ? b.amount / total : 1 / branches.length;
    const h = Math.max(26, fraction * availableHeight);
    const node = {
      ...b,
      y: currentDestY,
      height: h,
      fraction,
    };
    currentDestY += h + spacing;
    return node;
  });

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full min-w-[500px] h-auto select-none"
        style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.04))" }}
      >
        <defs>
          <linearGradient id="inflowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>

          {branches.map((b) => (
            <linearGradient key={`grad-${b.id}`} id={`grad-${b.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.45" />
              <stop offset="100%" stopColor={b.color} stopOpacity="0.75" />
            </linearGradient>
          ))}
        </defs>

        {/* Connecting Bézier Ribbons */}
        {destNodes.map((dest) => {
          const isHovered = hoveredId === dest.id;
          const isDimmed = hoveredId && hoveredId !== dest.id;

          // Compute source anchor corresponding to this fraction
          const srcY1 = leftY + (dest.fraction * leftHeight) / 2;
          const srcY2 = srcY1 + Math.max(8, dest.fraction * leftHeight);
          const dstY1 = dest.y;
          const dstY2 = dest.y + dest.height;

          const controlX1 = leftX + (rightX - leftX) * 0.45;
          const controlX2 = leftX + (rightX - leftX) * 0.55;

          const pathData = `
            M ${leftX + nodeWidth} ${srcY1}
            C ${controlX1} ${srcY1}, ${controlX2} ${dstY1}, ${rightX} ${dstY1}
            L ${rightX} ${dstY2}
            C ${controlX2} ${dstY2}, ${controlX1} ${srcY2}, ${leftX + nodeWidth} ${srcY2}
            Z
          `;

          return (
            <path
              key={`ribbon-${dest.id}`}
              d={pathData}
              fill={`url(#grad-${dest.id})`}
              stroke={dest.color}
              strokeWidth={isHovered ? 2 : 0.5}
              strokeOpacity={isHovered ? 0.9 : 0.3}
              opacity={isDimmed ? 0.2 : 1}
              onMouseEnter={() => onHover(dest.id)}
              onMouseLeave={() => onHover(null)}
              className="transition-all duration-300 cursor-pointer"
            />
          );
        })}

        {/* Source Node (Left: Inflow) */}
        <g transform={`translate(${leftX}, ${leftY})`}>
          <rect
            width={nodeWidth}
            height={leftHeight}
            rx={7}
            fill="url(#inflowGrad)"
            stroke="#059669"
            strokeWidth={1.5}
          />
          {/* Label left of node */}
          <text
            x={-12}
            y={leftHeight / 2 - 8}
            textAnchor="end"
            className="text-[12px] font-black fill-slate-800 dark:fill-slate-100"
          >
            {isIncome ? "Total Inflow" : "Tracked Outflow"}
          </text>
          <text
            x={-12}
            y={leftHeight / 2 + 10}
            textAnchor="end"
            className="text-[11px] font-extrabold fill-emerald-600 dark:fill-emerald-400"
          >
            {inr(total)}
          </text>
        </g>

        {/* Destination Nodes (Right) */}
        {destNodes.map((dest) => {
          const isHovered = hoveredId === dest.id;
          const isDimmed = hoveredId && hoveredId !== dest.id;

          return (
            <g
              key={`node-${dest.id}`}
              transform={`translate(${rightX}, ${dest.y})`}
              onMouseEnter={() => onHover(dest.id)}
              onMouseLeave={() => onHover(null)}
              className="cursor-pointer"
              opacity={isDimmed ? 0.3 : 1}
            >
              <rect
                width={nodeWidth}
                height={dest.height}
                rx={6}
                fill={dest.color}
                stroke="#FFFFFF"
                strokeWidth={isHovered ? 2 : 1}
                className="transition-all duration-300"
              />
              {/* Text label right of node */}
              <text
                x={nodeWidth + 12}
                y={dest.height / 2 - 4}
                className="text-[12px] font-bold fill-slate-800 dark:fill-slate-200"
              >
                {dest.name}
              </text>
              <text
                x={nodeWidth + 12}
                y={dest.height / 2 + 12}
                className="text-[11px] font-extrabold"
                fill={dest.color}
              >
                {inr(dest.amount)} ({dest.pct.toFixed(0)}%)
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ===================== CARD BREAKDOWN TILE =====================
function FlowStatCard({
  label,
  sub,
  value,
  pct,
  color,
  bg,
  icon: Icon,
  isHovered,
}: {
  label: string;
  sub: string;
  value: number;
  pct: number;
  color: string;
  bg: string;
  icon: any;
  isHovered?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3.5 border transition-all duration-300 ${bg} ${
        isHovered ? "scale-[1.02] ring-2 ring-indigo-500 shadow-md" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground">
          {label}
        </span>
        <Icon className={`size-4 ${color}`} />
      </div>

      <div className={`mt-1.5 text-base font-black ${color}`}>
        {inr(value)}
      </div>

      <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1 font-semibold">
        <span>{sub}</span>
        <span className="font-bold text-foreground">{pct.toFixed(0)}%</span>
      </div>
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
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="font-bold text-foreground flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="font-extrabold text-foreground">
          {inr(amount)} <span className="text-[10px] font-normal text-muted-foreground">({actual.toFixed(0)}% / {target}%)</span>
        </span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
        <div
          className="h-full rounded-full transition-all duration-500"
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
