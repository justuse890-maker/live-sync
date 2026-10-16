import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowUpRight, Sparkles, ChevronRight, ChevronLeft, Calendar, TrendingUp, TrendingDown, Target, Wallet,
  BarChart3, Activity, Plus, StickyNote, AlertTriangle, CheckCircle2, Info, Receipt, Lock, ShieldCheck,
} from "lucide-react";
import { useStore } from "../../store";
import { inr, ScreenId } from "../types";
import { Screen } from "../Shell";
import { NotificationBell } from "../NotificationBell";
import { APP_VERSION } from "../../data";
import { api } from "../../lib/api";
import { formatMonthName, shiftMonth, getCurrentMonthKey } from "../../lib/dateUtils";
import { computeSnapshot, buildInsights, healthLabel } from "../../lib/snapshot";
import { buildObligations, dueLabel, Obligation } from "../../lib/obligations";
import { tap } from "../../lib/feedback";
import { buildHero } from "../../lib/homeHero";
import { SafeToSpendSheet } from "../SafeToSpendSheet";
import { emiBurden, typicalMonthlyIncome } from "../../lib/emiPlanner";
import { currentInstallment } from "../../lib/loanEngine";
import { readEmiAlertPct } from "../EmiCommand";
import { CaLensCard } from "../CaLensCard";
import { Sparrow } from "../Sparrow";
import { monthlyGreeting } from "../../lib/sparrow";

/**
 * Home. Every figure on this screen is computed by lib/snapshot.ts or
 * lib/obligations.ts from the user's own on-device data. When a figure has no
 * data behind it, the card shows an empty state with the exact action that
 * fills it — never a placeholder number.
 */
export function Dashboard({ go, onAdd }: { go: (id: ScreenId) => void; onAdd?: () => void }) {
  const store = useStore();
  const { ready, transactions, selectedMonth, setSelectedMonth, payBill } = store;
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    api.session().then((s) => {
      const n = (s?.user?.user_metadata?.name as string | undefined)?.trim();
      if (n) setFirstName(n.split(" ")[0]);
    }).catch(() => {});
  }, []);

  const monthFull = formatMonthName(selectedMonth, "full");
  const monthOnly = monthFull.split(" ")[0];
  const monthShort = formatMonthName(selectedMonth, "short").split(" ")[0];
  const isCurrentMonth = selectedMonth === getCurrentMonthKey();

  const snap = useMemo(() => computeSnapshot(store as any, selectedMonth), [
    store.transactions, store.assets, store.liabilities, store.investments, store.gold, store.properties,
    store.structuredLoans, store.loans, store.budgets, store.buckets, store.goals, store.sips, store.insurance, selectedMonth,
  ]);
  const prevSnap = useMemo(() => computeSnapshot(store as any, shiftMonth(selectedMonth, -1)), [
    store.transactions, store.assets, store.liabilities, store.investments, store.gold, store.properties,
    store.structuredLoans, store.loans, store.budgets, store.buckets, store.goals, store.sips, store.insurance, selectedMonth,
  ]);
  const insights = useMemo(() => buildInsights(snap, transactions as any), [snap, transactions]);
  const upcoming = useMemo(() => buildObligations(store as any, 30, 10), [
    store.notes, store.structuredLoans, store.subscriptions, store.creditCards, store.insurance,
    store.householdReminders, store.societyNotices, store.loans,
  ]);

  const todayItems = upcoming.filter((o) => o.overdue || dueLabel(o.dueAt) === "Due today");
  const nextItems = upcoming.filter((o) => !todayItems.includes(o));
  const upcomingTotal = nextItems.reduce((a, o) => a + (o.amount || 0), 0);

  // Income-first headline: what came in, what's gone, what's still to pay this month, what's actually free.
  const monthEnd = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return new Date(y, m, 0, 23, 59, 59, 999);
  }, [selectedMonth]);
  const hero = useMemo(() => buildHero({
    income: snap.current.income,
    expense: snap.current.expense,
    dueAmounts: upcoming.filter((o) => o.amount && (o.overdue || o.dueAt <= monthEnd)).map((o) => o.amount as number),
    isCurrentMonth,
  }), [snap.current.income, snap.current.expense, upcoming, monthEnd, isCurrentMonth]);
  const [mathOpen, setMathOpen] = useState(false);
  const dueItems = useMemo(
    () => upcoming.filter((o) => o.overdue || o.dueAt <= monthEnd).map((o) => ({ title: o.title, amount: o.amount, overdue: o.overdue })),
    [upcoming, monthEnd],
  );
  const pendingTransfer = useMemo(() => {
    const ids = new Map(store.allTransactions.map((t) => [t.id, t]));
    return store.transferSuggestions
      .map((sg) => ({ amount: sg.amount, month: String(ids.get(sg.outId)?.date ?? "").slice(0, 7) }))
      .find((sg) => sg.month === selectedMonth) ?? null;
  }, [store.transferSuggestions, store.allTransactions, selectedMonth]);
  // Chiku's one-line recap of last month, shown in the first week and dismissible for that month.
  const greeting = useMemo(() => monthlyGreeting(transactions as any), [transactions]);
  const [greetingHidden, setGreetingHidden] = useState(() => { try { return localStorage.getItem("ls_chiku_greeted") || ""; } catch { return ""; } });
  const dismissGreeting = () => { if (!greeting) return; setGreetingHidden(greeting.key); try { localStorage.setItem("ls_chiku_greeted", greeting.key); } catch { /* shows again next launch */ } };
  // The "Money in" card is the doorway to the full report once there is something to report.
  const heroTappable = snap.current.txCount > 0;
  const openHero = () => { tap(); go("reports"); };
  const activeLoans = store.structuredLoans.filter((l) => !l.closed);
  const emiTotal = activeLoans.reduce((s, l) => s + currentInstallment(l).amount, 0);
  const emi = useMemo(
    () => emiBurden(typicalMonthlyIncome(transactions), emiTotal, readEmiAlertPct()),
    [transactions, emiTotal],
  );

  const health = healthLabel(snap.healthScore);
  const scoreDelta = snap.healthScore !== null && prevSnap.healthScore !== null ? snap.healthScore - prevSnap.healthScore : null;

  const openObligation = (o: Obligation) => {
    tap();
    if (o.noteId) navigate(`/notes?note=${o.noteId}`);
    else go(o.screen);
  };

  const attention: Array<{ id: string; text: string; cta: string; screen: ScreenId }> = [];
  if (snap.runwayMonths !== null && snap.runwayMonths < 3) {
    attention.push({
      id: "runway",
      text: `Your savings cover ${snap.runwayMonths.toFixed(1)} months of spending (${inr(snap.liquid.total)} ÷ ${inr(snap.avgMonthlyExpense ?? 0)}/mo). 3–6 months is a safer cushion.`,
      cta: "Plan an emergency fund",
      screen: "emergency",
    });
  }
  for (const b of snap.budget.rows.filter((r) => r.spent > r.limit).slice(0, 2)) {
    attention.push({ id: `b-${b.id}`, text: `${b.category} is over budget by ${inr(b.spent - b.limit)} in ${monthOnly}.`, cta: "Review budget", screen: "budgets" });
  }
  if (snap.current.income > 0 && snap.current.net < 0) {
    attention.push({ id: "neg", text: `You've spent ${inr(-snap.current.net)} more than you earned in ${monthOnly}.`, cta: "See where it went", screen: "spending-patterns" });
  }

  const emptyApp = ready && transactions.length === 0 && !snap.netWorth.hasData && snap.goals.length === 0 && store.notes.length === 0;

  return (
    <>
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-[#F8FAFC]/95 backdrop-blur-md border-b border-slate-200/50">
        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm ring-2 ring-indigo-200/60 shrink-0">
              {firstName ? firstName[0].toUpperCase() : "👋"}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight truncate">
                {firstName ? `Hi ${firstName}` : "Hi there"} <span className="inline-block">👋</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1"><Lock className="size-3" /> On this phone · never sold · no SMS reading</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100/90 border border-slate-200/60 rounded-xl px-1.5 py-0.5">
              <button onClick={() => { tap(); setSelectedMonth(shiftMonth(selectedMonth, -1)); }} className="size-6 rounded-lg hover:bg-white flex items-center justify-center text-slate-600 active:scale-90" aria-label="Previous month">
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="text-[11px] font-bold text-slate-800 px-1 min-w-7 text-center">{monthShort}</span>
              <button onClick={() => { tap(); setSelectedMonth(shiftMonth(selectedMonth, 1)); }} className="size-6 rounded-lg hover:bg-white flex items-center justify-center text-slate-600 active:scale-90" aria-label="Next month">
                <ChevronRight className="size-3.5" />
              </button>
            </div>
            <NotificationBell />
          </div>
        </div>
      </div>

      <Screen>
        <div className="px-5 pt-3 pb-28 space-y-4">
          {!ready ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-2xl ls-skeleton" />)}</div>
          ) : (
            <>
              {emptyApp && (
                <div className="rounded-2xl p-5 bg-white border-2 border-[#1E3A8A]/15 ls-rise">
                  <div className="text-base font-bold text-slate-900">Let's set up your money picture</div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">Nothing here is pre-filled. Add your first entry and every card on this screen starts working with your real numbers.</p>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button onClick={() => { tap(); onAdd?.(); }} className="bg-[#1E3A8A] text-white text-xs font-bold py-2.5 rounded-xl active:scale-95">+ Income / expense</button>
                    <button onClick={() => { tap(); navigate("/notes?new=bill"); }} className="bg-white border border-slate-300 text-slate-800 text-xs font-bold py-2.5 rounded-xl active:scale-95">+ Bill reminder</button>
                  </div>
                </div>
              )}

              {greeting && greetingHidden !== greeting.key && (
                <div className="flex items-end gap-2 ls-rise">
                  <button onClick={() => { tap(); go("coach"); }} className="flex items-end gap-2 flex-1 min-w-0 text-left active:scale-[0.99]">
                    <Sparrow mood={greeting.mood} size={56} />
                    <span className="flex-1 bg-card border border-border/60 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs leading-snug text-slate-800">{greeting.text}</span>
                  </button>
                  <button onClick={dismissGreeting} aria-label="Dismiss" className="text-[11px] text-slate-400 font-semibold px-1 pb-2">Hide</button>
                </div>
              )}

              {/* ── 0. Money in — income is the hero ── */}
              {!emptyApp && (
                <div className="ls-rise">
                <div
                  className={heroTappable ? "ls-orbit cursor-pointer active:scale-[0.99] transition-transform" : ""}
                  {...(heroTappable ? { role: "button", tabIndex: 0, "aria-label": `Money in ${monthOnly} — open the full report`, onClick: openHero, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openHero(); } } } : {})}
                >
                <div className={`p-4 shadow-xs ${heroTappable ? "ls-orbit-inner" : "bg-white rounded-2xl border border-slate-200/80"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Money in · {monthOnly}</div>
                    <div className="flex items-center gap-2">
                      {hero.overcommitted && hero.moneyIn > 0 && <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">Over by {inr(-hero.free)}</span>}
                      {heroTappable && <span className="size-7 rounded-full bg-[#1E3A8A]/10 text-[#1E3A8A] flex items-center justify-center shrink-0" aria-hidden="true"><ArrowUpRight className="size-4" /></span>}
                    </div>
                  </div>
                  {hero.moneyIn > 0 ? (
                    <>
                      <div className="font-display text-[34px] leading-none font-black text-slate-900 mt-1.5">{inr(hero.moneyIn)}</div>
                      <div className="mt-3 h-3 w-full rounded-full bg-slate-100 overflow-hidden flex" role="img" aria-label={`Spent ${Math.round(hero.spentPct)} percent, still to pay ${Math.round(hero.duePct)} percent, free ${Math.round(hero.freePct)} percent`}>
                        <div className="h-full bg-rose-400" style={{ width: `${hero.spentPct}%` }} />
                        <div className="h-full bg-amber-400" style={{ width: `${hero.duePct}%` }} />
                        <div className="h-full bg-emerald-500" style={{ width: `${hero.freePct}%` }} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                        <div><div className="flex items-center gap-1 text-slate-500"><span className="size-2 rounded-full bg-rose-400" />Spent</div><div className="text-sm font-bold text-slate-900">{inr(hero.spent)}</div></div>
                        <div><div className="flex items-center gap-1 text-slate-500"><span className="size-2 rounded-full bg-amber-400" />{isCurrentMonth ? "Still to pay" : "Bills"}</div><div className="text-sm font-bold text-slate-900">{isCurrentMonth ? inr(hero.stillToPay) : "—"}</div></div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); tap(); setMathOpen(true); }} aria-label={`${hero.free < 0 ? "Short by" : "Safe to spend"} ${inr(Math.abs(hero.free))}. Show how this is worked out`} className="text-left active:scale-95 transition-transform"><div className="flex items-center gap-1 text-slate-500"><span className="size-2 rounded-full bg-emerald-500" />{hero.free < 0 ? "Short by" : "Safe to spend"}<Info className="size-3 text-slate-400" aria-hidden="true" /></div><div className={`text-sm font-bold ${hero.free < 0 ? "text-rose-700" : "text-emerald-700"}`}>{inr(Math.abs(hero.free))}</div></button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-2">
                      <div className="text-sm text-slate-700 leading-snug">No income recorded for {monthFull} yet. Add your salary or other income and this card shows what is actually free to spend.</div>
                      <button onClick={(e) => { e.stopPropagation(); tap(); onAdd?.(); }} className="mt-3 bg-[#1E3A8A] text-white text-xs font-bold px-4 py-2.5 rounded-xl active:scale-95">+ Add income</button>
                    </div>
                  )}
                  {pendingTransfer && (
                    <button onClick={(e) => { e.stopPropagation(); tap(); go("transactions"); }} className="mt-3 w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold bg-sky-50 text-sky-800 active:scale-[0.99]">
                      <span>{inr(pendingTransfer.amount)} looks like your own transfer — confirm so totals are exact</span>
                      <ChevronRight className="size-3.5 shrink-0" />
                    </button>
                  )}
                  {emi.level !== "none" && emi.level !== "no_income" && (
                    <button onClick={(e) => { e.stopPropagation(); tap(); go("loans"); }} className={`mt-3 w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold active:scale-[0.99] ${emi.level === "high" ? "bg-rose-50 text-rose-800" : emi.level === "watch" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                      <span>EMIs take {Math.round(emi.ratioPct ?? 0)}% of your income</span>
                      <span className="flex items-center gap-1">{emi.level === "high" ? "Over your limit" : emi.level === "watch" ? "Getting heavy" : "Comfortable"} <ChevronRight className="size-3.5" /></span>
                    </button>
                  )}
                </div>
                </div>
                </div>
              )}

              <SafeToSpendSheet open={mathOpen} onClose={() => setMathOpen(false)} hero={hero} dueItems={dueItems} isCurrentMonth={isCurrentMonth} monthLabel={monthFull} />

              <CaLensCard go={go} />

              {/* ── 1. Today ── */}
              <Card className="ls-rise">
                <CardHead icon={Calendar} title="Today" right={todayItems.length > 0 ? (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">
                    {todayItems.length === 1 ? "1 item needs you" : `${todayItems.length} items need you`}
                  </span>
                ) : undefined} />
                {todayItems.length === 0 ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                    <div className="flex-1 text-xs text-emerald-800 font-medium">
                      {upcoming.length === 0 ? "No bills or reminders yet. Add EMIs, rent or utility bills to get reminded on time." : "Nothing due today. You're on top of things."}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayItems.slice(0, 3).map((o) => (
                      <div key={o.id} className={`flex items-center gap-3 p-3 rounded-xl border ${o.overdue ? "bg-rose-50/70 border-rose-100" : "bg-slate-50/80 border-slate-100"}`}>
                        <button onClick={() => openObligation(o)} className="flex-1 min-w-0 text-left">
                          <div className="text-sm font-bold text-slate-900 truncate">{o.title}</div>
                          <div className={`text-xs font-medium ${o.overdue ? "text-rose-600" : "text-slate-500"}`}>
                            {o.amount ? `${inr(o.amount)} · ` : ""}{dueLabel(o.dueAt)}
                          </div>
                        </button>
                        {o.source === "bill" && o.noteId ? (
                          <button onClick={() => payBill(o.noteId!)} className="bg-[#1E3A8A] text-white text-xs font-bold px-3.5 py-2 rounded-full active:scale-95 shrink-0">Mark paid</button>
                        ) : (
                          <button onClick={() => openObligation(o)} className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-full active:scale-95 shrink-0">Open</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => { tap(); navigate("/notes?new=bill"); }} className="w-full mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-semibold">
                  <span className="flex items-center gap-1.5"><Plus className="size-3.5" /> Add bill or reminder</span>
                  <ChevronRight className="size-4" />
                </button>
              </Card>

              {/* ── 2. Coming up (next 30 days) ── */}
              {nextItems.length > 0 && (
                <Card className="ls-rise">
                  <CardHead icon={Receipt} title="Coming up in 30 days" onMore={() => navigate("/notes?tab=reminders")} moreLabel="All" />
                  {upcomingTotal > 0 && (
                    <div className="text-xs text-slate-500 mb-2">
                      <span className="text-lg font-black text-slate-900">{inr(upcomingTotal)}</span> {`to pay across ${nextItems.filter((o) => o.amount).length} bills`}
                    </div>
                  )}
                  <div className="divide-y divide-slate-100">
                    {nextItems.slice(0, 4).map((o) => (
                      <button key={o.id} onClick={() => openObligation(o)} className="w-full flex items-center justify-between py-2 text-left active:bg-slate-50">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate">{o.title}</div>
                          <div className="text-[11px] text-slate-500">{dueLabel(o.dueAt)}</div>
                        </div>
                        <div className="text-sm font-bold text-slate-900 shrink-0 ml-2">{o.amount ? inr(o.amount) : <span className="text-[11px] text-slate-400 font-medium">No amount</span>}</div>
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {/* ── 4. Financial snapshot ── */}
              <Card className="ls-rise">
                <CardHead icon={Activity} title="Financial snapshot" onMore={() => go("health")} moreLabel="How it's calculated" />
                {snap.healthScore === null ? (
                  <div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Your health score needs at least two of these to be filled. We don't guess — add what applies to you:
                    </p>
                    <div className="mt-3 space-y-1.5">
                      {snap.pillars.filter((p) => p.score === null).slice(0, 4).map((p) => (
                        <button key={p.key} onClick={() => { tap(); go(p.screen as ScreenId); }} className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-left active:scale-[0.99]">
                          <span className="text-xs font-semibold text-slate-800">{p.missing}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 py-1">
                    <ScoreRing score={snap.healthScore} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-500 font-medium">{`Based on ${snap.scoredCount} of 6 areas`}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-lg font-black text-slate-900">{health.title}</span>
                        {scoreDelta !== null && scoreDelta !== 0 && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${scoreDelta > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                            {`${scoreDelta > 0 ? "+" : ""}${scoreDelta} vs ${prevSnap.current.label}`}
                          </span>
                        )}
                      </div>
                      {snap.scoredCount < 6 && (
                        <button onClick={() => go("health")} className="mt-1.5 text-[11px] font-semibold text-indigo-600">
                          {6 - snap.scoredCount === 1 ? "Add 1 more area for a fuller score →" : `Add ${6 - snap.scoredCount} more areas for a fuller score →`}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
                  <button onClick={() => { tap(); go("networth"); }} className="text-left">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Net worth</div>
                    {snap.netWorth.hasData ? (
                      <>
                        <div className={`text-sm font-black mt-0.5 truncate ${snap.netWorth.value < 0 ? "text-rose-700" : "text-slate-900"}`}>{snap.netWorth.value < 0 ? "−" : ""}{inr(snap.netWorth.value)}</div>
                        <div className="text-[10px] text-slate-400">{`${snap.netWorth.assetLines.length} assets · ${snap.netWorth.liabLines.length} loans`}</div>
                      </>
                    ) : (
                      <div className="text-[11px] font-semibold text-indigo-600 mt-0.5">+ Add assets & loans</div>
                    )}
                  </button>
                  <button onClick={() => { tap(); go("emergency"); }} className="text-left">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Emergency runway</div>
                    {snap.runwayMonths !== null ? (
                      <>
                        <div className="text-sm font-black text-slate-900 mt-0.5">{`${snap.runwayMonths.toFixed(1)} months`}</div>
                        <div className="h-1 rounded-full bg-slate-100 overflow-hidden mt-1"><div className="h-full bg-blue-600 rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (snap.runwayMonths / 6) * 100)}%` }} /></div>
                      </>
                    ) : (
                      <div className="text-[11px] font-medium text-slate-400 mt-0.5">{snap.liquid.total > 0 ? "Add expenses to calculate" : "Add savings balance"}</div>
                    )}
                  </button>
                </div>
              </Card>

              {/* ── 5. Needs attention (only when something real is wrong) ── */}
              {attention.length > 0 && (
                <div className="rounded-2xl p-4 bg-rose-50/70 border border-rose-200/80 ls-rise">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="size-4 text-rose-600" />
                    <span className="text-sm font-bold text-rose-800">{attention.length === 1 ? "1 thing needs attention" : `${attention.length} things need attention`}</span>
                  </div>
                  <div className="space-y-2">
                    {attention.map((a) => (
                      <button key={a.id} onClick={() => { tap(); go(a.screen); }} className="w-full text-left bg-white/80 border border-rose-100 rounded-xl p-3 active:scale-[0.99]">
                        <p className="text-xs text-rose-800 leading-relaxed">{a.text}</p>
                        <span className="text-[11px] font-bold text-rose-700 mt-1 inline-flex items-center gap-0.5">{a.cta} <ChevronRight className="size-3" /></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 6. Goals ── */}
              <Card className="ls-rise">
                <CardHead icon={Target} title="Your goals" onMore={snap.goals.length ? () => go("buckets") : undefined} moreLabel="See all" />
                {snap.goals.length === 0 ? (
                  <EmptyState text="No savings goals yet. Create one for a trip, gadget or emergency fund and track it here." cta="Create a goal" onCta={() => go("buckets")} />
                ) : (
                  <div className="space-y-3.5">
                    {snap.goals.slice(0, 3).map((g) => (
                      <button key={g.id} onClick={() => { tap(); navigate(g.kind === "bucket" ? `/buckets/${g.id}` : "/goals"); }} className="w-full text-left group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900 truncate">{g.name}</span>
                          <span className="text-xs font-extrabold text-slate-700">{g.pct}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full transition-all duration-700" style={{ width: `${g.pct}%` }} />
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-1">{`${inr(g.saved)} of ${inr(g.target)}`}</div>
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              {/* ── 7. Budget ── */}
              <Card className="ls-rise">
                <CardHead icon={BarChart3} title={`${monthOnly} budget`} onMore={() => go("budgets")} moreLabel={snap.budget.rows.length ? "See details" : "Set up"} />
                {snap.budget.rows.length === 0 ? (
                  <EmptyState text={`No budget set for ${monthFull}. Set limits for categories like Food or Shopping and we'll track them automatically.`} cta="Set a budget" onCta={() => go("budgets")} />
                ) : (
                  <div>
                    <div className="flex items-baseline justify-between">
                      <div className="text-sm font-black text-slate-900">{inr(snap.budget.spent)} <span className="text-xs font-semibold text-slate-400">/ {inr(snap.budget.limit)}</span></div>
                      {snap.budget.daysLeft !== null && <div className="text-xs font-semibold text-slate-500">{`${snap.budget.daysLeft} days left`}</div>}
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden my-1.5">
                      <div className={`h-full rounded-full transition-all duration-700 ${snap.budget.spent > snap.budget.limit ? "bg-rose-500" : snap.budget.spent / snap.budget.limit > 0.85 ? "bg-amber-500" : "bg-blue-600"}`} style={{ width: `${Math.min(100, (snap.budget.spent / snap.budget.limit) * 100)}%` }} />
                    </div>
                    <div className="text-[11px] font-bold text-slate-600">
                      {snap.budget.rows.length === 1 ? `${Math.round((snap.budget.spent / snap.budget.limit) * 100)}% used across 1 category` : `${Math.round((snap.budget.spent / snap.budget.limit) * 100)}% used across ${snap.budget.rows.length} categories`}
                    </div>
                  </div>
                )}
              </Card>

              {/* ── 8. Insights (only true statements from your data) ── */}
              {insights.length > 0 && (
                <div className="ls-rise">
                  <div className="flex items-center justify-between mb-2.5 px-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-indigo-700" />
                      <span className="text-sm font-bold text-slate-900">From your numbers</span>
                    </div>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1"><ShieldCheck className="size-3" /> Computed on device</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                    {insights.map((i) => {
                      const Icon = i.tone === "good" ? TrendingDown : i.tone === "warn" ? TrendingUp : Info;
                      return (
                        <button key={i.id} onClick={() => { tap(); go(i.screen as ScreenId); }} className="min-w-[210px] flex-1 bg-white p-3.5 rounded-2xl border border-slate-200/80 text-left active:scale-[0.98]">
                          <div className={`size-8 rounded-xl flex items-center justify-center mb-2 ${i.tone === "good" ? "bg-emerald-100 text-emerald-700" : i.tone === "warn" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"}`}>
                            <Icon className="size-4" />
                          </div>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">{i.text}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── 9. Notes shortcut ── */}
              <button onClick={() => { tap(); navigate("/notes"); }} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200/70 text-left active:scale-[0.99] ls-rise">
                <div className="size-10 rounded-xl bg-amber-400/90 text-white flex items-center justify-center"><StickyNote className="size-5" /></div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-900">Notes & reminders</div>
                  <div className="text-xs text-slate-600">{store.notes.filter((n) => !n.archived).length ? `${store.notes.filter((n) => !n.archived).length} notes · ${upcoming.length} upcoming` : "Jot down bills, home expenses & to-dos"}</div>
                </div>
                <ChevronRight className="size-4 text-slate-400" />
              </button>

              <div className="text-center text-[10px] text-slate-400 font-medium py-1 flex items-center justify-center gap-1">
                <Lock className="size-3" /> LiveSync v{APP_VERSION} · stored only on this device
              </div>
            </>
          )}
        </div>
      </Screen>
    </>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs ${className}`}>{children}</div>;
}

function CardHead({ icon: Icon, title, onMore, moreLabel = "See details", right }: { icon: typeof Wallet; title: string; onMore?: () => void; moreLabel?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-indigo-700" />
        <span className="text-sm font-bold text-slate-900">{title}</span>
      </div>
      {right ?? (onMore && (
        <button onClick={() => { tap(); onMore(); }} className="text-xs font-semibold text-indigo-600 flex items-center gap-0.5 active:scale-95">
          {moreLabel} <ChevronRight className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

function EmptyState({ text, cta, onCta }: { text: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-4 text-center">
      <p className="text-xs text-slate-500 leading-relaxed">{text}</p>
      {cta && onCta && (
        <button onClick={() => { tap(); onCta(); }} className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-3.5 py-1.5 rounded-full active:scale-95">
          <Plus className="size-3.5" /> {cta}
        </button>
      )}
    </div>
  );
}


function ScoreRing({ score }: { score: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = setTimeout(() => setShown(score), 60); return () => clearTimeout(t); }, [score]);
  const c = 2 * Math.PI * 28;
  const color = score >= 85 ? "#10B981" : score >= 70 ? "#4F46E5" : score >= 50 ? "#F59E0B" : "#F43F5E";
  return (
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 70 70" className="size-20 -rotate-90">
        <circle cx="35" cy="35" r="28" stroke="#E2E8F0" strokeWidth="6" fill="none" />
        <circle cx="35" cy="35" r="28" stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-black text-slate-900 leading-none">{score}</span>
        <span className="text-[10px] font-semibold text-slate-500">/100</span>
      </div>
    </div>
  );
}

