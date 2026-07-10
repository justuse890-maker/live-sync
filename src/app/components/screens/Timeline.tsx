import { useMemo, useState } from "react";
import {
  ArrowUpRight, ArrowDownRight, Repeat, Target, HandCoins, Calculator,
  Receipt, Calendar, Search, Sparkles, TrendingUp, TrendingDown, X, Filter,
  CalendarDays, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import { buildTimeline, TimelineEvent, lifestyleInflation } from "../../lib/intelligence";

const icons: Record<TimelineEvent["kind"], any> = {
  income: ArrowUpRight, expense: ArrowDownRight, subscription: Repeat,
  goal: Target, loan: HandCoins, tax: Calculator, sip: Repeat, bill: Receipt,
};
const tints: Record<TimelineEvent["kind"], string> = {
  income: "#10B981", expense: "#64748B", subscription: "#F59E0B",
  goal: "#1E40AF", loan: "#8B5CF6", tax: "#EF4444", sip: "#0EA5E9", bill: "#F97316",
};
const labels: Record<TimelineEvent["kind"], string> = {
  income: "Income", expense: "Expense", subscription: "Subscriptions",
  goal: "Goals", loan: "Loans", tax: "Tax", sip: "SIPs", bill: "Bills",
};

type Filter = "upcoming" | "all" | "past";
type Kind = TimelineEvent["kind"];
const ALL_KINDS: Kind[] = ["income", "expense", "subscription", "goal", "loan", "tax", "bill"];

export function Timeline({ onBack }: { onBack: () => void }) {
  const { transactions, subscriptions, goals, loans } = useStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [kinds, setKinds] = useState<Set<Kind>>(new Set(ALL_KINDS));
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const events = useMemo(
    () => buildTimeline({ transactions, subscriptions, goals, loans, bills: [] }),
    [transactions, subscriptions, goals, loans],
  );

  const todayKey = new Date().toISOString().slice(0, 10);

  const filtered = events
    .filter((e) => kinds.has(e.kind))
    .filter((e) => (query ? e.title.toLowerCase().includes(query.toLowerCase()) : true))
    .filter((e) => (selectedDate ? e.date === selectedDate : true))
    .filter((e) => (selectedDate || filter === "all" ? true : filter === "upcoming" ? e.date >= todayKey : e.date < todayKey));

  // ─── 30-day cash flow (past 14 + next 16) ─────────────────────────────
  const flowSeries = useMemo(() => buildFlowSeries(events, 14, 16), [events]);
  const next30 = flowSeries.slice(14).reduce((s, d) => s + d.net, 0);
  const past14 = flowSeries.slice(0, 14).reduce((s, d) => s + d.net, 0);
  const trendUp = next30 >= past14;

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
    for (let i = -7; i < 21; i++) {
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
      <Header title="Financial Timeline" subtitle="Everything money in one place" showBack onBack={onBack} />
      <Screen>
        {/* ── Cash flow hero ───────────────────────────────────────── */}
        <div className="px-5 pt-4">
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-5 text-white overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, #1E40AF 0%, #0EA5E9 100%)" }}
          >
            <div className="flex items-start justify-between gap-3 relative z-10">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider opacity-80" style={{ fontWeight: 600 }}>
                  Projected net flow · next 30 days
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <div className="text-3xl" style={{ fontWeight: 700 }}>
                    {next30 >= 0 ? "+" : "−"}{inr(next30)}
                  </div>
                  <div className="flex items-center gap-1 text-xs opacity-90">
                    {trendUp ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                    vs past 14d
                  </div>
                </div>
              </div>
              <div className="size-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                <CalendarDays className="size-5" />
              </div>
            </div>

            <div className="h-20 -mx-2 mt-3 relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={flowSeries} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tl-flow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fff" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#fff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    cursor={{ stroke: "rgba(255,255,255,0.4)", strokeWidth: 1 }}
                    contentStyle={{ background: "rgba(15,23,42,0.95)", border: "none", borderRadius: 10, fontSize: 11, color: "white" }}
                    labelStyle={{ color: "rgba(255,255,255,0.7)" }}
                    formatter={(v: any) => [(v >= 0 ? "+" : "−") + inr(v), "Net"]}
                  />
                  <Area type="monotone" dataKey="net" stroke="#fff" strokeWidth={2} fill="url(#tl-flow)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-2 relative z-10 text-center">
              <Stat label="Events" value={filtered.length.toString()} />
              <Stat label="Today" value={(densityMap[todayKey]?.count ?? 0).toString()} />
              <Stat label="Next 7d" value={countNextDays(events, 7).toString()} />
            </div>

            <div className="absolute -right-10 -bottom-10 size-48 rounded-full bg-white/5" />
          </motion.div>
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
                      const Icon = icons[e.kind];
                      const tint = tints[e.kind];
                      return (
                        <div key={e.id} className="flex items-center gap-3 p-3.5 border-b border-border/60 last:border-0">
                          <div className="size-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: tint + "15", color: tint }}>
                            <Icon className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate" style={{ fontWeight: 600 }}>{e.title}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span
                                className="text-[10px] px-1.5 py-px rounded uppercase tracking-wider"
                                style={{ background: tint + "12", color: tint, fontWeight: 600 }}
                              >
                                {labels[e.kind]}
                              </span>
                              {e.meta && <span className="text-xs text-muted-foreground truncate">{e.meta}</span>}
                            </div>
                          </div>
                          {e.amount != null && (
                            <div
                              className="text-sm shrink-0"
                              style={{ fontWeight: 700, color: e.kind === "income" ? "#059669" : "var(--foreground)" }}
                            >
                              {e.kind === "income" ? "+" : e.kind === "expense" ? "−" : ""}{inr(e.amount)}
                            </div>
                          )}
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
  const date = new Date(d);
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
