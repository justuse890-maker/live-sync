import { useMemo, useState } from "react";
import {
  Search,
  ArrowDownRight,
  ArrowUpRight,
  SlidersHorizontal,
  Clock,
  Lock,
  ChevronLeft,
  ChevronRight,
  Utensils,
  ShoppingBag,
  HeartPulse,
  Home,
  Car,
  Zap,
  Film,
  Tag,
  Smartphone,
  CreditCard,
  Banknote,
  PieChart as PieIcon,
  ListFilter,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Wallet,
  Calendar,
  Layers,
  Sparkles,
  Filter,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
} from "recharts";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { Tx, canEditTx, useStore } from "../../store";
import { EditTransaction } from "../EditTransaction";
import {
  getMonthKey,
  formatMonthName,
  shiftMonth,
  getDayOfMonth,
} from "../../lib/dateUtils";

const CATEGORY_COLORS: Record<string, string> = {
  Food: "#F59E0B",
  food: "#F59E0B",
  Dining: "#F59E0B",
  Shopping: "#8B5CF6",
  shopping: "#8B5CF6",
  Medical: "#EF4444",
  medical: "#EF4444",
  Health: "#EF4444",
  Travel: "#06B6D4",
  travel: "#06B6D4",
  Rent: "#3B82F6",
  "Home cash": "#3B82F6",
  "home cash": "#3B82F6",
  Grocery: "#10B981",
  grocery: "#10B981",
  Subscriptions: "#F97316",
  Entertainment: "#EC4899",
  Salary: "#10B981",
  Income: "#10B981",
  Freelance: "#10B981",
  Other: "#64748B",
};

const PALETTE = [
  "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6"
];

function getCategoryColor(cat: string, index = 0): string {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  return PALETTE[index % PALETTE.length];
}

function getCategoryIcon(cat?: string) {
  const c = (cat || "").toLowerCase();
  if (c.includes("food") || c.includes("dining") || c.includes("rest") || c.includes("snack") || c.includes("cafe")) return Utensils;
  if (c.includes("shop") || c.includes("amazon") || c.includes("flipkart") || c.includes("cloth")) return ShoppingBag;
  if (c.includes("med") || c.includes("health") || c.includes("doc") || c.includes("pharm")) return HeartPulse;
  if (c.includes("home") || c.includes("rent") || c.includes("house") || c.includes("flat")) return Home;
  if (c.includes("travel") || c.includes("cab") || c.includes("uber") || c.includes("ola") || c.includes("flight") || c.includes("fuel")) return Car;
  if (c.includes("sub") || c.includes("netflix") || c.includes("spotify") || c.includes("hotstar")) return Zap;
  if (c.includes("ent") || c.includes("movie") || c.includes("game")) return Film;
  if (c.includes("groc") || c.includes("supermarket") || c.includes("blinkit") || c.includes("zepto")) return ShoppingBag;
  if (c.includes("salary") || c.includes("income") || c.includes("free")) return ArrowUpRight;
  return Tag;
}

const paymentMeta: Record<string, { label: string; icon: any; color: string; bg: string; text: string }> = {
  upi: { label: "UPI", icon: Smartphone, color: "#1E40AF", bg: "bg-blue-50", text: "text-blue-700" },
  credit: { label: "Credit Card", icon: CreditCard, color: "#8B5CF6", bg: "bg-purple-50", text: "text-purple-700" },
  debit: { label: "Debit Card", icon: CreditCard, color: "#0EA5E9", bg: "bg-sky-50", text: "text-sky-700" },
  cash: { label: "Cash", icon: Banknote, color: "#10B981", bg: "bg-emerald-50", text: "text-emerald-700" },
  other: { label: "Other", icon: Tag, color: "#64748B", bg: "bg-slate-50", text: "text-slate-700" },
};

const paymentShort = (m: string) =>
  ({ cash: "Cash", upi: "UPI", credit: "Credit", debit: "Debit", other: "Other" } as Record<string, string>)[m] || m;

export function Transactions() {
  const { transactions, selectedMonth, setSelectedMonth, creditCards } = useStore();
  const cardMap = Object.fromEntries(creditCards.map((c) => [c.id, c]));
  const [viewMode, setViewMode] = useState<"list" | "analytics">("list");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [modeFilter, setModeFilter] = useState<string>("All");
  const [editing, setEditing] = useState<Tx | null>(null);

  // Cycle Months
  const handlePrevMonth = () => {
    setSelectedMonth(shiftMonth(selectedMonth, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(shiftMonth(selectedMonth, 1));
  };

  // ─── 1. Monthly Transactions ────────────────────────────────────────────────
  const monthlyTx = useMemo(() => {
    return transactions.filter((t) => getMonthKey(t.date) === selectedMonth);
  }, [transactions, selectedMonth]);

  // Totals for the entire month
  const monthTotalIn = useMemo(() => {
    return monthlyTx.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
  }, [monthlyTx]);

  const monthTotalOut = useMemo(() => {
    return monthlyTx.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
  }, [monthlyTx]);

  // ─── 2. Filtered Transactions (by Search, Category, Payment Mode) ───────────
  const filtered = useMemo(() => {
    return monthlyTx.filter((t) => {
      const matchQ =
        !q ||
        t.title.toLowerCase().includes(q.toLowerCase()) ||
        (t.merchant && t.merchant.toLowerCase().includes(q.toLowerCase())) ||
        (t.category && t.category.toLowerCase().includes(q.toLowerCase()));
      const matchC = cat === "All" || (t.category || "").toLowerCase() === cat.toLowerCase();
      const matchMode =
        modeFilter === "All" ||
        (t.payments && t.payments.some((p) => p.mode.toLowerCase() === modeFilter.toLowerCase()));
      return matchQ && matchC && matchMode;
    });
  }, [monthlyTx, q, cat, modeFilter]);

  // Grouped by Date for Timeline List
  const grouped = useMemo(() => {
    return filtered.reduce<Record<string, { items: Tx[]; dayTotal: number }>>((acc, t) => {
      if (!acc[t.date]) acc[t.date] = { items: [], dayTotal: 0 };
      acc[t.date].items.push(t);
      if (t.type === "expense") acc[t.date].dayTotal += Math.abs(t.amount);
      return acc;
    }, {});
  }, [filtered]);

  const totalIn = filtered.filter((t) => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalOut = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);

  // ─── 3. Visual Spending Categories Breakdown ────────────────────────────────
  const categoryBreakdown = useMemo(() => {
    const expenses = monthlyTx.filter((t) => t.type === "expense");
    const map: Record<string, { total: number; count: number }> = {};

    for (const t of expenses) {
      const c = t.category || "Other";
      if (!map[c]) map[c] = { total: 0, count: 0 };
      map[c].total += Math.abs(t.amount);
      map[c].count += 1;
    }

    const total = Object.values(map).reduce((s, x) => s + x.total, 0) || 1;
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, data], idx) => ({
        name,
        total: data.total,
        count: data.count,
        pct: (data.total / total) * 100,
        color: getCategoryColor(name, idx),
      }));
  }, [monthlyTx]);

  // ─── 4. Payment Mode Distribution (UPI vs Credit vs Cash) ───────────────────
  const paymentBreakdown = useMemo(() => {
    const expenses = monthlyTx.filter((t) => t.type === "expense");
    const map: Record<string, number> = { upi: 0, credit: 0, cash: 0, debit: 0, other: 0 };

    for (const t of expenses) {
      if (t.payments && t.payments.length > 0) {
        for (const p of t.payments) {
          const mode = (p.mode || "other").toLowerCase();
          map[mode] = (map[mode] || 0) + (p.amount || Math.abs(t.amount));
        }
      } else {
        map.other += Math.abs(t.amount);
      }
    }

    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map)
      .filter(([_, amt]) => amt > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([mode, amt]) => {
        const meta = paymentMeta[mode] || paymentMeta.other;
        return {
          mode,
          label: meta.label,
          amount: amt,
          pct: (amt / total) * 100,
          color: meta.color,
          icon: meta.icon,
        };
      });
  }, [monthlyTx]);

  // ─── 5. Daily Spending Velocity (Sparkline Bars) ─────────────────────────────
  const dailySpendData = useMemo(() => {
    const daysMap: Record<number, number> = {};
    for (const t of monthlyTx.filter((t) => t.type === "expense")) {
      const day = getDayOfMonth(t.date);
      daysMap[day] = (daysMap[day] || 0) + Math.abs(t.amount);
    }
    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    return days.map((day) => ({
      day: `${day}`,
      amount: daysMap[day] || 0,
    }));
  }, [monthlyTx]);

  // ─── 6. Category Filter Chips with Live Spend Amounts ───────────────────────
  const categoryChips = useMemo(() => {
    const list = [{ name: "All", amount: monthTotalOut, count: monthlyTx.length }];
    for (const c of categoryBreakdown) {
      list.push({ name: c.name, amount: c.total, count: c.count });
    }
    return list;
  }, [categoryBreakdown, monthTotalOut, monthlyTx]);

  return (
    <>
      <Header title="Transactions" subtitle={formatMonthName(selectedMonth)} />
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
              <div className="text-[10px] text-muted-foreground">{monthlyTx.length} transactions logged</div>
            </div>
            <button
              onClick={handleNextMonth}
              className="size-9 bg-muted hover:bg-muted/80 rounded-xl flex items-center justify-center transition active:scale-95"
            >
              <ChevronRight className="size-4 text-slate-700" />
            </button>
          </div>

          {/* View Mode Toggle: List vs Visual Analytics */}
          <div className="bg-card rounded-2xl p-1 border border-border/60 flex shadow-sm">
            <button
              onClick={() => setViewMode("list")}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListFilter className="size-3.5" />
              <span>Activity Feed</span>
            </button>
            <button
              onClick={() => setViewMode("analytics")}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                viewMode === "analytics"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PieIcon className="size-3.5" />
              <span>Visual Breakdown</span>
            </button>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-emerald-50/90 border border-emerald-100 p-3.5 shadow-sm">
              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <ArrowUpRight className="size-3.5" />
                <span>Total Income</span>
              </div>
              <div className="font-display text-emerald-950 mt-1" style={{ fontSize: 18, fontWeight: 700 }}>
                {inr(monthTotalIn)}
              </div>
              <div className="text-[10px] text-emerald-600/80 mt-0.5">{monthlyTx.filter((t) => t.type === "income").length} credits</div>
            </div>

            <div className="rounded-2xl bg-rose-50/90 border border-rose-100 p-3.5 shadow-sm">
              <div className="flex items-center gap-1 text-xs font-semibold text-rose-700">
                <ArrowDownRight className="size-3.5" />
                <span>Total Spent</span>
              </div>
              <div className="font-display text-rose-950 mt-1" style={{ fontSize: 18, fontWeight: 700 }}>
                {inr(monthTotalOut)}
              </div>
              <div className="text-[10px] text-rose-600/80 mt-0.5">{monthlyTx.filter((t) => t.type === "expense").length} debits</div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: VISUAL ANALYTICS VIEW                                       */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {viewMode === "analytics" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Category Spending Donut & Interactive Legend */}
              <div className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Where Your Money Went</div>
                    <div className="text-xs text-muted-foreground">Category spending share</div>
                  </div>
                  <span className="text-xs font-extrabold text-rose-600">{inr(monthTotalOut)}</span>
                </div>

                {categoryBreakdown.length > 0 ? (
                  <>
                    <div className="flex items-center gap-4 pt-1">
                      <div className="size-32 shrink-0 relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categoryBreakdown}
                              dataKey="total"
                              innerRadius={34}
                              outerRadius={56}
                              paddingAngle={2}
                            >
                              {categoryBreakdown.map((d, i) => (
                                <Cell key={i} fill={d.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute text-center pointer-events-none">
                          <div className="text-[9px] text-muted-foreground font-semibold">Spent</div>
                          <div className="text-[11px] font-bold text-slate-800">{categoryBreakdown.length} Cats</div>
                        </div>
                      </div>

                      <div className="flex-1 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {categoryBreakdown.slice(0, 4).map((d) => (
                          <div
                            key={d.name}
                            onClick={() => {
                              setCat(d.name);
                              setViewMode("list");
                            }}
                            className="flex items-center gap-2 text-xs p-1 rounded-lg hover:bg-muted cursor-pointer transition"
                          >
                            <span className="size-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                            <span className="flex-1 text-slate-700 font-medium truncate">{d.name}</span>
                            <span className="text-slate-400 text-[10px]">{d.pct.toFixed(0)}%</span>
                            <span className="font-bold text-slate-900">{inr(d.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Progress bars list for all categories */}
                    <div className="space-y-2.5 pt-3 border-t border-border/40">
                      {categoryBreakdown.map((c) => {
                        const Icon = getCategoryIcon(c.name);
                        return (
                          <button
                            key={c.name}
                            onClick={() => {
                              setCat(c.name);
                              setViewMode("list");
                            }}
                            className="w-full text-left space-y-1 group"
                          >
                            <div className="flex justify-between text-xs items-center">
                              <span className="font-semibold text-slate-800 flex items-center gap-2">
                                <span
                                  className="size-5 rounded-md flex items-center justify-center"
                                  style={{ background: `${c.color}18`, color: c.color }}
                                >
                                  <Icon className="size-3" />
                                </span>
                                <span>{c.name}</span>
                                <span className="text-slate-400 font-normal text-[11px]">({c.count} tx)</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-slate-500">{c.pct.toFixed(0)}%</span>
                                <span className="font-bold text-slate-900">{inr(c.total)}</span>
                              </div>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${c.pct}%`, background: c.color }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">No expenses logged for this month.</div>
                )}
              </div>

              {/* Payment Channels (Where Did The Money Leave From?) */}
              <div className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Payment Channels</div>
                    <div className="text-xs text-muted-foreground">UPI vs Credit Card vs Cash</div>
                  </div>
                  <Smartphone className="size-4 text-muted-foreground" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {paymentBreakdown.map((p) => {
                    const Icon = p.icon;
                    return (
                      <div key={p.mode} className="bg-slate-50/80 border border-slate-100 rounded-xl p-2.5 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: p.color }}>
                          <Icon className="size-3.5" />
                          <span>{p.label}</span>
                        </div>
                        <div className="text-xs font-extrabold text-slate-900">{inr(p.amount)}</div>
                        <div className="text-[10px] text-muted-foreground">{p.pct.toFixed(0)}% of outflow</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Daily Outflow Velocity Chart */}
              <div className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-800">Daily Spending Spikes</div>
                    <div className="text-xs text-muted-foreground">Day-by-day outflow volume</div>
                  </div>
                  <Calendar className="size-4 text-muted-foreground" />
                </div>

                <div className="h-32 -mx-2 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailySpendData}>
                      <Tooltip
                        cursor={{ fill: "rgba(0,0,0,0.03)" }}
                        content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0];
                          return (
                            <div className="bg-card border border-border rounded-lg p-2 shadow-md text-xs">
                              <div className="font-bold text-slate-800">Day {p.payload.day}</div>
                              <div className="text-rose-600 font-extrabold">{inr(p.value)} spent</div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="amount" fill="#EF4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[10px] text-muted-foreground text-center">Day 1 to Day 31 of {formatMonthName(selectedMonth, "short")}</div>
              </div>

              {/* Switch back to List CTA */}
              <button
                onClick={() => setViewMode("list")}
                className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-sm"
              >
                <ListFilter className="size-4" /> View Full Transaction Log ({monthlyTx.length})
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: ACTIVITY FEED LIST VIEW                                     */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          {viewMode === "list" && (
            <>
              {/* Multi-Color Spending Allocation Strip */}
              {categoryBreakdown.length > 0 && (
                <div className="bg-card rounded-2xl p-3.5 border border-border/60 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">Monthly Spending Split</span>
                    <button
                      onClick={() => setViewMode("analytics")}
                      className="text-primary font-semibold text-[11px] hover:underline"
                    >
                      View Chart &rarr;
                    </button>
                  </div>
                  <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
                    {categoryBreakdown.map((c) => (
                      <div
                        key={c.name}
                        style={{ width: `${c.pct}%`, background: c.color }}
                        title={`${c.name}: ${inr(c.total)} (${c.pct.toFixed(0)}%)`}
                        className="h-full transition-all"
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-3 overflow-x-auto text-[10px] text-muted-foreground pt-0.5" style={{ scrollbarWidth: "none" }}>
                    {categoryBreakdown.slice(0, 4).map((c) => (
                      <span key={c.name} className="flex items-center gap-1 shrink-0 font-medium">
                        <span className="size-2 rounded-full" style={{ background: c.color }} />
                        <span className="text-slate-700">{c.name}</span>
                        <span>{c.pct.toFixed(0)}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Search Bar */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search by merchant, note, category..."
                    className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {q && (
                    <button
                      onClick={() => setQ("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-800"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Chips with Live Spend Amounts */}
              <div
                className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1"
                style={{ scrollbarWidth: "none" }}
              >
                {categoryChips.map((c) => {
                  const isSelected = cat.toLowerCase() === c.name.toLowerCase();
                  return (
                    <button
                      key={c.name}
                      onClick={() => setCat(c.name)}
                      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-card border border-border/80 text-slate-700 hover:bg-muted/60"
                      }`}
                    >
                      <span>{c.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 font-bold"
                      }`}>
                        {inr(c.amount)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Filter Indicator */}
              {(cat !== "All" || q) && (
                <div className="flex items-center justify-between text-xs bg-primary/5 text-primary px-3 py-2 rounded-xl border border-primary/15">
                  <div className="flex items-center gap-1.5 font-medium truncate">
                    <Filter className="size-3" />
                    <span>Filtering by: {cat !== "All" ? `Category: ${cat}` : ""} {q ? `Search: "${q}"` : ""}</span>
                  </div>
                  <button
                    onClick={() => {
                      setCat("All");
                      setQ("");
                    }}
                    className="font-bold text-[11px] underline ml-2 shrink-0"
                  >
                    Reset
                  </button>
                </div>
              )}

              {/* Transaction Chronological Feed Grouped by Date */}
              <div className="space-y-4">
                {Object.entries(grouped).map(([date, groupData]) => (
                  <div key={date}>
                    <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      <span className="font-bold text-slate-600">{date}</span>
                      <span className="font-semibold text-rose-600">-{inr(groupData.dayTotal)}</span>
                    </div>

                    <div className="bg-card rounded-2xl border border-border/60 overflow-hidden shadow-sm divide-y divide-border/50">
                      {groupData.items.map((t) => {
                        const editable = canEditTx(t);
                        const isIncome = t.type === "income";
                        const Icon = getCategoryIcon(t.category);
                        const catColor = getCategoryColor(t.category);
                        const pctOfTotal = monthTotalOut > 0 ? (Math.abs(t.amount) / monthTotalOut) * 100 : 0;

                        return (
                          <button
                            key={t.id}
                            onClick={() => setEditing(t)}
                            className="w-full text-left flex items-center gap-3 p-3.5 hover:bg-muted/40 transition active:bg-muted/60"
                          >
                            {/* Category Icon Badge */}
                            <div
                              className="size-10 rounded-xl flex items-center justify-center shrink-0 transition-transform"
                              style={{
                                background: isIncome ? "#10B98115" : `${catColor}18`,
                                color: isIncome ? "#10B981" : catColor,
                              }}
                            >
                              <Icon className="size-5" />
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
                                <span className="truncate">{t.merchant || t.title}</span>
                                {editable ? (
                                  <span
                                    title="Editable"
                                    className="size-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"
                                  />
                                ) : (
                                  <Lock className="size-3 text-muted-foreground/60 shrink-0" />
                                )}
                              </div>

                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                                <span className="font-medium text-slate-600">{t.category}</span>
                                {t.payments && t.payments.length > 0 && (
                                  <>
                                    <span>&middot;</span>
                                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                      {t.payments.length === 1
                                        ? t.payments[0].mode === "credit" && t.creditCardId && cardMap[t.creditCardId]
                                          ? `Credit · ${cardMap[t.creditCardId].last4Digits}`
                                          : paymentShort(t.payments[0].mode)
                                        : `Split ${t.payments.map((p) => paymentShort(p.mode)).join("+")}`}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Amount & Share */}
                            <div className="text-right shrink-0">
                              <div
                                className={`text-sm font-extrabold ${
                                  isIncome ? "text-emerald-600" : "text-slate-900"
                                }`}
                              >
                                {isIncome ? "+" : "-"}{inr(t.amount)}
                              </div>
                              {!isIncome && pctOfTotal >= 5 && (
                                <div className="text-[10px] font-semibold text-rose-600/80 mt-0.5">
                                  {pctOfTotal.toFixed(0)}% of month
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {filtered.length === 0 && (
                  <div className="text-center py-12 bg-card rounded-2xl border border-border/60 text-sm text-muted-foreground">
                    <Filter className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                    No transactions match the selected filters or month.
                  </div>
                )}
              </div>

              {/* Audit integrity footer */}
              <div className="text-[11px] text-muted-foreground text-center px-6 pt-2 flex items-center justify-center gap-1.5">
                <Clock className="size-3" />
                Entries are editable for 5 minutes after adding, then locked for audit integrity.
              </div>
            </>
          )}
        </div>
      </Screen>
      <EditTransaction tx={editing} onClose={() => setEditing(null)} />
    </>
  );
}
