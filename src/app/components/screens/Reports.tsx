import { useState, useMemo } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  AreaChart,
  Area,
} from "recharts";
import {
  Download,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PieChart as PieIcon,
  Layers,
  Sparkles,
  ShoppingBag,
  Utensils,
  Car,
  Home,
  HeartPulse,
  Film,
  Zap,
  Tag,
  CheckCircle2,
  Calendar,
  DollarSign,
  ArrowRightLeft,
  ArrowRight,
  Printer,
  X,
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { useStore, Tx } from "../../store";
import {
  getMonthKey,
  formatMonthName,
  shiftMonth,
  getCurrentMonthKey,
  getDayOfMonth,
  getYearString,
} from "../../lib/dateUtils";

const ranges = ["Weekly", "Monthly", "Yearly"] as const;
type RangeType = (typeof ranges)[number];

const COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Rose
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
  "#6366F1", // Indigo
  "#14B8A6", // Teal
];

// Helper to categorize expenses into Needs, Wants, Savings
const NEEDS_CATEGORIES = new Set(["rent", "grocery", "groceries", "medical", "health", "utilities", "bills", "insurance", "emi", "education"]);
const SAVINGS_CATEGORIES = new Set(["savings", "investment", "sip", "gold", "mutual fund", "stocks", "ppf", "fd", "goal"]);

export function Reports({ onBack, go }: { onBack: () => void; go?: (id: ScreenId) => void }) {
  const [range, setRange] = useState<RangeType>("Monthly");
  const { transactions, selectedMonth, setSelectedMonth } = useStore();
  const [showExportModal, setShowExportModal] = useState(false);

  // Month navigation
  const handlePrevMonth = () => {
    setSelectedMonth(shiftMonth(selectedMonth, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(shiftMonth(selectedMonth, 1));
  };

  // ─── 1. Filtered Transactions for Active Period ─────────────────────────────
  const currentYear = getYearString(selectedMonth);

  const activePeriodTx = useMemo(() => {
    if (range === "Yearly") {
      return transactions.filter((t) => getMonthKey(t.date).startsWith(currentYear));
    }
    // For Weekly and Monthly, focus on the selected month
    return transactions.filter((t) => getMonthKey(t.date) === selectedMonth);
  }, [transactions, selectedMonth, range, currentYear]);

  // Selected Month's Inflow & Outflow totals
  const totalInflow = useMemo(() => {
    return activePeriodTx.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
  }, [activePeriodTx]);

  const totalOutflow = useMemo(() => {
    return activePeriodTx.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
  }, [activePeriodTx]);

  const netSavings = totalInflow - totalOutflow;
  const savingsRate = totalInflow > 0 ? (netSavings / totalInflow) * 100 : totalOutflow === 0 ? 0 : -100;

  // ─── 2. Range-Specific Cash Flow Series (Weekly / Monthly / Yearly) ──────────
  const cashFlowSeries = useMemo(() => {
    if (range === "Weekly") {
      // 4-5 weekly buckets for selectedMonth
      const weekBuckets = [
        { label: "W1 (1-7)", start: 1, end: 7, income: 0, expenses: 0 },
        { label: "W2 (8-14)", start: 8, end: 14, income: 0, expenses: 0 },
        { label: "W3 (15-21)", start: 15, end: 21, income: 0, expenses: 0 },
        { label: "W4 (22-28)", start: 22, end: 28, income: 0, expenses: 0 },
        { label: "W5 (29+)", start: 29, end: 31, income: 0, expenses: 0 },
      ];

      const monthTx = transactions.filter((t) => getMonthKey(t.date) === selectedMonth);
      for (const t of monthTx) {
        const day = getDayOfMonth(t.date);
        const bucket = weekBuckets.find((w) => day >= w.start && day <= w.end) || weekBuckets[4];
        if (t.type === "income") bucket.income += Math.abs(t.amount);
        else bucket.expenses += Math.abs(t.amount);
      }

      return weekBuckets.map((w) => ({
        label: w.label,
        fullLabel: `${w.label} · ${formatMonthName(selectedMonth, "short")}`,
        income: w.income,
        expenses: w.expenses,
        net: w.income - w.expenses,
      }));
    }

    if (range === "Yearly") {
      // All 12 months of selectedYear
      const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

      return months.map((m, idx) => {
        const mKey = `${currentYear}-${m}`;
        const mTx = transactions.filter((t) => getMonthKey(t.date) === mKey);
        const income = mTx.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
        const expenses = mTx.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
        return {
          label: monthNames[idx],
          fullLabel: `${monthNames[idx]} ${currentYear}`,
          income,
          expenses,
          net: income - expenses,
          isCurrent: mKey === selectedMonth,
        };
      });
    }

    // Default: "Monthly" — 6-month rolling window ending at selectedMonth
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      months.push(shiftMonth(selectedMonth, -i));
    }
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((m) => {
      const mTx = transactions.filter((t) => getMonthKey(t.date) === m);
      const income = mTx.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
      const expenses = mTx.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
      const mIdx = parseInt(m.slice(5, 7), 10) - 1;
      return {
        label: monthNames[mIdx],
        fullLabel: `${monthNames[mIdx]} ${m.slice(0, 4)}`,
        income,
        expenses,
        net: income - expenses,
        isCurrent: m === selectedMonth,
        rawMonth: m,
      };
    });
  }, [transactions, selectedMonth, range, currentYear]);

  // ─── 3. Category Spending Breakdown (Donut) ──────────────────────────────────
  const categoryData = useMemo(() => {
    const expenseTx = activePeriodTx.filter((t) => t.type === "expense");
    const byCategory: Record<string, { total: number; count: number }> = {};

    for (const t of expenseTx) {
      const cat = t.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0 };
      byCategory[cat].total += Math.abs(t.amount);
      byCategory[cat].count += 1;
    }

    const totalExp = Object.values(byCategory).reduce((s, v) => s + v.total, 0);
    const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);

    return sorted.map(([name, data], i) => ({
      name,
      value: data.total,
      count: data.count,
      pct: totalExp > 0 ? (data.total / totalExp) * 100 : 0,
      color: COLORS[i % COLORS.length],
    }));
  }, [activePeriodTx]);

  // ─── 4. Money Flow Scenario (Needs / Wants / Savings 50-30-20 Rule) ───────────
  const moneyFlow = useMemo(() => {
    let needs = 0;
    let wants = 0;
    let savings = 0;

    for (const t of activePeriodTx) {
      if (t.type === "expense") {
        const cat = (t.category || "").toLowerCase();
        if (NEEDS_CATEGORIES.has(cat)) {
          needs += Math.abs(t.amount);
        } else if (SAVINGS_CATEGORIES.has(cat)) {
          savings += Math.abs(t.amount);
        } else {
          wants += Math.abs(t.amount);
        }
      }
    }

    const totalOut = needs + wants + savings || 1;
    return {
      needs: { amount: needs, pct: Math.round((needs / totalOut) * 100) },
      wants: { amount: wants, pct: Math.round((wants / totalOut) * 100) },
      savings: { amount: savings, pct: Math.round((savings / totalOut) * 100) },
    };
  }, [activePeriodTx]);

  // ─── 5. Top Merchants / Outflow Payees ───────────────────────────────────────
  const topMerchants = useMemo(() => {
    const expenseTx = activePeriodTx.filter((t) => t.type === "expense");
    const map: Record<string, { amount: number; count: number; category: string }> = {};

    for (const t of expenseTx) {
      const name = t.merchant || t.title || "Other Payee";
      if (!map[name]) map[name] = { amount: 0, count: 0, category: t.category };
      map[name].amount += Math.abs(t.amount);
      map[name].count += 1;
    }

    return Object.entries(map)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
        category: data.category,
      }));
  }, [activePeriodTx]);

  // ─── 6. Velocity & Daily Burn Rate ──────────────────────────────────────────
  const velocity = useMemo(() => {
    const daysInMonth = 30;
    const dailyAvg = Math.round(totalOutflow / daysInMonth);

    // Find peak spending day
    const dayMap: Record<string, number> = {};
    for (const t of activePeriodTx.filter((t) => t.type === "expense")) {
      dayMap[t.date] = (dayMap[t.date] || 0) + Math.abs(t.amount);
    }
    let peakDay: { date: string; amount: number } | null = null;
    for (const [date, amount] of Object.entries(dayMap)) {
      if (!peakDay || amount > peakDay.amount) {
        peakDay = { date, amount };
      }
    }

    return { dailyAvg, peakDay };
  }, [totalOutflow, activePeriodTx]);

  const hasData = transactions.length > 0;

  return (
    <>
      <Header title="Reports" subtitle="Cash Flow & Spending Analytics" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4 pb-12">
          
          {/* Month Selector Carousel */}
          <div className="flex justify-between items-center bg-card rounded-2xl p-3.5 border border-border/60 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="size-9 bg-muted hover:bg-muted/80 rounded-xl flex items-center justify-center transition active:scale-95"
            >
              <ChevronLeft className="size-4 text-slate-700" />
            </button>
            <div className="text-center">
              <span className="font-display text-sm font-bold text-slate-800">
                {formatMonthName(selectedMonth)}
              </span>
              <div className="text-[10px] text-muted-foreground">Tap arrows to switch month</div>
            </div>
            <button
              onClick={handleNextMonth}
              className="size-9 bg-muted hover:bg-muted/80 rounded-xl flex items-center justify-center transition active:scale-95"
            >
              <ChevronRight className="size-4 text-slate-700" />
            </button>
          </div>

          {/* Range Picker */}
          <div className="bg-card rounded-2xl p-1 border border-border/60 flex shadow-sm">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  range === r
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Inflow vs Outflow KPI Cards */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-emerald-50/80 border border-emerald-100 rounded-2xl p-3 shadow-sm">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                <ArrowUpRight className="size-3.5" />
                <span>Inflow</span>
              </div>
              <div className="font-display text-emerald-950 mt-1" style={{ fontSize: 15, fontWeight: 700 }}>
                {inr(totalInflow)}
              </div>
              <div className="text-[9px] text-emerald-600/80 mt-0.5">Total Income</div>
            </div>

            <div className="bg-rose-50/80 border border-rose-100 rounded-2xl p-3 shadow-sm">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                <ArrowDownRight className="size-3.5" />
                <span>Outflow</span>
              </div>
              <div className="font-display text-rose-950 mt-1" style={{ fontSize: 15, fontWeight: 700 }}>
                {inr(totalOutflow)}
              </div>
              <div className="text-[9px] text-rose-600/80 mt-0.5">Total Expenses</div>
            </div>

            <div className={`border rounded-2xl p-3 shadow-sm ${
              netSavings >= 0 ? "bg-indigo-50/80 border-indigo-100" : "bg-amber-50/80 border-amber-100"
            }`}>
              <div className={`flex items-center gap-1 text-[11px] font-semibold ${
                netSavings >= 0 ? "text-indigo-700" : "text-amber-700"
              }`}>
                <Wallet className="size-3.5" />
                <span>Net Flow</span>
              </div>
              <div className={`font-display mt-1 ${
                netSavings >= 0 ? "text-indigo-950" : "text-amber-950"
              }`} style={{ fontSize: 15, fontWeight: 700 }}>
                {inr(netSavings)}
              </div>
              <div className={`text-[9px] font-medium mt-0.5 ${
                savingsRate >= 0 ? "text-indigo-600/80" : "text-amber-600/80"
              }`}>
                {savingsRate >= 0 ? `${savingsRate.toFixed(0)}% Saved` : "Deficit"}
              </div>
            </div>
          </div>

          {/* Cash Flow Comparison Bar Chart */}
          <div className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div>
                <div className="text-sm font-bold text-slate-800">
                  Income vs Expenses ({range})
                </div>
                <div className="text-xs text-muted-foreground">
                  {range === "Weekly"
                    ? `Weekly flow in ${formatMonthName(selectedMonth, "short")}`
                    : range === "Monthly"
                    ? "6-month cash flow overview"
                    : `Year ${currentYear} monthly trends`}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="size-2 rounded-full bg-primary" /> Inflow
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="size-2 rounded-full bg-rose-500" /> Outflow
                </span>
              </div>
            </div>

            {hasData ? (
              <div className="h-48 -mx-2 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlowSeries} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      padding={{ left: 6, right: 6 }}
                      tick={{ fontSize: 11, fill: "#64748B", fontWeight: 500 }}
                    />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} content={<ChartTip />} />
                    <Bar dataKey="income" name="Income" fill="#1E40AF" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-muted-foreground text-center">
                Add transactions to see your
                <br />
                income and expense trends
              </div>
            )}
          </div>

          {/* Money Flow Scenario & 50/30/20 Allocation */}
          <div className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <ArrowRightLeft className="size-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">Money Flow Scenario</div>
                  <div className="text-xs text-muted-foreground">How your outflow is allocated</div>
                </div>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                50/30/20 Rule
              </span>
            </div>

            {/* Multi-segment Allocation Bar */}
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all"
                style={{ width: `${moneyFlow.needs.pct}%` }}
                title={`Needs: ${moneyFlow.needs.pct}%`}
              />
              <div
                className="bg-amber-500 h-full transition-all"
                style={{ width: `${moneyFlow.wants.pct}%` }}
                title={`Wants: ${moneyFlow.wants.pct}%`}
              />
              <div
                className="bg-indigo-500 h-full transition-all"
                style={{ width: `${moneyFlow.savings.pct}%` }}
                title={`Savings/Investments: ${moneyFlow.savings.pct}%`}
              />
            </div>

            {/* Allocation Breakdown Cards */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2.5">
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Essentials</span>
                </div>
                <div className="text-xs font-extrabold text-slate-800 mt-1">{inr(moneyFlow.needs.amount)}</div>
                <div className="text-[10px] text-muted-foreground">{moneyFlow.needs.pct}% (Target: 50%)</div>
              </div>

              <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-2.5">
                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-700">
                  <span className="size-2 rounded-full bg-amber-500" />
                  <span>Lifestyle</span>
                </div>
                <div className="text-xs font-extrabold text-slate-800 mt-1">{inr(moneyFlow.wants.amount)}</div>
                <div className="text-[10px] text-muted-foreground">{moneyFlow.wants.pct}% (Target: 30%)</div>
              </div>

              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-2.5">
                <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-700">
                  <span className="size-2 rounded-full bg-indigo-500" />
                  <span>Savings</span>
                </div>
                <div className="text-xs font-extrabold text-slate-800 mt-1">{inr(moneyFlow.savings.amount)}</div>
                <div className="text-[10px] text-muted-foreground">{moneyFlow.savings.pct}% (Target: 20%)</div>
              </div>
            </div>

            {go && (
              <button
                onClick={() => go("money-flow")}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 text-xs font-bold transition"
              >
                <span>Explore Interactive Money Flow (Sankey)</span>
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>

          {/* Spending by Category (Donut + Ranked List) */}
          <div className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-bold text-slate-800">
                  Spending by Category ({formatMonthName(selectedMonth, "short")})
                </div>
                <div className="text-xs text-muted-foreground">Category breakdown and percentages</div>
              </div>
              <span className="text-xs font-extrabold text-rose-600">{inr(totalOutflow)}</span>
            </div>

            {categoryData.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="size-32 shrink-0 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          innerRadius={34}
                          outerRadius={56}
                          paddingAngle={2}
                        >
                          {categoryData.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute text-center pointer-events-none">
                      <div className="text-[9px] text-muted-foreground font-semibold">Total</div>
                      <div className="text-[11px] font-bold text-slate-800">{categoryData.length} Cats</div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {categoryData.slice(0, 4).map((d) => (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <span className="size-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="flex-1 text-slate-700 font-medium truncate">{d.name}</span>
                        <span className="text-slate-500 text-[11px]">{d.pct.toFixed(0)}%</span>
                        <span className="font-bold text-slate-900">{inr(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Progress bars for top categories */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  {categoryData.map((c) => (
                    <div key={c.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ background: c.color }} />
                          {c.name} ({c.count} tx)
                        </span>
                        <span className="font-bold text-slate-900">{inr(c.value)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${c.pct}%`, background: c.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-xs text-muted-foreground text-center">
                <PieIcon className="size-8 text-muted-foreground/40 mb-2" />
                No expenses logged for {formatMonthName(selectedMonth)}.
                <div className="text-[11px] text-primary mt-1 font-semibold">
                  Add a transaction or select another month
                </div>
              </div>
            )}
          </div>

          {/* Top Outflow Sources / Merchants */}
          {topMerchants.length > 0 && (
            <div className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">Top Outflow Sources</div>
                  <div className="text-xs text-muted-foreground">Where largest amounts were spent</div>
                </div>
                <Tag className="size-4 text-muted-foreground" />
              </div>

              <div className="divide-y divide-border/40">
                {topMerchants.map((m, idx) => (
                  <div key={m.name} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 truncate max-w-[170px]">{m.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {m.category} · {m.count} payment{m.count > 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-extrabold text-rose-600">-{inr(m.amount)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {totalOutflow > 0 ? `${((m.amount / totalOutflow) * 100).toFixed(0)}% of spend` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Burn Velocity */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-4 shadow-md space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Cash Flow Velocity
                </span>
              </div>
              <span className="text-xs text-slate-400 font-medium">Daily Pace</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="text-[10px] text-slate-400">Avg. Daily Outflow</div>
                <div className="font-display text-base font-extrabold text-white mt-0.5">
                  {inr(velocity.dailyAvg)}/day
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400">Peak Spending Day</div>
                <div className="font-display text-base font-extrabold text-amber-400 mt-0.5">
                  {velocity.peakDay ? inr(velocity.peakDay.amount) : "—"}
                </div>
                {velocity.peakDay && (
                  <div className="text-[9px] text-slate-400">{velocity.peakDay.date}</div>
                )}
              </div>
            </div>
          </div>

          {/* Export Report Button */}
          <button
            onClick={() => setShowExportModal(true)}
            className="w-full bg-card hover:bg-slate-50 active:scale-[0.98] rounded-2xl p-4 border border-border/60 flex items-center justify-center gap-2 text-sm font-bold text-slate-800 shadow-sm transition"
            disabled={!hasData}
          >
            <Download className="size-4 text-primary" /> Export Financial Summary
          </button>
        </div>
      </Screen>

      {/* Export Summary Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card rounded-3xl p-6 max-w-sm w-full border border-border shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <div className="font-bold text-slate-900">Financial Summary Report</div>
              <button
                onClick={() => setShowExportModal(false)}
                className="size-8 rounded-full bg-muted flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                <div className="font-semibold text-slate-900">{formatMonthName(selectedMonth)} Overview</div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Inflow (Income):</span>
                  <span className="font-bold text-emerald-600">{inr(totalInflow)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Outflow (Expenses):</span>
                  <span className="font-bold text-rose-600">{inr(totalOutflow)}</span>
                </div>
                <div className="flex justify-between border-t border-border/60 pt-1">
                  <span className="text-muted-foreground">Net Cash Flow:</span>
                  <span className="font-extrabold text-slate-900">{inr(netSavings)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Savings Rate:</span>
                  <span className="font-bold text-indigo-600">{savingsRate.toFixed(1)}%</span>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground">
                Includes {activePeriodTx.length} transaction entries across {categoryData.length} active categories.
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  window.print();
                  setShowExportModal(false);
                }}
                className="flex-1 bg-primary text-primary-foreground font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Printer className="size-3.5" /> Print / Save PDF
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2.5 bg-muted text-slate-700 font-bold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const dataItem = payload[0]?.payload;
  const title = dataItem?.fullLabel || label || "Period";
  return (
    <div className="bg-card border border-border rounded-xl p-2.5 shadow-lg text-xs space-y-1.5 min-w-[135px]">
      <div className="font-bold text-slate-800 border-b border-border/60 pb-1 flex items-center justify-between gap-2">
        <span>{title}</span>
        {dataItem?.isCurrent && (
          <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-bold">Current</span>
        )}
      </div>
      {payload.map((p: any, idx: number) => (
        <div key={`${p.dataKey ?? "v"}-${idx}`} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: p.fill || p.color }} />
            <span className="text-muted-foreground capitalize">{p.name || p.dataKey}</span>
          </div>
          <span style={{ fontWeight: 700 }} className={p.dataKey === "income" ? "text-emerald-700" : "text-rose-700"}>
            {inr(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
