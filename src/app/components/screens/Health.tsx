import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, ChevronDown, Calculator, Plus, Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import { formatMonthName, shiftMonth } from "../../lib/dateUtils";
import { computeSnapshot, healthLabel, Pillar } from "../../lib/snapshot";
import { tap } from "../../lib/feedback";

/**
 * Financial Health — the "See details" of the home Financial snapshot.
 * Uses the exact same engine (lib/snapshot.ts) so numbers always match home,
 * and shows the formula + inputs behind every figure.
 */
export function Health({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const store = useStore();
  const { selectedMonth, setSelectedMonth } = store;
  const [open, setOpen] = useState<string | null>(null);

  const snap = useMemo(() => computeSnapshot(store as any, selectedMonth), [
    store.transactions, store.assets, store.liabilities, store.investments, store.gold, store.properties,
    store.structuredLoans, store.loans, store.budgets, store.buckets, store.goals, store.sips, store.insurance, selectedMonth,
  ]);
  const label = healthLabel(snap.healthScore);
  const color = snap.healthScore === null ? "#94A3B8" : snap.healthScore >= 85 ? "#10B981" : snap.healthScore >= 70 ? "#6366F1" : snap.healthScore >= 50 ? "#F59E0B" : "#F43F5E";
  const scored = snap.pillars.filter((p) => p.score !== null);
  const weightSum = scored.reduce((a, p) => a + p.weight, 0);

  return (
    <>
      <Header title="Financial health" subtitle="Calculated on your device from your entries" showBack onBack={onBack} />
      <Screen>
        <div className="px-4 pt-3 pb-28 space-y-4">
          <div className="flex items-center justify-between bg-card rounded-2xl p-2.5 border border-border/60">
            <button onClick={() => { tap(); setSelectedMonth(shiftMonth(selectedMonth, -1)); }} className="p-1.5 rounded-xl hover:bg-muted active:scale-90"><ChevronLeft className="size-5" /></button>
            <div className="flex items-center gap-2"><Calendar className="size-4 text-primary" /><span className="text-sm font-bold">{formatMonthName(selectedMonth)}</span></div>
            <button onClick={() => { tap(); setSelectedMonth(shiftMonth(selectedMonth, 1)); }} className="p-1.5 rounded-xl hover:bg-muted active:scale-90"><ChevronRight className="size-5" /></button>
          </div>

          {/* Score */}
          <div className="rounded-3xl bg-card border border-border/60 p-6 ls-rise">
            <div className="flex flex-col items-center text-center">
              <div className="relative flex items-center justify-center my-1">
                <svg className="size-36 -rotate-90">
                  <circle cx="72" cy="72" r="60" stroke="#E2E8F0" strokeWidth="10" fill="transparent" />
                  <circle cx="72" cy="72" r="60" stroke={color} strokeWidth="10" strokeDasharray={377} strokeDashoffset={377 - (377 * (snap.healthScore ?? 0)) / 100} strokeLinecap="round" fill="transparent" style={{ transition: "stroke-dashoffset 1s ease-out" }} />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-extrabold tracking-tight">{snap.healthScore ?? "—"}</span>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">out of 100</span>
                </div>
              </div>
              <div className="text-lg font-bold mt-1">{label.title}</div>
              <p className="text-xs text-muted-foreground max-w-xs mt-1 leading-relaxed">
                {snap.healthScore === null
                  ? "We need at least 2 of the 6 areas below to calculate a score. Nothing is estimated or assumed."
                  : `Weighted average of the ${scored.length} areas that have data (weights re-balanced to ${weightSum}% → 100%). Areas without data are left out, not guessed.`}
              </p>
              <div className="grid grid-cols-3 gap-2 w-full mt-5 pt-4 border-t border-border/60 text-left">
                <Stat label="Income" value={snap.current.income ? inr(snap.current.income) : "—"} tint="text-emerald-700" />
                <Stat label="Spent" value={snap.current.expense ? inr(snap.current.expense) : "—"} tint="text-rose-700" />
                <Stat label="Runway" value={snap.runwayMonths !== null ? `${snap.runwayMonths.toFixed(1)} mo` : "—"} tint="text-slate-900" />
              </div>
            </div>
          </div>

          {/* Pillars */}
          <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider px-1 flex items-center gap-1.5"><Calculator className="size-3.5" /> What makes up your score</div>
          <div className="space-y-2.5">
            {snap.pillars.map((p, i) => (
              <PillarCard key={p.key} p={p} i={i} open={open === p.key} onToggle={() => { tap(); setOpen(open === p.key ? null : p.key); }} onGo={() => navigate(`/${p.screen}`)} contribution={p.score !== null && weightSum ? Math.round((p.weight / weightSum) * 100) : null} />
            ))}
          </div>

          {/* Net worth breakdown */}
          <div className="bg-card rounded-2xl p-4 border border-border/60 ls-rise">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold">Net worth</div>
              <button onClick={() => navigate("/networth")} className="text-xs font-semibold text-primary">Edit →</button>
            </div>
            {snap.netWorth.hasData ? (
              <>
                <div className={`text-2xl font-black mt-1 ${snap.netWorth.value < 0 ? "text-rose-700" : ""}`}>{snap.netWorth.value < 0 ? "−" : ""}{inr(snap.netWorth.value)}</div>
                <div className="text-[11px] text-muted-foreground">= assets {inr(snap.netWorth.totalAssets)} − loans {inr(snap.netWorth.totalLiab)}</div>
                <Breakdown title="Assets" lines={snap.netWorth.assetLines} positive />
                <Breakdown title="Loans & dues" lines={snap.netWorth.liabLines} />
              </>
            ) : (
              <div className="text-xs text-muted-foreground mt-2">No assets or loans added yet. <button onClick={() => navigate("/networth")} className="text-primary font-semibold">Add them</button> to see your net worth.</div>
            )}
          </div>

          <div className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1"><Lock className="size-3" /> All calculations run on this phone. Nothing is uploaded.</div>
        </div>
      </Screen>
    </>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="bg-muted/60 rounded-2xl p-2.5">
      <div className="text-[10px] text-muted-foreground uppercase font-semibold">{label}</div>
      <div className={`text-xs font-bold mt-0.5 ${tint}`}>{value}</div>
    </div>
  );
}

function PillarCard({ p, i, open, onToggle, onGo, contribution }: { p: Pillar; i: number; open: boolean; onToggle: () => void; onGo: () => void; contribution: number | null }) {
  const has = p.score !== null;
  const color = !has ? "#CBD5E1" : p.score! >= 80 ? "#10B981" : p.score! >= 60 ? "#6366F1" : p.score! >= 40 ? "#F59E0B" : "#F43F5E";
  return (
    <div className="bg-card rounded-2xl border border-border/60 overflow-hidden ls-rise" style={{ animationDelay: `${i * 40}ms` }}>
      <button onClick={onToggle} className="w-full p-4 text-left">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold">{p.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{has ? p.metric : p.missing}</div>
          </div>
          <div className="text-right shrink-0 flex items-center gap-2">
            {has ? (
              <div className="text-lg font-extrabold" style={{ color }}>{p.score}<span className="text-xs text-muted-foreground font-normal">/100</span></div>
            ) : (
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">No data</span>
            )}
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden mt-3">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p.score ?? 0}%`, backgroundColor: color }} />
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 -mt-1 space-y-2">
          <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 leading-relaxed">
            <span className="font-semibold text-slate-800">How it's calculated: </span>{p.basis}
            {contribution !== null && <div className="mt-1 text-[11px] text-slate-500">Counts for {contribution}% of your overall score.</div>}
          </div>
          <button onClick={onGo} className="w-full py-2.5 bg-primary/10 text-primary rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-[0.98]">
            {has ? <><Sparkles className="size-3.5" /> Improve this</> : <><Plus className="size-3.5" /> {p.missing}</>}
          </button>
        </div>
      )}
    </div>
  );
}

function Breakdown({ title, lines, positive }: { title: string; lines: Array<{ label: string; detail?: string; value: number }>; positive?: boolean }) {
  if (!lines.length) return null;
  return (
    <div className="mt-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{title}</div>
      <div className="divide-y divide-border/60">
        {lines.map((l, i) => (
          <div key={i} className="flex items-center justify-between py-1.5">
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate">{l.label}</div>
              {l.detail && <div className="text-[10px] text-muted-foreground capitalize">{l.detail}</div>}
            </div>
            <div className={`text-xs font-bold ${positive ? "text-emerald-700" : "text-rose-700"}`}>{positive ? "" : "−"}{inr(l.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
