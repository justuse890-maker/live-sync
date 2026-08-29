import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  BarChart3,
  Grid3X3,
  Zap,
  ShoppingBag,
  Store,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import {
  monthComparison,
  spendingAnomalies,
  spendingHeatmap,
  spendingByMerchant,
  topSpends,
  type CategoryComparison,
  type SpendingAnomaly,
  type MerchantSpend,
} from "../../lib/intelligence";
import {
  shiftMonth,
  formatMonthName,
  getCurrentMonthKey,
} from "../../lib/dateUtils";

const HEAT_COLORS = [
  "bg-slate-100",
  "bg-blue-100",
  "bg-blue-200",
  "bg-blue-300",
  "bg-indigo-400",
  "bg-indigo-500",
  "bg-indigo-600",
];

function heatBg(intensity: number): string {
  const idx = Math.min(HEAT_COLORS.length - 1, Math.floor(intensity * HEAT_COLORS.length));
  return HEAT_COLORS[idx];
}

function heatText(intensity: number): string {
  return intensity > 0.5 ? "text-white" : "text-slate-700";
}

type Tab = "comparison" | "heatmap" | "merchants";

export function SpendingPatterns({ onBack }: { onBack: () => void }) {
  const { transactions, selectedMonth, setSelectedMonth } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>("comparison");

  const prevMonth = shiftMonth(selectedMonth, -1);

  // ── Computations ──
  const comparison = useMemo(
    () => monthComparison(transactions, selectedMonth, prevMonth),
    [transactions, selectedMonth, prevMonth],
  );

  const anomalies = useMemo(
    () => spendingAnomalies(transactions, selectedMonth, 3),
    [transactions, selectedMonth],
  );

  const heatmap = useMemo(
    () => spendingHeatmap(transactions, selectedMonth, 6),
    [transactions, selectedMonth],
  );

  const merchants = useMemo(
    () => spendingByMerchant(transactions, selectedMonth),
    [transactions, selectedMonth],
  );

  const biggestSpends = useMemo(
    () => topSpends(transactions, selectedMonth, 8),
    [transactions, selectedMonth],
  );

  // Total spending for current month
  const totalSpend = useMemo(
    () =>
      transactions
        .filter(
          (t) =>
            t.type === "expense" &&
            t.date.startsWith(selectedMonth),
        )
        .reduce((s, t) => s + Math.abs(t.amount), 0),
    [transactions, selectedMonth],
  );

  const handlePrev = () => setSelectedMonth(shiftMonth(selectedMonth, -1));
  const handleNext = () => setSelectedMonth(shiftMonth(selectedMonth, 1));

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "comparison", label: "Compare", icon: BarChart3 },
    { id: "heatmap", label: "Heatmap", icon: Grid3X3 },
    { id: "merchants", label: "Merchants", icon: Store },
  ];

  return (
    <>
      <Header
        title="Spending Patterns"
        subtitle="Spot changes · Compare months"
        showBack
        onBack={onBack}
      />
      <Screen>
        <div className="px-5 pt-4 space-y-4 pb-12">
          {/* Month Selector */}
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
                vs {formatMonthName(prevMonth, "short")}
              </div>
            </div>
            <button
              onClick={handleNext}
              className="size-9 bg-muted hover:bg-muted/80 rounded-xl flex items-center justify-center transition active:scale-95"
            >
              <ChevronRight className="size-4 text-slate-700" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="bg-card rounded-2xl p-1 border border-border/60 flex shadow-sm">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === t.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="size-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Anomaly Alerts (shown on all tabs when present) */}
          {anomalies.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Zap className="size-3.5 text-amber-500" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Spending Alerts
                </span>
              </div>
              {anomalies.slice(0, 3).map((a) => (
                <motion.div
                  key={a.category}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl p-3 border text-xs flex items-start gap-2.5 ${
                    a.direction === "spike"
                      ? "bg-rose-50/80 border-rose-200"
                      : "bg-emerald-50/80 border-emerald-200"
                  }`}
                >
                  {a.direction === "spike" ? (
                    <ArrowUpRight className="size-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <ArrowDownRight className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-bold ${
                        a.direction === "spike" ? "text-rose-800" : "text-emerald-800"
                      }`}
                    >
                      {a.message}
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      Avg: {inr(Math.round(a.averageAmount))} → This month:{" "}
                      {inr(Math.round(a.currentAmount))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── TAB: Month Comparison ── */}
          {activeTab === "comparison" && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700 px-1">
                Category-wise: {formatMonthName(selectedMonth, "short")} vs{" "}
                {formatMonthName(prevMonth, "short")}
              </div>

              {comparison.length === 0 ? (
                <EmptyState text="No expenses to compare. Add transactions for two months to see comparisons." />
              ) : (
                <div className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
                  {comparison.map((c) => (
                    <ComparisonRow key={c.category} data={c} />
                  ))}
                </div>
              )}

              {/* Biggest Spends this month */}
              {biggestSpends.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2 px-1">
                    <ShoppingBag className="size-3.5 text-primary" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Biggest Spends This Month
                    </span>
                  </div>
                  <div className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
                    {biggestSpends.slice(0, 5).map((s, idx) => (
                      <div
                        key={s.id}
                        className="px-4 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800 truncate max-w-[180px]">
                              {s.merchant}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {s.category} · {s.date}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-extrabold text-rose-600">
                            -{inr(s.amount)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {s.pctOfTotal.toFixed(0)}% of spend
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Spending Heatmap ── */}
          {activeTab === "heatmap" && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-700 px-1">
                6-Month Spending Intensity
              </div>

              {heatmap.categories.length === 0 ? (
                <EmptyState text="Not enough data for a heatmap. Track expenses for a few months." />
              ) : (
                <div className="bg-card rounded-2xl p-3 border border-border/60 shadow-sm overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr>
                        <th className="text-left font-semibold text-muted-foreground pb-2 pr-2 sticky left-0 bg-card">
                          Category
                        </th>
                        {heatmap.monthKeys.map((mk) => {
                          const cell = heatmap.cells.find((c) => c.monthKey === mk);
                          return (
                            <th
                              key={mk}
                              className="text-center font-semibold text-muted-foreground pb-2 px-1 min-w-[40px]"
                            >
                              {cell?.monthLabel || mk.slice(5)}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmap.categories.map((cat) => (
                        <tr key={cat}>
                          <td className="font-semibold text-slate-700 py-1 pr-2 truncate max-w-[90px] sticky left-0 bg-card">
                            {cat}
                          </td>
                          {heatmap.monthKeys.map((mk) => {
                            const cell = heatmap.cells.find(
                              (c) => c.monthKey === mk && c.category === cat,
                            );
                            const intensity = cell?.intensity ?? 0;
                            const amount = cell?.amount ?? 0;
                            return (
                              <td key={mk} className="py-1 px-0.5">
                                <div
                                  className={`rounded-md h-8 flex items-center justify-center transition-colors ${heatBg(intensity)} ${heatText(intensity)}`}
                                  title={`${cat}: ${inr(amount)} in ${mk}`}
                                >
                                  {amount > 0 ? (
                                    <span style={{ fontWeight: 600, fontSize: 9 }}>
                                      {amount >= 1000
                                        ? `${(amount / 1000).toFixed(0)}k`
                                        : inr(amount)}
                                    </span>
                                  ) : (
                                    <span className="opacity-30">—</span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Legend */}
                  <div className="flex items-center gap-1 mt-3 justify-center">
                    <span className="text-[9px] text-muted-foreground mr-1">Low</span>
                    {HEAT_COLORS.map((c, i) => (
                      <div key={i} className={`size-3 rounded-sm ${c}`} />
                    ))}
                    <span className="text-[9px] text-muted-foreground ml-1">High</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Top Merchants ── */}
          {activeTab === "merchants" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="text-xs font-bold text-slate-700">
                  Where you spent in {formatMonthName(selectedMonth, "short")}
                </div>
                <span className="text-xs font-extrabold text-rose-600">
                  {inr(totalSpend)} total
                </span>
              </div>

              {merchants.length === 0 ? (
                <EmptyState text="No expenses this month. Add transactions to see merchant breakdown." />
              ) : (
                <div className="bg-card rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
                  {merchants.slice(0, 15).map((m, idx) => (
                    <div
                      key={m.merchant}
                      className="px-4 py-3 flex items-center gap-3"
                    >
                      {/* Merchant avatar */}
                      <div
                        className="size-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs text-white"
                        style={{
                          background: `hsl(${(idx * 37 + 200) % 360}, 55%, 50%)`,
                        }}
                      >
                        {m.merchant.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {m.merchant}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {m.category} · {m.count} payment
                          {m.count > 1 ? "s" : ""} · avg {inr(Math.round(m.avgPerTx))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-extrabold text-rose-600">
                          -{inr(Math.round(m.total))}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {m.pct.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Screen>
    </>
  );
}

function ComparisonRow({ data }: { data: CategoryComparison }) {
  const Icon =
    data.direction === "up"
      ? TrendingUp
      : data.direction === "down"
        ? TrendingDown
        : Minus;
  const color =
    data.direction === "up"
      ? "text-rose-600"
      : data.direction === "down"
        ? "text-emerald-600"
        : "text-slate-500";
  const bg =
    data.direction === "up"
      ? "bg-rose-50"
      : data.direction === "down"
        ? "bg-emerald-50"
        : "bg-slate-50";

  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className={`size-8 rounded-lg flex items-center justify-center ${bg}`}
        >
          <Icon className={`size-4 ${color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-slate-800 truncate">
            {data.category}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {inr(Math.round(data.previousAmount))} →{" "}
            {inr(Math.round(data.currentAmount))}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-xs font-extrabold ${color}`}>
          {data.changePct > 0 ? "+" : ""}
          {data.changePct.toFixed(0)}%
        </div>
        <div className="text-[10px] text-muted-foreground">
          {data.change > 0 ? "+" : ""}
          {inr(Math.round(data.change))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-card rounded-2xl p-6 border border-border/60 text-center">
      <BarChart3 className="size-6 mx-auto text-muted-foreground/40 mb-2" />
      <div className="text-xs text-muted-foreground">{text}</div>
    </div>
  );
}
