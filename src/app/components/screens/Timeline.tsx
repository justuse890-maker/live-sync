import { useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, ArrowDownRight, Repeat, Target, HandCoins, Calculator,
  Receipt, Calendar, Search, Sparkles, TrendingUp, TrendingDown, X, Filter,
  CalendarDays, ChevronRight, Building2, CreditCard, Shield, Users, Bell,
  HelpCircle, Info, CheckCircle2, ArrowRight
} from "lucide-react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import { buildTimeline, TimelineEvent, lifestyleInflation } from "../../lib/intelligence";

const icons: Record<TimelineEvent["kind"], any> = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  subscription: Repeat,
  goal: Target,
  loan: HandCoins,
  tax: Calculator,
  sip: TrendingUp,
  bill: Receipt,
  emi: Building2,
  card_bill: CreditCard,
  insurance: Shield,
  staff_salary: Users,
  reminder: Bell,
};

const tints: Record<TimelineEvent["kind"], string> = {
  income: "#10B981",
  expense: "#64748B",
  subscription: "#F59E0B",
  goal: "#1E40AF",
  loan: "#8B5CF6",
  tax: "#EF4444",
  sip: "#0EA5E9",
  bill: "#F97316",
  emi: "#DC2626",
  card_bill: "#D97706",
  insurance: "#2563EB",
  staff_salary: "#7C3AED",
  reminder: "#059669",
};

const labels: Record<TimelineEvent["kind"], string> = {
  income: "Income",
  expense: "Expense",
  subscription: "Subscriptions",
  goal: "Goals",
  loan: "Loans",
  tax: "Taxes",
  sip: "SIPs & MF",
  bill: "Bills",
  emi: "Loan EMIs",
  card_bill: "Card Bills",
  insurance: "Insurance",
  staff_salary: "Staff Salaries",
  reminder: "Reminders",
};

type Filter = "upcoming" | "all" | "past";
type Kind = TimelineEvent["kind"];
const ALL_KINDS: Kind[] = [
  "income", "expense", "subscription", "goal", "loan", "tax",
  "sip", "bill", "emi", "card_bill", "insurance", "staff_salary", "reminder"
];

export function Timeline({ onBack }: { onBack: () => void }) {
  const {
    transactions,
    subscriptions,
    goals,
    buckets,
    loans,
    structuredLoans,
    creditCards,
    sips,
    insurance,
    householdStaff,
    householdReminders,
    societyNotices,
  } = useStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [kinds, setKinds] = useState<Set<Kind>>(new Set(ALL_KINDS));
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(true);

  // Unified 13-stream timeline
  const events = useMemo(
    () => buildTimeline({
      transactions,
      subscriptions,
      goals,
      buckets,
      loans,
      structuredLoans,
      creditCards,
      sips,
      insurance,
      householdStaff,
      householdReminders,
      societyNotices,
      bills: [],
    }),
    [
      transactions,
      subscriptions,
      goals,
      buckets,
      loans,
      structuredLoans,
      creditCards,
      sips,
      insurance,
      householdStaff,
      householdReminders,
      societyNotices,
    ],
  );

  const todayKey = new Date().toISOString().slice(0, 10);
  const next30Date = new Date();
  next30Date.setDate(next30Date.getDate() + 30);
  const next30Key = next30Date.toISOString().slice(0, 10);

  const next7Date = new Date();
  next7Date.setDate(next7Date.getDate() + 7);
  const next7Key = next7Date.toISOString().slice(0, 10);

  // Filtered timeline events
  const filtered = events
    .filter((e) => kinds.has(e.kind))
    .filter((e) => (query ? e.title.toLowerCase().includes(query.toLowerCase()) : true))
    .filter((e) => (selectedDate ? e.date === selectedDate : true))
    .filter((e) => (selectedDate || filter === "all" ? true : filter === "upcoming" ? e.date >= todayKey : e.date < todayKey));

  // ─── 30-Day Cash Flow Forecast Breakdown ─────────────────────────────
  const upcoming30Events = events.filter((e) => e.date >= todayKey && e.date <= next30Key);
  const upcomingInflow = upcoming30Events
    .filter((e) => e.kind === "income")
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const upcomingOutflow = upcoming30Events
    .filter((e) => e.kind !== "income")
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const projectedNet = upcomingInflow - upcomingOutflow;

  const dueThisWeekEvents = events.filter((e) => e.date >= todayKey && e.date <= next7Key && e.kind !== "income");
  const dueThisWeekTotal = dueThisWeekEvents.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const dueTodayEvents = events.filter((e) => e.date === todayKey && e.kind !== "income");
  const dueTodayTotal = dueTodayEvents.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // ─── Flow series for visual trajectory ────────────────────────────────
  const flowSeries = useMemo(() => buildFlowSeries(events, 7, 23), [events]);
  const trendUp = projectedNet >= 0;

  // ─── Daily density map for mini calendar ──────────────────────────────
  const densityMap = useMemo(() => {
    const map: Record<string, { count: number; net: number }> = {};
    for (const e of events) {
      const k = map[e.date] ?? (map[e.date] = { count: 0, net: 0 });
      k.count += 1;
      if (e.amount) k.net += e.kind === "income" ? e.amount : -e.amount;
    }
    return map;
  }, [events]);

  const calendarStrip = useMemo(() => {
    const out: { date: string; day: number; weekday: string; isToday: boolean; isPast: boolean }[] = [];
    for (let i = -3; i < 25; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      out.push({
        date: iso,
        day: d.getDate(),
        weekday: d.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 1),
        isToday: iso === todayKey,
        isPast: iso < todayKey,
      });
    }
    return out;
  }, [todayKey]);

  // ─── AI insight (interleaved) ─────────────────────────────────────────
  const inflation = useMemo(() => lifestyleInflation(transactions), [transactions]);
  const insight = inflation.verdict === "outpacing"
    ? { title: "Lifestyle inflation rising", body: `Expenses up ${inflation.expenseGrowth.toFixed(1)}% vs prior 3 months — outpacing income by ${Math.abs(inflation.gap).toFixed(1)}%.`, tone: "warn" as const }
    : inflation.verdict === "disciplined"
    ? { title: "You're saving more", body: `Expenses ${inflation.expenseGrowth.toFixed(1)}% — slower than income growth. Keep going.`, tone: "good" as const }
    : null;

  // ─── Grouping ─────────────────────────────────────────────────────────
  const grouped = filtered.reduce<Record<string, TimelineEvent[]>>((acc, e) => {
    (acc[e.date] ||= []).push(e);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) =>
    filter === "past" ? (a < b ? 1 : -1) : (a < b ? -1 : 1),
  );

  const activeKindCount = kinds.size;
  const isFilterActive = activeKindCount < ALL_KINDS.length || query;

  return (
    <>
      <Header title="Financial Timeline" subtitle="Your 30-day cash flow & obligations radar" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-3 space-y-4">

          {/* ── Explainer / Helper Banner ─────────────────────────── */}
          {showExplainer && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 relative shadow-sm animate-in fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <CalendarDays className="size-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">What is Financial Timeline?</div>
                    <div className="text-[10px] text-muted-foreground">Your forward-looking money forecast</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowExplainer(false)}
                  className="text-[11px] font-bold text-primary hover:underline px-1.5 py-0.5"
                >
                  Got it
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                This radar projects all upcoming expenses—credit card bills, loan EMIs, staff salaries, mutual fund SIPs, subscriptions, and goal deadlines—over the next 30 days so you can avoid cash crunches.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-card rounded-xl p-2 border border-border/60 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                  <span>Forecasts net balance</span>
                </div>
                <div className="bg-card rounded-xl p-2 border border-border/60 text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0" />
                  <span>Never miss an EMI or bill</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Projected Cash Flow Hero Card ─────────────────────── */}
          <div className="bg-card rounded-3xl p-5 border border-border shadow-sm space-y-4 relative overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                  Projected 30-Day Cash Flow
                </div>
                <div className="flex items-baseline gap-2.5 mt-1">
                  <div className="text-2xl font-black text-slate-900">
                    {projectedNet >= 0 ? "+" : "−"}{inr(projectedNet)}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    trendUp ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}>
                    {trendUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {trendUp ? "Surplus expected" : "Deficit expected"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {projectedNet >= 0
                    ? "You are on track for a surplus after all planned bills and commitments."
                    : "Upcoming payments exceed expected income. Review dues below."}
                </p>
              </div>
              <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarDays className="size-5" />
              </div>
            </div>

            {/* Inflow vs Outflow Breakdown Bar */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="bg-rose-50/70 border border-rose-100 rounded-2xl p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                  <ArrowUpRight className="size-3.5 text-rose-600" /> Upcoming Dues
                </div>
                <div className="text-base font-extrabold text-rose-900 mt-0.5">
                  {inr(upcomingOutflow)}
                </div>
                <div className="text-[10px] text-rose-700/80 mt-0.5">
                  EMIs, cards, SIPs, staff & bills
                </div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                  <ArrowDownLeft className="size-3.5 text-emerald-600" /> Expected Inflow
                </div>
                <div className="text-base font-extrabold text-emerald-900 mt-0.5">
                  {inr(upcomingInflow)}
                </div>
                <div className="text-[10px] text-emerald-700/80 mt-0.5">
                  Salary & expected income
                </div>
              </div>
            </div>

            {/* Quick Summary Metrics */}
            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/60 text-center">
              <div className="bg-slate-50 rounded-xl p-2 border border-border/50">
                <div className="text-sm font-extrabold text-slate-900">{dueTodayEvents.length}</div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Today's Dues</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2 border border-border/50">
                <div className="text-sm font-extrabold text-slate-900">{dueThisWeekEvents.length}</div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground">This Week</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2 border border-border/50">
                <div className="text-sm font-extrabold text-slate-900">{upcoming30Events.length}</div>
                <div className="text-[10px] uppercase font-bold text-muted-foreground">Next 30 Days</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Mini calendar strip ──────────────────────────────────── */}
        <div className="mt-4">
          <div className="flex items-center justify-between px-5 mb-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>
              Next 4 weeks
            </div>
            <button
              onClick={() => navigate("/calendar")}
              className="text-[11px] text-primary flex items-center gap-0.5"
              style={{ fontWeight: 600 }}
            >
              Open calendar <ChevronRight className="size-3" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto px-5 pb-2 no-scrollbar">
            {calendarStrip.map((d) => {
              const dens = densityMap[d.date];
              const dotColor = dens ? (dens.net >= 0 ? "#10B981" : "#EF4444") : null;
              const isSelected = selectedDate === d.date;
              return (
                <button
                  key={d.date}
                  onClick={() => setSelectedDate(isSelected ? null : d.date)}
                  className={`shrink-0 size-12 rounded-2xl flex flex-col items-center justify-center border transition-colors ${
                    isSelected
                      ? "bg-amber-500 text-white border-amber-500"
                      : d.isToday
                      ? "bg-primary text-primary-foreground border-primary"
                      : d.isPast
                      ? "bg-muted/40 border-transparent text-muted-foreground"
                      : "bg-card border-border"
                  }`}
                >
                  <span className="text-[9px] uppercase opacity-80">{d.weekday}</span>
                  <span className="text-sm" style={{ fontWeight: 700 }}>{d.day}</span>
                  {dotColor && (
                    <span className="size-1 rounded-full mt-0.5" style={{ background: isSelected || d.isToday ? "white" : dotColor }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Search + filter ──────────────────────────────────────── */}
        <div className="px-5 mt-4 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search events"
                className="w-full pl-10 pr-9 py-2.5 bg-card border border-border rounded-xl text-sm outline-none focus:border-primary"
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted">
                  <X className="size-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`relative px-3 py-2.5 rounded-xl border ${isFilterActive ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"}`}
            >
              <Filter className="size-4" />
              {isFilterActive && <span className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-400" />}
            </button>
          </div>

          {selectedDate && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <CalendarDays className="size-3.5 text-amber-700 dark:text-amber-400" />
              <span className="text-xs flex-1" style={{ fontWeight: 600 }}>
                Showing {prettyDate(selectedDate)}
              </span>
              <button onClick={() => setSelectedDate(null)} className="p-1 -mr-1 rounded-full hover:bg-amber-500/20">
                <X className="size-3.5 text-amber-700 dark:text-amber-400" />
              </button>
            </div>
          )}

          <div className={`flex gap-2 ${selectedDate ? "opacity-50 pointer-events-none" : ""}`}>
            {(["upcoming", "all", "past"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-2 rounded-xl text-xs capitalize transition-colors ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                }`}
                style={{ fontWeight: 600 }}
              >
                {f}
              </button>
            ))}
          </div>

          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-card border border-border rounded-2xl p-3 flex flex-wrap gap-2">
                  {ALL_KINDS.map((k) => {
                    const Icon = icons[k];
                    const on = kinds.has(k);
                    return (
                      <button
                        key={k}
                        onClick={() => {
                          setKinds((prev) => {
                            const n = new Set(prev);
                            if (n.has(k)) n.delete(k); else n.add(k);
                            return n.size === 0 ? new Set(ALL_KINDS) : n;
                          });
                        }}
                        className="px-2.5 py-1.5 rounded-full text-xs flex items-center gap-1.5 border transition-colors"
                        style={{
                          background: on ? tints[k] + "1A" : "transparent",
                          color: on ? tints[k] : "var(--muted-foreground)",
                          borderColor: on ? tints[k] + "55" : "var(--border)",
                          fontWeight: 600,
                        }}
                      >
                        <Icon className="size-3" />
                        {labels[k]}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Timeline rail ───────────────────────────────────────── */}
        <div className="px-5 mt-5">
          {sortedDates.length === 0 && (
            <div className="text-center py-14 text-sm text-muted-foreground">
              <Calendar className="size-8 mx-auto mb-2 opacity-40" />
              No events match your filters.
            </div>
          )}

          <div className="relative">
            {sortedDates.length > 0 && (
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />
            )}

            {sortedDates.map((date, dateIdx) => {
              const items = grouped[date];
              const isToday = date === todayKey;
              const isPast = date < todayKey;
              const dayNet = items.reduce(
                (s, e) => (e.amount ? s + (e.kind === "income" ? e.amount : -e.amount) : s),
                0,
              );

              return (
                <div key={date} className="relative pl-12 pb-5">
                  <div
                    className={`absolute left-2 top-1 size-6 rounded-full flex items-center justify-center border-2 ${
                      isToday
                        ? "bg-primary border-primary text-primary-foreground"
                        : isPast
                        ? "bg-muted border-border text-muted-foreground"
                        : "bg-background border-primary text-primary"
                    }`}
                    style={isToday ? { boxShadow: "0 0 0 4px rgba(30,64,175,0.18)" } : undefined}
                  >
                    <span className="text-[10px]" style={{ fontWeight: 700 }}>
                      {new Date(date).getDate()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>
                      {prettyDate(date)}
                    </div>
                    {dayNet !== 0 && (
                      <div
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{
                          background: dayNet > 0 ? "#10B98115" : "#EF444415",
                          color: dayNet > 0 ? "#059669" : "#DC2626",
                          fontWeight: 700,
                        }}
                      >
                        {dayNet > 0 ? "+" : "−"}{inr(dayNet)}
                      </div>
                    )}
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="bg-card rounded-2xl border border-border/60 overflow-hidden"
                  >
                    {items.map((e) => {
                      const Icon = icons[e.kind] || Receipt;
                      const tint = tints[e.kind] || "#1E40AF";
                      return (
                        <div
                          key={e.id}
                          onClick={() => {
                            if (e.linkScreen) navigate(`/${e.linkScreen}`);
                          }}
                          className={`flex items-center gap-3 p-3.5 border-b border-border/60 last:border-0 transition ${
                            e.linkScreen ? "cursor-pointer hover:bg-muted/40 active:scale-[0.99]" : ""
                          }`}
                        >
                          <div className="size-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: tint + "15", color: tint }}>
                            <Icon className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate">{e.title}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className="text-[10px] px-1.5 py-px rounded font-bold uppercase tracking-wider"
                                style={{ background: tint + "15", color: tint }}
                              >
                                {labels[e.kind] || "Event"}
                              </span>
                              {e.meta && <span className="text-xs text-muted-foreground truncate">{e.meta}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {e.amount != null && (
                              <div
                                className="text-sm font-bold"
                                style={{ color: e.kind === "income" ? "#059669" : "var(--foreground)" }}
                              >
                                {e.kind === "income" ? "+" : "−"}{inr(e.amount)}
                              </div>
                            )}
                            {e.linkScreen && (
                              <ChevronRight className="size-4 text-muted-foreground/60" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>

                  {/* Interleave AI insight after the first upcoming day */}
                  {dateIdx === 0 && insight && filter !== "past" && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="mt-3 rounded-2xl p-3.5 border flex gap-3"
                      style={{
                        background: insight.tone === "warn" ? "#F59E0B0D" : "#10B9810D",
                        borderColor: insight.tone === "warn" ? "#F59E0B33" : "#10B98133",
                      }}
                    >
                      <div
                        className="size-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: insight.tone === "warn" ? "#F59E0B22" : "#10B98122",
                          color: insight.tone === "warn" ? "#B45309" : "#047857",
                        }}
                      >
                        <Sparkles className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm" style={{ fontWeight: 700 }}>{insight.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{insight.body}</div>
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Screen>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur-sm py-2">
      <div className="text-base" style={{ fontWeight: 700 }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-80" style={{ fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function prettyDate(d: string) {
  const [y, mo, dy] = d.split("-").map(Number);
  const date = new Date(y, mo - 1, dy); // local — avoids UTC-midnight timezone shift
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return `In ${days} days · ${date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}`;
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function buildFlowSeries(events: TimelineEvent[], daysBack: number, daysFwd: number) {
  const out: { date: string; label: string; net: number }[] = [];
  const today = new Date();
  let running = 0;
  for (let i = -daysBack; i < daysFwd; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dayEvents = events.filter((e) => e.date === iso && e.amount);
    const dayNet = dayEvents.reduce((s, e) => s + (e.kind === "income" ? e.amount! : -e.amount!), 0);
    running += dayNet;
    out.push({
      date: iso,
      label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      net: running,
    });
  }
  return out;
}

function countNextDays(events: TimelineEvent[], n: number) {
  const today = new Date();
  const end = new Date(today); end.setDate(end.getDate() + n);
  const a = today.toISOString().slice(0, 10);
  const b = end.toISOString().slice(0, 10);
  return events.filter((e) => e.date >= a && e.date <= b).length;
}
