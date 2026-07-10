import { useMemo, useState } from "react";
import {
  ArrowUpRight, ArrowDownRight, Repeat, Target, HandCoins, Calculator,
  Receipt, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import { buildTimeline, TimelineEvent } from "../../lib/intelligence";
import { upcomingBills } from "../../data";

const icons: Record<TimelineEvent["kind"], any> = {
  income: ArrowUpRight, expense: ArrowDownRight, subscription: Repeat,
  goal: Target, loan: HandCoins, tax: Calculator, sip: Repeat, bill: Receipt,
};
const tints: Record<TimelineEvent["kind"], string> = {
  income: "#10B981", expense: "#64748B", subscription: "#F59E0B",
  goal: "#1E40AF", loan: "#8B5CF6", tax: "#EF4444", sip: "#0EA5E9", bill: "#F97316",
};
const labels: Record<TimelineEvent["kind"], string> = {
  income: "Income", expense: "Expense", subscription: "Subscription",
  goal: "Goal", loan: "Loan", tax: "Tax", sip: "SIP", bill: "Bill",
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function LifeCalendar({ onBack }: { onBack: () => void }) {
  const { transactions, subscriptions, goals, loans } = useStore();
  const today = new Date();
  const todayKey = isoDate(today);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(todayKey);

  const events = useMemo(
    () => buildTimeline({ transactions, subscriptions, goals, loans, bills: upcomingBills }),
    [transactions, subscriptions, goals, loans],
  );

  const byDate = useMemo(() => {
    const m: Record<string, TimelineEvent[]> = {};
    for (const e of events) (m[e.date] ||= []).push(e);
    return m;
  }, [events]);

  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const monthEvents = events.filter((e) => sameMonth(e.date, cursor));
  const monthIncome = monthEvents.filter((e) => e.kind === "income").reduce((s, e) => s + (e.amount ?? 0), 0);
  const monthExpense = monthEvents.filter((e) => e.kind === "expense").reduce((s, e) => s + (e.amount ?? 0), 0);
  const upcoming = monthEvents.filter((e) => e.date >= todayKey && e.kind !== "income" && e.kind !== "expense").length;

  const selectedEvents = selected ? (byDate[selected] ?? []) : [];

  const goMonth = (delta: number) => {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + delta);
    setCursor(d);
  };

  return (
    <>
      <Header title="Life OS Calendar" subtitle="Your money calendar" showBack onBack={onBack} />
      <Screen>
        {/* Month nav */}
        <div className="px-5 pt-4 flex items-center justify-between">
          <button onClick={() => goMonth(-1)} className="size-9 rounded-full border border-border flex items-center justify-center">
            <ChevronLeft className="size-4" />
          </button>
          <div className="text-center">
            <div className="text-base" style={{ fontWeight: 700 }}>{monthLabel}</div>
            <button
              onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(todayKey); }}
              className="text-[11px] text-primary mt-0.5"
              style={{ fontWeight: 600 }}
            >
              Jump to today
            </button>
          </div>
          <button onClick={() => goMonth(1)} className="size-9 rounded-full border border-border flex items-center justify-center">
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Month KPIs */}
        <div className="px-5 mt-3 grid grid-cols-3 gap-2">
          <KPI label="Income" value={inr(monthIncome)} tint="#10B981" />
          <KPI label="Expense" value={inr(monthExpense)} tint="#EF4444" />
          <KPI label="Upcoming" value={upcoming.toString()} tint="#1E40AF" />
        </div>

        {/* Weekday header */}
        <div className="px-5 mt-5 grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="text-center text-[10px] uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>
              {w}
            </div>
          ))}
        </div>

        {/* Month grid */}
        <div className="px-5 grid grid-cols-7 gap-1">
          {grid.map((cell, i) => {
            const iso = isoDate(cell.date);
            const dayEvents = byDate[iso] ?? [];
            const isToday = iso === todayKey;
            const isSelected = selected === iso;
            const isOtherMonth = !cell.inMonth;
            const dayNet = dayEvents.reduce(
              (s, e) => (e.amount ? s + (e.kind === "income" ? e.amount : -e.amount) : s),
              0,
            );
            const uniqueKinds = Array.from(new Set(dayEvents.map((e) => e.kind))).slice(0, 4);

            return (
              <button
                key={i}
                onClick={() => setSelected(isSelected ? null : iso)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-start pt-1.5 pb-1 transition-colors relative ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isToday
                    ? "bg-primary/10 border border-primary/40"
                    : isOtherMonth
                    ? "text-muted-foreground/40"
                    : "hover:bg-muted/60"
                }`}
              >
                <span className="text-xs" style={{ fontWeight: isToday || isSelected ? 700 : 500 }}>
                  {cell.date.getDate()}
                </span>
                <div className="flex gap-0.5 mt-auto mb-0.5 min-h-[6px]">
                  {uniqueKinds.map((k) => (
                    <span
                      key={k}
                      className="size-1.5 rounded-full"
                      style={{ background: isSelected ? "white" : tints[k] }}
                    />
                  ))}
                </div>
                {dayNet !== 0 && !isOtherMonth && (
                  <span
                    className="absolute top-0.5 right-1 text-[8px] leading-none"
                    style={{
                      color: isSelected ? "white" : dayNet > 0 ? "#059669" : "#DC2626",
                      fontWeight: 700,
                    }}
                  >
                    {dayNet > 0 ? "+" : "−"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-5 mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
          {(Object.keys(labels) as TimelineEvent["kind"][]).map((k) => (
            <div key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: tints[k] }} />
              {labels[k]}
            </div>
          ))}
        </div>

        {/* Selected day drawer */}
        <AnimatePresence initial={false}>
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              className="px-5 mt-5"
            >
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                  <div>
                    <div className="text-sm" style={{ fontWeight: 700 }}>{prettyDate(selected)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {selectedEvents.length === 0 ? "No events" : `${selectedEvents.length} event${selectedEvents.length === 1 ? "" : "s"}`}
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1.5 rounded-full hover:bg-muted">
                    <X className="size-4 text-muted-foreground" />
                  </button>
                </div>
                {selectedEvents.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                    Nothing scheduled. Free day.
                  </div>
                ) : (
                  selectedEvents.map((e) => {
                    const Icon = icons[e.kind];
                    const tint = tints[e.kind];
                    return (
                      <div key={e.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/60 last:border-0">
                        <div className="size-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: tint + "15", color: tint }}>
                          <Icon className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate" style={{ fontWeight: 600 }}>{e.title}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{labels[e.kind]}{e.meta ? ` · ${e.meta}` : ""}</div>
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
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Screen>
    </>
  );
}

function KPI({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="size-1.5 rounded-full mb-1.5" style={{ background: tint }} />
      <div className="text-sm" style={{ fontWeight: 700 }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5" style={{ fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameMonth(iso: string, ref: Date) {
  const [y, m] = iso.split("-").map(Number);
  return y === ref.getFullYear() && m - 1 === ref.getMonth();
}

function buildMonthGrid(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay()); // back to Sunday
  const out: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push({ date: d, inMonth: d.getMonth() === cursor.getMonth() });
  }
  return out;
}

function prettyDate(d: string) {
  const date = new Date(d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
