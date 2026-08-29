import { useMemo, useState } from "react";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  ShieldCheck,
  Zap,
  ChevronRight,
  Sparkles,
  Wallet,
  PiggyBank,
  ShieldAlert,
  ArrowUpRight,
  Flame,
  Activity,
  Award,
  Layers,
  Calendar,
  ChevronLeft,
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { netWorth, detectLeaks } from "../../lib/intelligence";
import { inr, ScreenId } from "../types";
import { useNavigate } from "react-router";
import { getMonthKey, formatMonthName, shiftMonth } from "../../lib/dateUtils";

export function Health({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const {
    transactions,
    assets,
    liabilities,
    goals,
    subscriptions,
    sips,
    insurance,
    investments,
    gold,
    properties,
    structuredLoans,
    loans,
    creditCards,
    budgets,
    buckets,
    creditScore,
    selectedMonth,
    setSelectedMonth,
  } = useStore();

  const [activeTab, setActiveTab] = useState<"pillars" | "actions" | "simulation">("pillars");

  // Cycle Months
  const handlePrevMonth = () => {
    setSelectedMonth(shiftMonth(selectedMonth, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(shiftMonth(selectedMonth, 1));
  };

  // ─── Comprehensive Live Metrics Engine ─────────────────────────────────────
  const metrics = useMemo(() => {
    // 1. Transactions cashflow for selected month (with fallback to 3-month average if zero)
    const monthlyTx = transactions.filter((t) => getMonthKey(t.date) === selectedMonth);
    let monthlyIncome = monthlyTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    let monthlyExpenses = monthlyTx.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);

    // If current selected month has no transactions, compute 3-month average for realistic score
    if (monthlyIncome === 0 && monthlyExpenses === 0 && transactions.length > 0) {
      const allIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const allExpenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
      
      // Find unique months in transactions
      const uniqueMonths = new Set(transactions.map((t) => getMonthKey(t.date)));
      const monthCount = Math.max(1, uniqueMonths.size);
      monthlyIncome = Math.round(allIncome / monthCount);
      monthlyExpenses = Math.round(allExpenses / monthCount);
    }

    const monthlySavings = Math.max(0, monthlyIncome - monthlyExpenses);
    const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

    // 2. Net Worth & Total Assets
    const nwData = netWorth(assets, liabilities);
    const rawNetWorth = nwData.netWorth;

    // Include other store assets if not already mapped in assets
    const addlInvestments = investments.reduce((s, i) => s + (i.currentValue || i.investedAmount || 0), 0);
    const addlGold = gold.reduce((s, g) => s + (g.purchasePrice || 0), 0);
    const addlProp = properties.reduce((s, p) => s + (p.currentValuation || p.purchasePrice || 0), 0);
    
    // Total Net Worth
    const totalAssets = Math.max(nwData.totalAssets, nwData.totalAssets + addlInvestments + addlGold + addlProp);

    // 3. Liquid Assets & Emergency Cushion
    const liquidFromAssets = assets
      .filter((a) => a.kind === "cash" || a.kind === "savings" || a.kind === "fd")
      .reduce((s, a) => s + a.value, 0);
    const liquidFromInvestments = investments
      .filter((i) => i.type === "fixed_deposit")
      .reduce((s, i) => s + (i.currentValue || 0), 0);
    
    const totalLiquidAssets = liquidFromAssets + liquidFromInvestments;
    const monthlyBurn = monthlyExpenses > 0 ? monthlyExpenses : 15000; // default benchmark if 0
    const emergencyMonths = totalLiquidAssets / monthlyBurn;

    // 4. Debt & Credit Health
    const totalStructuredDebt = structuredLoans.reduce((s, l) => s + (l.outstandingPrincipal || 0), 0);
    const totalPersonalDebt = loans.filter((l) => l.direction === "borrowed" && !l.settled).reduce((s, l) => s + l.amount, 0);
    const totalLiabDebt = liabilities.reduce((s, l) => s + (l.outstanding || 0), 0);
    const totalDebt = Math.max(nwData.totalLiab, totalLiabDebt + totalStructuredDebt + totalPersonalDebt);

    const totalEmis = structuredLoans.reduce((s, l) => s + (l.emiAmount || 0), 0) +
      liabilities.reduce((s, l) => s + (l.emi || 0), 0);
    
    const dtiRatio = monthlyIncome > 0 ? (totalEmis / monthlyIncome) * 100 : (totalDebt > 0 ? 45 : 0);
    const latestCreditScore = creditScore.length > 0 ? creditScore[0].score : null;

    // 5. Investments & SIP Velocity
    const monthlySipTotal = sips.reduce((s, sip) => s + sip.amount, 0);
    const sipRatio = monthlyIncome > 0 ? (monthlySipTotal / monthlyIncome) * 100 : 0;

    // 6. Insurance Protection
    const totalInsuranceCoverage = insurance.reduce((s, i) => s + (i.coverageAmount || 0), 0);
    const recommendedInsurance = Math.max(1000000, (monthlyExpenses * 12) * 5); // 5x annual expenses
    const insuranceCoverageRatio = Math.min(100, (totalInsuranceCoverage / Math.max(1, recommendedInsurance)) * 100);

    // 7. Leakage & Budget Discipline
    const leakAnalysis = detectLeaks(transactions, subscriptions, assets, liabilities);
    const totalLeaks = leakAnalysis.totalAnnual;
    const brokenBudgets = budgets.filter((b) => b.spent > b.limit).length;

    // ─── Score Computation for 6 Core Pillars ─────────────────────────────────

    // Pillar 1: Savings Rate & Cashflow (Max 100)
    let savingsScore = 50;
    if (monthlyIncome > 0) {
      if (savingsRate >= 30) savingsScore = 100;
      else if (savingsRate >= 20) savingsScore = 85 + ((savingsRate - 20) / 10) * 15;
      else if (savingsRate >= 10) savingsScore = 65 + ((savingsRate - 10) / 10) * 20;
      else if (savingsRate > 0) savingsScore = 40 + (savingsRate / 10) * 25;
      else savingsScore = 20; // deficit
    }

    // Pillar 2: Emergency Cushion (Max 100)
    let emergencyScore = 30;
    if (emergencyMonths >= 6) emergencyScore = 100;
    else if (emergencyMonths >= 3) emergencyScore = 75 + ((emergencyMonths - 3) / 3) * 25;
    else if (emergencyMonths >= 1) emergencyScore = 45 + ((emergencyMonths - 1) / 2) * 30;
    else if (totalLiquidAssets > 0) emergencyScore = 35;

    // Pillar 3: Debt & Credit Health (Max 100)
    let debtScore = 100;
    if (totalDebt > 0) {
      if (dtiRatio <= 20) debtScore = 90;
      else if (dtiRatio <= 35) debtScore = 75;
      else if (dtiRatio <= 50) debtScore = 55;
      else debtScore = 30;
    }
    if (latestCreditScore) {
      if (latestCreditScore >= 750) debtScore = Math.min(100, debtScore + 10);
      else if (latestCreditScore < 650) debtScore = Math.max(10, debtScore - 15);
    }

    // Pillar 4: Wealth & Investment Velocity (Max 100)
    let investmentScore = 40;
    if (rawNetWorth > 0) investmentScore += 20;
    if (monthlySipTotal > 0) investmentScore += Math.min(30, (sipRatio / 15) * 30);
    if (investments.length > 0 || gold.length > 0 || properties.length > 0) investmentScore += 10;
    investmentScore = Math.min(100, Math.round(investmentScore));

    // Pillar 5: Protection & Risk Mitigation (Max 100)
    let protectionScore = 30;
    if (insurance.length > 0) {
      protectionScore = Math.min(100, Math.round(40 + (insuranceCoverageRatio * 0.6)));
    }

    // Pillar 6: Budgeting & Leak Discipline (Max 100)
    let disciplineScore = 85;
    if (totalLeaks > 10000) disciplineScore -= 30;
    else if (totalLeaks > 3000) disciplineScore -= 15;

    if (brokenBudgets > 0) disciplineScore -= Math.min(30, brokenBudgets * 15);
    disciplineScore = Math.max(10, Math.min(100, disciplineScore));

    // ─── Overall Weighted Health Score (0 - 100) ──────────────────────────────
    const overallScore = Math.round(
      savingsScore * 0.25 +
      emergencyScore * 0.20 +
      debtScore * 0.20 +
      investmentScore * 0.15 +
      protectionScore * 0.10 +
      disciplineScore * 0.10
    );

    // Status Level
    let level = { title: "Financial Elite", tone: "emerald", desc: "Exceptional financial stability and growth trajectory." };
    if (overallScore < 50) {
      level = { title: "Critical — Action Needed", tone: "rose", desc: "Multiple financial vulnerabilities detected. Review action items below." };
    } else if (overallScore < 70) {
      level = { title: "Fair Standing", tone: "amber", desc: "Stable baseline with significant room for optimization." };
    } else if (overallScore < 85) {
      level = { title: "Strong & Healthy", tone: "indigo", desc: "Solid cash flow and investment velocity." };
    }

    return {
      overall: overallScore,
      level,
      monthlyIncome,
      monthlyExpenses,
      monthlySavings,
      savingsRate,
      rawNetWorth,
      totalLiquidAssets,
      emergencyMonths,
      totalDebt,
      totalEmis,
      dtiRatio,
      monthlySipTotal,
      totalInsuranceCoverage,
      totalLeaks,
      brokenBudgets,
      pillars: [
        {
          name: "Savings Rate",
          score: Math.round(savingsScore),
          metric: `${savingsRate.toFixed(1)}% of income`,
          target: "30% ideal",
          color: "#10B981", // Emerald
          desc: `Saving ${inr(monthlySavings)} / mo`,
          path: "/transactions",
        },
        {
          name: "Emergency Runway",
          score: Math.round(emergencyScore),
          metric: `${emergencyMonths.toFixed(1)} Months`,
          target: "6.0 Months ideal",
          color: "#3B82F6", // Blue
          desc: `${inr(totalLiquidAssets)} liquid cash`,
          path: "/emergency",
        },
        {
          name: "Debt & Credit Health",
          score: Math.round(debtScore),
          metric: totalDebt === 0 ? "Zero Debt" : `DTI: ${dtiRatio.toFixed(0)}%`,
          target: "< 35% DTI",
          color: "#8B5CF6", // Purple
          desc: totalDebt === 0 ? "Debt free!" : `${inr(totalDebt)} total debt`,
          path: "/loans",
        },
        {
          name: "Investment Velocity",
          score: Math.round(investmentScore),
          metric: monthlySipTotal > 0 ? `${inr(monthlySipTotal)}/mo` : "No Active SIP",
          target: "15% of income",
          color: "#F59E0B", // Amber
          desc: `Net Worth: ${inr(rawNetWorth)}`,
          path: "/sip",
        },
        {
          name: "Insurance Protection",
          score: Math.round(protectionScore),
          metric: insurance.length > 0 ? `${inr(totalInsuranceCoverage)}` : "No Insurance",
          target: `${inr(recommendedInsurance)} target`,
          color: "#EC4899", // Pink
          desc: `${insurance.length} policies active`,
          path: "/insurance",
        },
        {
          name: "Leakage & Discipline",
          score: Math.round(disciplineScore),
          metric: totalLeaks > 0 ? `${inr(totalLeaks)}/yr leak` : "0 Leaks",
          target: "₹0 Leaks",
          color: "#06B6D4", // Cyan
          desc: brokenBudgets > 0 ? `${brokenBudgets} budgets exceeded` : "Budgets intact",
          path: "/leakage",
        },
      ],
    };
  }, [
    transactions,
    selectedMonth,
    assets,
    liabilities,
    structuredLoans,
    loans,
    creditCards,
    sips,
    insurance,
    investments,
    gold,
    properties,
    budgets,
    subscriptions,
    creditScore,
  ]);

  // ─── Dynamic Actionable Recommendations ──────────────────────────────────
  const recommendations = useMemo(() => {
    const list: {
      id: string;
      title: string;
      body: string;
      tone: "danger" | "warning" | "success" | "indigo";
      actionLabel: string;
      path: string;
      impact: string;
    }[] = [];

    // Emergency Fund check
    if (metrics.emergencyMonths < 3) {
      list.push({
        id: "emergency",
        title: "Build 3-6 Month Emergency Buffer",
        body: `You currently have ${metrics.emergencyMonths.toFixed(1)} months of runway (${inr(metrics.totalLiquidAssets)}). Boost liquid savings to prevent debt in emergencies.`,
        tone: metrics.emergencyMonths < 1 ? "danger" : "warning",
        actionLabel: "Set Emergency Goal",
        path: "/emergency",
        impact: "+15 Score Pts",
      });
    } else {
      list.push({
        id: "emergency-good",
        title: "Emergency Runway Secured",
        body: `Great job maintaining ${metrics.emergencyMonths.toFixed(1)} months of expenses in liquid assets!`,
        tone: "success",
        actionLabel: "View Reserve",
        path: "/emergency",
        impact: "Secured",
      });
    }

    // Leaks check
    if (metrics.totalLeaks > 2000) {
      list.push({
        id: "leaks",
        title: `Plug ₹${Math.round(metrics.totalLeaks).toLocaleString("en-IN")}/yr Wealth Leaks`,
        body: "Unused subscriptions or high food delivery fees detected bleeding money.",
        tone: "warning",
        actionLabel: "Fix Leaks",
        path: "/leakage",
        impact: "+10 Score Pts",
      });
    }

    // Insurance check
    if (insurance.length === 0) {
      list.push({
        id: "insurance",
        title: "Add Health & Term Insurance",
        body: "Zero insurance policies detected. Protect your family from unexpected medical bills.",
        tone: "danger",
        actionLabel: "Add Policy",
        path: "/insurance",
        impact: "+20 Score Pts",
      });
    }

    // SIP / Investment check
    if (metrics.monthlySipTotal === 0) {
      list.push({
        id: "sip",
        title: "Start Automated Monthly SIP",
        body: "Automating investments via SIPs accelerates your FIRE target and compounds long-term wealth.",
        tone: "indigo",
        actionLabel: "Start SIP",
        path: "/sip",
        impact: "+15 Score Pts",
      });
    }

    // High DTI check
    if (metrics.dtiRatio > 40) {
      list.push({
        id: "debt",
        title: "High Debt-to-Income Ratio",
        body: `EMIs take up ${metrics.dtiRatio.toFixed(0)}% of your monthly income. Prepay high-interest loans first.`,
        tone: "danger",
        actionLabel: "Prepay Loan",
        path: "/loans",
        impact: "+15 Score Pts",
      });
    }

    // Savings rate check
    if (metrics.savingsRate < 15 && metrics.monthlyIncome > 0) {
      list.push({
        id: "savings",
        title: "Increase Monthly Savings Rate",
        body: `You are saving ${metrics.savingsRate.toFixed(1)}% of your income. Aim to save at least 20-30%.`,
        tone: "warning",
        actionLabel: "Create Budget",
        path: "/budgets",
        impact: "+12 Score Pts",
      });
    }

    return list;
  }, [metrics, insurance]);

  return (
    <>
      <Header title="Financial Health" subtitle="Real-time wealth diagnostic" showBack onBack={onBack} />
      <Screen>
        <div className="px-4 pt-3 pb-12 space-y-4">
          {/* Month selector banner */}
          <div className="flex items-center justify-between bg-card rounded-2xl p-2.5 border border-border/60 shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground active:scale-95 transition-transform"
            >
              <ChevronLeft className="size-5" />
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              <span className="text-sm font-bold tracking-tight">
                {formatMonthName(selectedMonth)}
              </span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground active:scale-95 transition-transform"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>

          {/* ─── Main Health Score Card ─── */}
          <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 shadow-xl border border-indigo-500/20 overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Activity className="size-48 text-indigo-400" />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-white/10 text-indigo-200 border border-white/10 mb-3 backdrop-blur-md">
                <Sparkles className="size-3.5 text-amber-400" /> Live Dynamic Score
              </div>

              {/* Big Score Radial Display */}
              <div className="relative flex items-center justify-center my-2">
                <svg className="size-36 transform -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    stroke="currentColor"
                    strokeWidth="10"
                    className="text-white/10"
                    fill="transparent"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="60"
                    stroke={
                      metrics.overall >= 85
                        ? "#10B981"
                        : metrics.overall >= 70
                        ? "#6366F1"
                        : metrics.overall >= 50
                        ? "#F59E0B"
                        : "#F43F5E"
                    }
                    strokeWidth="10"
                    strokeDasharray={377}
                    strokeDashoffset={377 - (377 * metrics.overall) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-display text-4xl font-extrabold tracking-tight">
                    {metrics.overall}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-white/50">out of 100</span>
                </div>
              </div>

              {/* Status Title */}
              <div className="mt-1">
                <div className="text-lg font-bold flex items-center justify-center gap-1.5">
                  {metrics.level.title}
                </div>
                <p className="text-xs text-white/70 max-w-xs mt-1 leading-relaxed">
                  {metrics.level.desc}
                </p>
              </div>

              {/* Quick Stat Strip */}
              <div className="grid grid-cols-3 gap-2 w-full mt-5 pt-4 border-t border-white/10 text-left">
                <div className="bg-white/5 rounded-2xl p-2.5 backdrop-blur-sm">
                  <div className="text-[10px] text-white/50 uppercase font-semibold">Monthly Income</div>
                  <div className="text-xs font-bold mt-0.5 text-emerald-400">{inr(metrics.monthlyIncome)}</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-2.5 backdrop-blur-sm">
                  <div className="text-[10px] text-white/50 uppercase font-semibold">Liquid Cushion</div>
                  <div className="text-xs font-bold mt-0.5 text-sky-300">{metrics.emergencyMonths.toFixed(1)} mos</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-2.5 backdrop-blur-sm">
                  <div className="text-[10px] text-white/50 uppercase font-semibold">Net Worth</div>
                  <div className="text-xs font-bold mt-0.5 text-indigo-300">{inr(metrics.rawNetWorth)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Navigation Sub-Tabs ─── */}
          <div className="flex bg-muted/60 p-1 rounded-2xl border border-border/40">
            <button
              onClick={() => setActiveTab("pillars")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === "pillars"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              6 Core Pillars
            </button>
            <button
              onClick={() => setActiveTab("actions")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all relative ${
                activeTab === "actions"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Action Items ({recommendations.length})
            </button>
            <button
              onClick={() => setActiveTab("simulation")}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === "simulation"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Score Boosters
            </button>
          </div>

          {/* ─── TAB 1: 6 CORE PILLARS ─── */}
          {activeTab === "pillars" && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider px-1">
                Pillar Breakdown & Real Inputs
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {metrics.pillars.map((pillar) => (
                  <div
                    key={pillar.name}
                    onClick={() => navigate(pillar.path)}
                    className="bg-card rounded-2xl p-4 border border-border/60 hover:border-primary/40 transition-all cursor-pointer active:scale-[0.99] group shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-sm font-bold flex items-center gap-1.5">
                          {pillar.name}
                          <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{pillar.desc}</div>
                      </div>

                      <div className="text-right">
                        <div className="font-display text-lg font-extrabold" style={{ color: pillar.color }}>
                          {pillar.score}
                          <span className="text-xs text-muted-foreground font-normal">/100</span>
                        </div>
                        <div className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md mt-0.5 inline-block">
                          {pillar.metric}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-muted rounded-full overflow-hidden mt-3">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pillar.score}%`, backgroundColor: pillar.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── TAB 2: ACTION RECOMMENDATIONS ─── */}
          {activeTab === "actions" && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider px-1">
                High-Impact Recommended Fixes
              </div>

              {recommendations.map((rec) => {
                const styles = {
                  danger: "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400",
                  warning: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
                  success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
                  indigo: "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-400",
                }[rec.tone];

                return (
                  <div key={rec.id} className={`rounded-2xl p-4 border ${styles} space-y-3`}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <div className="text-sm font-extrabold flex items-center gap-1.5">
                          {rec.title}
                        </div>
                        <p className="text-xs leading-relaxed opacity-90">{rec.body}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-card/80 border border-border/50 shrink-0">
                        {rec.impact}
                      </span>
                    </div>

                    <button
                      onClick={() => navigate(rec.path)}
                      className="w-full py-2.5 px-3 bg-card border border-border/80 hover:bg-muted rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                    >
                      {rec.actionLabel} <ArrowUpRight className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── TAB 3: SIMULATE IMPROVEMENTS ─── */}
          {activeTab === "simulation" && (
            <div className="space-y-3">
              <div className="bg-card rounded-2xl p-4 border border-border/60 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-amber-500" />
                  <span className="text-sm font-bold">How to reach 90+ Score</span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Here is what happens to your score when you optimize your live financial inputs:
                </p>

                <div className="space-y-2.5 pt-1">
                  <SimulationItem
                    title="Build 6 months emergency fund"
                    boost="+15 pts"
                    current={`${metrics.emergencyMonths.toFixed(1)} mos`}
                    target="6.0 mos"
                    onClick={() => navigate("/emergency")}
                  />
                  <SimulationItem
                    title="Plug all detected wealth leaks"
                    boost="+10 pts"
                    current={inr(metrics.totalLeaks)}
                    target="₹0 / yr"
                    onClick={() => navigate("/leakage")}
                  />
                  <SimulationItem
                    title="Start ₹2,500/mo Automated SIP"
                    boost="+12 pts"
                    current={inr(metrics.monthlySipTotal)}
                    target="₹2,500+"
                    onClick={() => navigate("/sip")}
                  />
                  <SimulationItem
                    title="Add Health/Life Insurance"
                    boost="+15 pts"
                    current={`${insurance.length} policies`}
                    target="Covered"
                    onClick={() => navigate("/insurance")}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Screen>
    </>
  );
}

function SimulationItem({
  title,
  boost,
  current,
  target,
  onClick,
}: {
  title: string;
  boost: string;
  current: string;
  target: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted border border-border/40 cursor-pointer active:scale-[0.99] transition-transform text-xs"
    >
      <div>
        <div className="font-bold text-foreground">{title}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          Current: {current} • Target: {target}
        </div>
      </div>
      <div className="flex items-center gap-1 font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded-lg">
        {boost}
      </div>
    </div>
  );
}
