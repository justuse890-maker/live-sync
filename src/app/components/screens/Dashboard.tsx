import { useMemo, useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Sparkles,
  Shield,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wallet,
  Calendar,
  ChevronLeft,
  Droplets,
  Flame,
  TrendingUp,
  PlusCircle,
  ArrowRightLeft,
  CreditCard as CreditCardIcon,
  PieChart,
  Repeat,
  Layers,
  Zap,
  Tag
} from "lucide-react";
import { useStore } from "../../store";
import { inr, ScreenId } from "../types";
import { Header, Screen } from "../Shell";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { netWorth, detectLeaks, lifestyleInflation, fire, monthlyFlow, spendingAnomalies, upcomingBigBills } from "../../lib/intelligence";
import { api } from "../../lib/api";
import { getMonthKey, formatMonthName, shiftMonth, getMonthString } from "../../lib/dateUtils";
import { ForecastCard } from "../ForecastCard";
import { ActionCard } from "../ActionCard";

const severityStyle = {
  success: { bg: "bg-emerald-50", text: "text-emerald-700", Icon: CheckCircle2 },
  warning: { bg: "bg-amber-50", text: "text-amber-700", Icon: AlertTriangle },
  danger: { bg: "bg-rose-50", text: "text-rose-700", Icon: XCircle },
};

function sanitizeDisplayString(val?: any, fallback = "Goal"): string {
  if (!val || typeof val !== "string") return fallback;
  if (val.startsWith("enc:")) return fallback;
  return val;
}

function sanitizeDisplayNumber(val?: any): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (typeof val === "string" && !val.startsWith("enc:")) {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

export function Dashboard({ go }: { go: (id: ScreenId) => void }) {
  const {
    ready,
    transactions,
    subscriptions,
    assets,
    liabilities,
    buckets,
    creditCards,
    budgets,
    selectedMonth,
    setSelectedMonth,
    addBucketContribution
  } = useStore();
  const [userName, setUserName] = useState("there");
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Fetch real user name from Supabase auth
  useEffect(() => {
    (async () => {
      try {
        const session = await api.session();
        const name = session?.user?.user_metadata?.name;
        if (name) setUserName(name.split(" ")[0]);
      } catch { /* use default */ }
    })();
  }, []);

  // Track when data was last synced from the server
  useEffect(() => {
    if (ready) setLastSynced(new Date());
  }, [ready]);

  // Cycle Months
  const handlePrevMonth = () => {
    setSelectedMonth(shiftMonth(selectedMonth, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(shiftMonth(selectedMonth, 1));
  };

  // Filter transactions for selected month
  const monthlyTx = useMemo(() => {
    return transactions.filter(t => getMonthKey(t.date) === selectedMonth);
  }, [transactions, selectedMonth]);

  // Dynamic calculations from real data
  const monthlyIncome = useMemo(() => {
    return monthlyTx.filter(t => t.type === "income").reduce((s, t) => s + sanitizeDisplayNumber(t.amount), 0);
  }, [monthlyTx]);

  const monthlyExpenses = useMemo(() => {
    return monthlyTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(sanitizeDisplayNumber(t.amount)), 0);
  }, [monthlyTx]);

  const netSavings = monthlyIncome - monthlyExpenses;
  const pct = monthlyIncome > 0 ? (netSavings / monthlyIncome) * 100 : 0;

  // Intelligence calculations
  const leaks = useMemo(() => detectLeaks(transactions, subscriptions), [transactions, subscriptions]);
  const nw = useMemo(() => netWorth(assets, liabilities), [assets, liabilities]);
  const livenw = nw.netWorth;
  const inflation = useMemo(() => lifestyleInflation(transactions), [transactions]);
  const monthlyBurn = useMemo(() => Math.max(monthlyExpenses, 1), [monthlyExpenses]);
  const liquidAssets = useMemo(() => {
    return assets.filter(a => a.category === "cash" || a.category === "savings" || a.category === "investment").reduce((s, a) => s + sanitizeDisplayNumber(a.value), 0);
  }, [assets]);
  const emergencyMonths = Math.round((liquidAssets / monthlyBurn) * 10) / 10;
  const fireR = useMemo(() => fire(monthlyExpenses || 1, Math.max(0, livenw), 28), [monthlyExpenses, livenw]);

  // Compute Card Desk quick overview
  const cardDeskStats = useMemo(() => {
    const cardsList = creditCards.filter(c => !c.cardType || c.cardType === "credit" || c.cardType === "corporate" || c.cardType === "rupay_upi");
    const totalLimit = cardsList.reduce((s, c) => s + (c.creditLimit || 0), 0);
    const totalSpend = monthlyTx.filter(t => t.type === "expense" && t.creditCardId).reduce((s, t) => s + Math.abs(sanitizeDisplayNumber(t.amount)), 0);
    const utilization = totalLimit > 0 ? Math.min(100, (totalSpend / totalLimit) * 100) : 0;
    return { count: creditCards.length, totalLimit, totalSpend, utilization };
  }, [creditCards, monthlyTx]);

  // Compute Budgets quick overview
  const budgetStats = useMemo(() => {
    const totalLimit = budgets.reduce((s, b) => s + (b.limit || 0), 0);
    const totalSpent = budgets.reduce((s, b) => s + (b.spent || 0), 0);
    const pctUsed = totalLimit > 0 ? Math.min(100, (totalSpent / totalLimit) * 100) : 0;
    return { totalLimit, totalSpent, pctUsed, count: budgets.length };
  }, [budgets]);

  // Compute health score from real data — 0-based, every point earned from actual data
  const healthScore = useMemo(() => {
    let score = 0;
    if (transactions.length > 0) score += 5;
    if (monthlyIncome > 0) score += 20;
    if (netSavings > 0 && monthlyIncome > 0) score += Math.min(20, (pct / 30) * 20);
    if (livenw > 0) score += 10;
    if (monthlyExpenses > 0 && monthlyIncome > monthlyExpenses) score += 15;
    if (monthlyIncome > 0 && leaks.totalAnnual < monthlyIncome * 0.1) score += 10;
    if (buckets.length > 0) score += 5;
    if (leaks.totalAnnual === 0 && transactions.length > 0) score += 15;
    return Math.min(100, Math.round(score));
  }, [transactions, netSavings, monthlyIncome, pct, livenw, buckets, leaks, monthlyExpenses]);

  // 6-Month Cash Flow Trend Data
  const cashFlowData = useMemo(() => {
    return [5, 4, 3, 2, 1, 0].map(offset => {
      const monthKey = shiftMonth(selectedMonth, -offset);
      const txs = transactions.filter(t => getMonthKey(t.date) === monthKey);
      const inc = txs.filter(t => t.type === "income").reduce((s, t) => s + sanitizeDisplayNumber(t.amount), 0);
      const exp = txs.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(sanitizeDisplayNumber(t.amount)), 0);
      return {
        month: formatMonthName(monthKey, "short"),
        fullMonth: formatMonthName(monthKey, "full"),
        monthKey,
        isCurrent: offset === 0,
        income: inc,
        expenses: exp,
        savings: Math.max(0, inc - exp)
      };
    });
  }, [transactions, selectedMonth]);

  const sixMonthExpenses = useMemo(() => cashFlowData.reduce((s, d) => s + d.expenses, 0), [cashFlowData]);

  // Financial Focus is a small, explainable feed based only on recorded data.
  const dynamicInsights = useMemo(() => {
    const insights: { id: string; title: string; body: string; action: string; target: ScreenId; severity: "success" | "warning" | "danger" }[] = [];
    const cardAlerts = creditCards.map((card) => {
      const trackedSpend = monthlyTx.filter((tx) => tx.type === "expense" && tx.creditCardId === card.id).reduce((sum, tx) => sum + Math.abs(sanitizeDisplayNumber(tx.amount)), 0);
      const cardLimit = sanitizeDisplayNumber(card.creditLimit);
      return { card, trackedSpend, usage: cardLimit > 0 ? (trackedSpend / cardLimit) * 100 : 0 };
    }).filter(({ usage }) => usage >= 30).sort((a, b) => b.usage - a.usage);
    if (cardAlerts[0]) {
      const { card, usage } = cardAlerts[0];
      const cardName = sanitizeDisplayString(card.cardName, "Card");
      insights.push({ id: `card-${card.id}`, title: `${cardName} usage is ${usage.toFixed(0)}%`, body: "This is based on expenses linked to this card during the selected month, not an issuer balance.", action: "Open Card Desk", target: "cards", severity: usage >= 50 ? "danger" : "warning" });
    }
    if (pct > 30) insights.push({ id: "save", title: "Strong savings rate", body: `Recorded income and expenses show ${pct.toFixed(0)}% saved this month.`, action: "View goals", target: "buckets", severity: "success" });
    if (pct < 10 && monthlyIncome > 0) insights.push({ id: "low-save", title: "Savings are below 10%", body: `Recorded income and expenses leave ${pct.toFixed(0)}% this month.`, action: "View budgets", target: "budgets", severity: "warning" });
    if (leaks.totalAnnual > 5000) insights.push({ id: "leak", title: `Possible recurring cost: ₹${Math.round(leaks.totalAnnual).toLocaleString("en-IN")}/year`, body: "This estimate comes from recurring charges and subscriptions in your recorded data.", action: "Review costs", target: "leakage", severity: "danger" });
    if (buckets.length > 0) {
      const topGoal = buckets[0];
      const savedNum = sanitizeDisplayNumber(topGoal.savedAmount);
      const targetNum = sanitizeDisplayNumber(topGoal.targetAmount);
      const gPct = targetNum > 0 ? (savedNum / targetNum) * 100 : 0;
      const goalName = sanitizeDisplayString(topGoal.name, "Goal");
      insights.push({
        id: "goal",
        title: `${goalName}: ${gPct.toFixed(0)}% complete`,
        body: `₹${savedNum.toLocaleString("en-IN")} of ₹${targetNum.toLocaleString("en-IN")} recorded.`,
        action: "View goals",
        target: "buckets",
        severity: gPct > 50 ? "success" : "warning"
      });
    }

    const anomalies = spendingAnomalies(transactions, selectedMonth, 3);
    if (anomalies[0] && anomalies[0].direction === "spike") {
      const a = anomalies[0];
      insights.push({
        id: `anomaly-${a.category}`,
        title: `${a.category} spend is ${Math.abs(a.deviation).toFixed(0)}% above your usual`,
        body: `You've spent ₹${Math.round(a.currentAmount).toLocaleString("en-IN")} vs your ~₹${Math.round(a.averageAmount).toLocaleString("en-IN")} average — worth a look, not a judgment.`,
        action: "Review spending",
        target: "spending-patterns",
        severity: Math.abs(a.deviation) > 50 ? "danger" : "warning",
      });
    }

    const bigBills = upcomingBigBills(transactions, 21);
    if (bigBills[0]) {
      const b = bigBills[0];
      insights.push({
        id: `bigbill-${b.title}`,
        title: `${b.title}: ₹${b.amount.toLocaleString("en-IN")} due in ${b.dueInDays} day${b.dueInDays === 1 ? "" : "s"}`,
        body: `This ${b.cadence} charge is coming up based on your payment history — budget for it now.`,
        action: "View timeline",
        target: "timeline",
        severity: b.dueInDays <= 7 ? "danger" : "warning",
      });
    }

    if (insights.length === 0 && transactions.length === 0) {
      insights.push({ id: "start", title: "Start your financial picture", body: "Add a transaction to unlock summaries based on your own records.", action: "Add transaction", target: "transactions", severity: "success" });
    }
    return insights.slice(0, 3);
  }, [pct, monthlyIncome, leaks, buckets, transactions, creditCards, monthlyTx, selectedMonth]);

  const hasData = transactions.length > 0;

  return (
    <>
      <Header title={`Good morning, ${userName}`} subtitle={formatMonthName(selectedMonth)} />
      <Screen>
        {!ready ? (
          <div className="px-5 pt-4 space-y-5 animate-pulse">
            <div className="bg-muted rounded-2xl h-12" />
            <div className="bg-muted rounded-2xl h-44" />
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted rounded-2xl h-24" />
              <div className="bg-muted rounded-2xl h-24" />
            </div>
            <div className="bg-muted rounded-2xl h-28" />
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted rounded-2xl h-20" />
              <div className="bg-muted rounded-2xl h-20" />
              <div className="bg-muted rounded-2xl h-20" />
            </div>
          </div>
        ) : (
        <div className="px-5 pt-4 space-y-5">
          
          {/* Month Selector Carousel */}
          <div className="flex justify-between items-center bg-card rounded-2xl p-3.5 border border-border/60 shadow-sm">
            <button onClick={handlePrevMonth} className="size-9 bg-muted hover:bg-muted/80 rounded-xl flex items-center justify-center transition active:scale-95">
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-display text-sm font-bold text-slate-800 dark:text-slate-100">{formatMonthName(selectedMonth)}</span>
            <button onClick={handleNextMonth} className="size-9 bg-muted hover:bg-muted/80 rounded-xl flex items-center justify-center transition active:scale-95">
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Quick Action Shortcuts Hub */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => go("cards")}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-card border border-border/70 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition group"
            >
              <div className="size-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                <CreditCardIcon className="size-4" />
              </div>
              <span className="text-[10px] font-bold text-foreground">Card Desk</span>
            </button>

            <button
              onClick={() => go("money-flow")}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-card border border-border/70 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition group"
            >
              <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                <Layers className="size-4" />
              </div>
              <span className="text-[10px] font-bold text-foreground">Money Flow</span>
            </button>

            <button
              onClick={() => go("budgets")}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-card border border-border/70 hover:border-amber-500/50 hover:bg-amber-500/5 transition group"
            >
              <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                <PieChart className="size-4" />
              </div>
              <span className="text-[10px] font-bold text-foreground">Budgets</span>
            </button>

            <button
              onClick={() => go("timeline")}
              className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-card border border-border/70 hover:border-purple-500/50 hover:bg-purple-500/5 transition group"
            >
              <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                <Calendar className="size-4" />
              </div>
              <span className="text-[10px] font-bold text-foreground">Timeline</span>
            </button>
          </div>

          {/* Health score hero */}
          <button onClick={() => go("health")} className="w-full text-left">
            <div className="rounded-3xl p-5 bg-gradient-to-br from-primary via-indigo-600 to-indigo-800 text-white shadow-lg shadow-primary/20">
              <div className="flex items-center gap-4">
                <ScoreRing score={healthScore} />
                <div className="flex-1">
                  <div className="text-white/70 text-xs uppercase tracking-wider font-semibold">Financial Health</div>
                  <div className="font-display text-3xl font-black mt-0.5 leading-none">
                    {healthScore}/100
                  </div>
                  <div className="text-white/85 text-xs font-semibold mt-1">
                    {healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Good" : healthScore >= 35 ? "Improving" : "Needs attention"}
                  </div>
                </div>
                <ChevronRight className="size-5 text-white/70" />
              </div>
              <div className="mt-4 pt-4 border-t border-white/15 grid grid-cols-3 gap-3">
                <Metric label="Net worth" value={inr(livenw)} />
                <Metric label="FIRE %" value={`${fireR.progress.toFixed(0)}%`} />
                <Metric label="Runway" value={emergencyMonths > 0 ? `${emergencyMonths}m` : "—"} />
              </div>
            </div>
          </button>

          {/* Cash flow forecast card */}
          <ForecastCard transactions={transactions} currentBalance={liquidAssets} safetyLine={Math.max(monthlyExpenses * 0.5, 5000)} />

          {/* Wealth intelligence row */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => go("networth")} className="text-left bg-card rounded-2xl p-4 border border-border/60 hover:border-primary/40 transition">
              <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2"><Wallet className="size-4" /></div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Net worth</div>
              <div className="font-display mt-0.5 text-base font-black">{inr(livenw)}</div>
            </button>
            <button onClick={() => go("leakage")} className="text-left bg-card rounded-2xl p-4 border border-border/60 hover:border-rose-400 transition">
              <div className="size-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-2"><Droplets className="size-4" /></div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Annual leakage</div>
              <div className="font-display text-rose-600 mt-0.5 text-base font-black">{inr(Math.round(leaks.totalAnnual))}</div>
            </button>
            <button onClick={() => go("fire")} className="text-left bg-card rounded-2xl p-4 border border-border/60 hover:border-violet-400 transition">
              <div className="size-9 rounded-lg flex items-center justify-center mb-2" style={{ background: "#8B5CF615", color: "#8B5CF6" }}><Flame className="size-4" /></div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">FIRE progress</div>
              <div className="font-display mt-0.5 text-base font-black">{fireR.progress.toFixed(1)}%</div>
            </button>
            <button onClick={() => go("inflation")} className="text-left bg-card rounded-2xl p-4 border border-border/60 hover:border-amber-400 transition">
              <div className="size-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2"><TrendingUp className="size-4" /></div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Lifestyle inflation</div>
              <div className={`font-display mt-0.5 text-base font-black ${inflation.verdict === "outpacing" ? "text-rose-600" : "text-emerald-600"}`}>{inflation.gap > 0 ? "+" : ""}{inflation.gap.toFixed(1)}%</div>
            </button>
          </div>

          {/* Card Desk Live Widget */}
          {creditCards.length > 0 && (
            <button onClick={() => go("cards")} className="w-full text-left">
              <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 to-blue-50/70 p-4 shadow-xs dark:from-indigo-950/40 dark:to-blue-950/30 dark:border-indigo-900/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                      <CreditCardIcon className="size-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                        Card Desk ({cardDeskStats.count} Active Cards)
                      </div>
                      <div className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80">
                        Monthly Spend: {inr(cardDeskStats.totalSpend)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-black ${cardDeskStats.utilization > 30 ? "text-rose-600" : "text-emerald-600"}`}>
                      {cardDeskStats.utilization.toFixed(0)}% Used
                    </span>
                    <ChevronRight className="size-4 text-indigo-400 inline ml-1" />
                  </div>
                </div>

                {cardDeskStats.totalLimit > 0 && (
                  <div className="h-1.5 rounded-full bg-indigo-200/60 dark:bg-indigo-900 overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full ${cardDeskStats.utilization > 30 ? "bg-rose-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, cardDeskStats.utilization)}%` }}
                    />
                  </div>
                )}
              </div>
            </button>
          )}

          {/* Budget Health Quick Widget */}
          {budgets.length > 0 && (
            <button onClick={() => go("budgets")} className="w-full text-left">
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/90 to-yellow-50/70 p-4 shadow-xs dark:from-amber-950/40 dark:to-yellow-950/30 dark:border-amber-900/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="size-8 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                      <PieChart className="size-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-amber-950 dark:text-amber-200">
                        Monthly Budgets ({budgetStats.count} Tracked)
                      </div>
                      <div className="text-[10px] text-amber-700/80 dark:text-amber-300/80">
                        {inr(budgetStats.totalSpent)} spent of {inr(budgetStats.totalLimit)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-black ${budgetStats.pctUsed > 90 ? "text-rose-600" : "text-amber-700 dark:text-amber-300"}`}>
                      {budgetStats.pctUsed.toFixed(0)}%
                    </span>
                    <ChevronRight className="size-4 text-amber-400 inline ml-1" />
                  </div>
                </div>

                <div className="h-1.5 rounded-full bg-amber-200/60 dark:bg-amber-900 overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full ${budgetStats.pctUsed > 90 ? "bg-rose-500" : "bg-amber-500"}`}
                    style={{ width: `${Math.min(100, budgetStats.pctUsed)}%` }}
                  />
                </div>
              </div>
            </button>
          )}

          {/* Spending leaks alert */}
          {leaks.leaks.some((leak) => ["Micro Leaks", "Frequency", "Recurring"].includes(leak.category)) && (
            <button onClick={() => go("leakage")} className="w-full text-left rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-rose-600 text-white flex items-center justify-center"><Droplets className="size-5" /></div>
                <div className="flex-1"><div className="text-sm text-rose-950 font-bold">New spending leaks detected</div><div className="text-xs text-rose-700 mt-0.5">Review small spends, frequency changes, and recurring charges.</div></div>
                <ChevronRight className="size-4 text-rose-600" />
              </div>
            </button>
          )}

          {/* Money Flow Banner */}
          <button onClick={() => go("money-flow")} className="w-full text-left rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center"><ArrowRightLeft className="size-5" /></div>
              <div className="flex-1"><div className="text-sm font-bold text-foreground">Money Flow (Sankey)</div><div className="text-xs text-muted-foreground">Inflow branches to essentials, lifestyle &amp; future surplus</div></div>
              <ChevronRight className="size-4 text-indigo-600" />
            </div>
          </button>

          {/* Financial Timeline */}
          <button onClick={() => go("timeline")} className="w-full text-left">
            <Card>
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Calendar className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-foreground">Financial Timeline</div>
                  <div className="text-xs text-muted-foreground">Salary, bills, SIPs, taxes, goals — one view</div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Card>
          </button>

          {/* Cash flow Area Chart */}
          <Card>
            <SectionHead 
              title="Cash flow" 
              subtitle={`6-month overview · ${formatMonthName(selectedMonth, "short")}`} 
              onMore={() => go("reports")} 
            />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Stat 
                label={`Income (${formatMonthName(selectedMonth, "short")})`} 
                value={inr(monthlyIncome)} 
                icon={<ArrowUpRight className="size-3.5" />} 
                tone="up" 
              />
              <Stat 
                label={`Expenses (${formatMonthName(selectedMonth, "short")})`} 
                value={inr(monthlyExpenses)} 
                icon={<ArrowDownRight className="size-3.5" />} 
                tone="down" 
              />
            </div>
            {hasData ? (
              <>
                <div className="h-36 -mx-2 pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashFlowData} margin={{ top: 12, right: 18, left: 18, bottom: 2 }}>
                      <defs key="dash-defs">
                        <linearGradient key="dash-grad-income" id="dash-income" x1="0" y1="0" x2="0" y2="1">
                          <stop key="i0" offset="0%" stopColor="#1E40AF" stopOpacity={0.35} />
                          <stop key="i1" offset="100%" stopColor="#1E40AF" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient key="dash-grad-expenses" id="dash-expenses" x1="0" y1="0" x2="0" y2="1">
                          <stop key="e0" offset="0%" stopColor="#EF4444" stopOpacity={0.25} />
                          <stop key="e1" offset="100%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis 
                        key="dash-x" 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false} 
                        interval={0}
                        padding={{ left: 8, right: 8 }}
                        tick={{ fontSize: 11, fill: "#64748B", fontWeight: 500 }} 
                      />
                      <Tooltip key="dash-tip" content={<ChartTip />} />
                      <Area 
                        key="a-income" 
                        type="monotone" 
                        dataKey="income" 
                        stroke="#1E40AF" 
                        strokeWidth={2.5} 
                        fill="url(#dash-income)" 
                        dot={{ r: 3, fill: '#1E40AF', strokeWidth: 0 }} 
                        activeDot={{ r: 5, fill: '#1E40AF', stroke: '#fff', strokeWidth: 2 }} 
                        isAnimationActive={false} 
                        legendType="none" 
                      />
                      <Area 
                        key="a-expenses" 
                        type="monotone" 
                        dataKey="expenses" 
                        stroke="#EF4444" 
                        strokeWidth={2.5} 
                        fill="url(#dash-expenses)" 
                        dot={{ r: 3, fill: '#EF4444', strokeWidth: 0 }} 
                        activeDot={{ r: 5, fill: '#EF4444', stroke: '#fff', strokeWidth: 2 }} 
                        isAnimationActive={false} 
                        legendType="none" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40">
                  <span>{pct > 0 ? `Savings rate: ${pct.toFixed(0)}%` : "6-month overview"}</span>
                  <span className="font-medium text-slate-700">6-mo total: {inr(sixMonthExpenses)}</span>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="text-xs text-muted-foreground">Add transactions to see your cash flow chart</div>
              </div>
            )}
          </Card>

          {/* Financial Focus */}
          <Card>
            <SectionHead title="Financial Focus" icon={<Sparkles className="size-4 text-primary" />} onMore={() => go("coach")} />
            <div className="space-y-2.5">
              {dynamicInsights.map((i) => {
                const s = severityStyle[i.severity];
                return (
                  <div key={i.id} className={`flex gap-3 p-3 rounded-xl ${s.bg}`}>
                    <s.Icon className={`size-4 ${s.text} mt-0.5 shrink-0`} />
                    <div className="flex-1">
                      <div className="text-sm" style={{ fontWeight: 600 }}>{i.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{i.body}</div>
                      <button onClick={() => go(i.target)} className={`text-xs mt-1.5 ${s.text}`} style={{ fontWeight: 600 }}>{i.action} →</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* [P1] One-tap agentic actions — turns the insights above into
              something the user can actually DO right now, instead of
              advice they'd have to go act on elsewhere. Deliberately scoped
              to in-app bucket moves + drafted messages — never a real bank
              transfer, so this stays outside payment-aggregator licensing. */}
          {(() => {
            const topBucket = buckets.find((b) => b.status === "active");
            const cancelLeak = leaks.leaks.find((l) => l.category === "Subscriptions");
            const cancelSub = cancelLeak ? subscriptions.find((s: any) => `sub-${s.id}` === cancelLeak.id) : null;
            if (!topBucket && !cancelSub) return null;
            const suggestedAmount = topBucket
              ? Math.max(500, Math.min(Math.round(netSavings * 0.2 / 100) * 100, Math.max(0, sanitizeDisplayNumber(topBucket.targetAmount) - sanitizeDisplayNumber(topBucket.savedAmount))))
              : 0;
            return (
              <div className="space-y-3">
                {topBucket && suggestedAmount >= 500 && (
                  <ActionCard
                    title="Put this month's surplus to work"
                    subtitle={`You saved ${inr(netSavings)} this month — move some toward ${sanitizeDisplayString(topBucket.name, "your goal")}.`}
                    action={{
                      kind: "move_to_bucket",
                      amount: suggestedAmount,
                      bucketId: topBucket.id,
                      bucketName: sanitizeDisplayString(topBucket.name, "your goal"),
                      onConfirm: async (bucketId, amount) => { await addBucketContribution(bucketId, amount, "Dashboard smart action"); },
                    }}
                  />
                )}
                {cancelSub && (
                  <ActionCard
                    title={`Cancel ${cancelSub.name}?`}
                    subtitle={`Flagged as unused — recover ~${inr(Math.round((cancelLeak?.annual || 0)))}/year.`}
                    action={{
                      kind: "draft_message",
                      negotiationKind: "subscription_cancel",
                      context: { name: cancelSub.name, currentAmount: cancelSub.cost || 0 },
                    }}
                  />
                )}
              </div>
            );
          })()}

          {/* Goals */}
          <Card>
            <SectionHead title="Your goals" onMore={() => go("buckets")} />
            {buckets.length > 0 ? (
              <div className="space-y-3">
                {buckets.slice(0, 2).map((g) => {
                  const saved = sanitizeDisplayNumber(g.savedAmount);
                  const target = sanitizeDisplayNumber(g.targetAmount);
                  const p = target > 0 ? (saved / target) * 100 : 0;
                  const [, colorHex] = (g.iconOrColor || "PiggyBank:#1E40AF").split(":");
                  const color = colorHex || "#1E40AF";
                  const name = sanitizeDisplayString(g.name, "Goal");
                  return (
                    <div key={g.id} onClick={() => go("buckets")} className="cursor-pointer group">
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-sm font-semibold text-slate-800 group-hover:text-primary transition" style={{ fontWeight: 600 }}>{name}</span>
                        <span className="text-xs text-muted-foreground">{inr(saved)} / {inr(target)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(p, 100)}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <button onClick={() => go("buckets")} className="w-full flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground hover:text-primary transition">
                <PlusCircle className="size-4" /> Set your first savings goal
              </button>
            )}
          </Card>

          {/* Emergency */}
          <button onClick={() => go("emergency")} className="w-full text-left">
            <Card>
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Shield className="size-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="text-sm" style={{ fontWeight: 600 }}>Emergency runway</div>
                  <div className="text-xs text-muted-foreground">If income stops today</div>
                </div>
                <div className="text-right">
                  <div className="font-display" style={{ fontSize: 20, fontWeight: 700 }}>{emergencyMonths > 0 ? emergencyMonths : "—"}<span className="text-sm text-muted-foreground"> months</span></div>
                  <div className={`text-xs ${emergencyMonths >= 6 ? "text-emerald-600" : emergencyMonths >= 3 ? "text-amber-600" : "text-rose-600"}`} style={{ fontWeight: 600 }}>{emergencyMonths >= 6 ? "Safe" : emergencyMonths >= 3 ? "Caution" : "At risk"}</div>
                </div>
              </div>
            </Card>
          </button>

          {/* Recent Activity */}
          <Card>
            <SectionHead title="Recent activity" onMore={() => go("transactions")} />
            <div className="space-y-1">
              {monthlyTx.slice(0, 4).map((t) => {
                const title = sanitizeDisplayString(t.merchant || t.title, "Transaction");
                const amt = sanitizeDisplayNumber(t.amount);
                return (
                  <div key={t.id} className="flex items-center gap-3 py-2">
                    <div className={`size-9 rounded-lg flex items-center justify-center ${t.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                      {t.type === "income" ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate" style={{ fontWeight: 500 }}>{title}</div>
                      <div className="text-xs text-muted-foreground">{t.category} · {t.date}</div>
                    </div>
                    <div className={`text-sm ${t.type === "income" ? "text-emerald-600" : ""}`} style={{ fontWeight: 600 }}>
                      {t.type === "income" ? "+" : "-"}{inr(amt)}
                    </div>
                  </div>
                );
              })}
              {monthlyTx.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">No transactions logged for this month.</div>
              )}
            </div>
          </Card>
          {/* Last synced indicator */}
          {lastSynced && (
            <div className="text-center text-[10px] text-muted-foreground pb-2">
              Last synced · {lastSynced.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
        )}
      </Screen>
    </>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} stroke="rgba(255,255,255,0.2)" strokeWidth="5" fill="none" />
        <circle cx="32" cy="32" r={r} stroke="white" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-display" style={{ fontWeight: 700, fontSize: 16 }}>
        {score}
      </div>
    </div>
  );
}

function Metric({ label, value, delta, up }: { label: string; value: string; delta?: string; up?: boolean }) {
  return (
    <div>
      <div className="text-white/60 text-[10px] uppercase tracking-wider">{label}</div>
      <div className="font-display" style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
      {delta && <div className={`text-[10px] ${up ? "text-emerald-200" : "text-rose-200"}`}>{delta}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card rounded-2xl p-4 border border-border/60 shadow-sm shadow-slate-200/40 ${className}`}>{children}</div>;
}

function SectionHead({ title, subtitle, onMore, icon }: { title: string; subtitle?: string; onMore?: () => void; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <div className="text-sm" style={{ fontWeight: 600 }}>{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {onMore && <button onClick={onMore} className="text-xs text-primary" style={{ fontWeight: 600 }}>See all</button>}
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "up" | "down" }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className={tone === "up" ? "text-emerald-600" : "text-rose-600"}>{icon}</span>
        {label}
      </div>
      <div className="font-display mt-1" style={{ fontSize: 17, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const dataItem = payload[0]?.payload;
  const monthTitle = dataItem?.fullMonth || label || "Month";
  return (
    <div className="bg-card border border-border rounded-xl p-2.5 shadow-lg text-xs space-y-1.5 min-w-[130px]">
      <div className="font-semibold text-slate-800 border-b border-border/60 pb-1 flex items-center justify-between gap-2">
        <span>{monthTitle}</span>
        {dataItem?.isCurrent && (
          <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">Selected</span>
        )}
      </div>
      {payload.map((p: any, idx: number) => (
        <div key={`${p.dataKey ?? "v"}-${idx}`} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: p.stroke || p.color }} />
            <span className="text-muted-foreground capitalize">{p.dataKey}</span>
          </div>
          <span style={{ fontWeight: 600 }}>{inr(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
