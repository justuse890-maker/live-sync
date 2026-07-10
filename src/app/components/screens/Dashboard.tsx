import { useMemo, useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Sparkles, Shield, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Wallet, Calendar, ChevronLeft, Droplets, Flame, TrendingUp, PlusCircle } from "lucide-react";
import { useStore } from "../../store";
import { inr, ScreenId } from "../types";
import { Header, Screen } from "../Shell";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { netWorth, detectLeaks, lifestyleInflation, fire, monthlyFlow } from "../../lib/intelligence";
import { api } from "../../lib/api";

const severityStyle = {
  success: { bg: "bg-emerald-50", text: "text-emerald-700", Icon: CheckCircle2 },
  warning: { bg: "bg-amber-50", text: "text-amber-700", Icon: AlertTriangle },
  danger: { bg: "bg-rose-50", text: "text-rose-700", Icon: XCircle },
};

// Helper to match months
function getMonthKey(dateStr: string): string {
  if (/^\d{4}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 7);
  const parts = dateStr.split(" ");
  if (parts.length >= 2) {
    const monthName = parts[0].toLowerCase();
    const year = parts[2] || "2026";
    const monthMap: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const mm = monthMap[monthName.slice(0, 3)];
    if (mm) return `${year}-${mm}`;
  }
  return new Date().toISOString().slice(0, 7);
}

function formatMonthName(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const idx = parseInt(month, 10) - 1;
  return `${monthNames[idx] || month} ${year}`;
}

export function Dashboard({ go }: { go: (id: ScreenId) => void }) {
  const { transactions, subscriptions, assets, liabilities, goals, selectedMonth, setSelectedMonth } = useStore();
  const [userName, setUserName] = useState("there");

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

  // Cycle Months
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(prevDate.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(nextDate.toISOString().slice(0, 7));
  };

  // Filter transactions for selected month
  const monthlyTx = useMemo(() => {
    return transactions.filter(t => getMonthKey(t.date) === selectedMonth);
  }, [transactions, selectedMonth]);

  // Dynamic calculations from real data
  const monthlyIncome = useMemo(() => {
    return monthlyTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  }, [monthlyTx]);

  const monthlyExpenses = useMemo(() => {
    return monthlyTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
  }, [monthlyTx]);

  const monthlySavings = Math.max(0, monthlyIncome - monthlyExpenses);
  const pct = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

  const nw = useMemo(() => netWorth(assets, liabilities), [assets, liabilities]);
  const livenw = nw.netWorth;
  const leaks = useMemo(() => detectLeaks(transactions, subscriptions), [transactions, subscriptions]);
  const inflation = useMemo(() => lifestyleInflation(transactions), [transactions]);
  const fireR = useMemo(() => fire(monthlyExpenses || 1, Math.max(0, livenw), 28), [monthlyExpenses, livenw]);

  // Compute health score from real data
  const healthScore = useMemo(() => {
    let score = 50; // base score
    if (monthlySavings > 0 && monthlyIncome > 0) score += Math.min(20, (pct / 30) * 20);
    if (livenw > 0) score += 10;
    if (goals.length > 0) score += 5;
    if (leaks.totalAnnual < monthlyIncome * 0.1) score += 10;
    if (monthlyExpenses > 0 && monthlyIncome > monthlyExpenses) score += 5;
    return Math.min(100, Math.round(score));
  }, [monthlySavings, monthlyIncome, pct, livenw, goals, leaks, monthlyExpenses]);

  const emergencyMonths = useMemo(() => {
    if (monthlyExpenses <= 0) return 0;
    const liquidAssets = assets.reduce((sum, a) => {
      if (a.category === "savings" || a.category === "cash" || a.category === "investment") return sum + a.value;
      return sum;
    }, 0);
    return Math.round((liquidAssets / monthlyExpenses) * 10) / 10;
  }, [assets, monthlyExpenses]);

  // Build cash flow data from last 6 months of real transactions
  const cashFlowData = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    return months.map(m => {
      const mTx = transactions.filter(t => getMonthKey(t.date) === m);
      const income = mTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expenses = mTx.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { month: monthNames[parseInt(m.slice(5, 7), 10) - 1], income, expenses };
    });
  }, [transactions]);

  // Generate dynamic AI insights from real data
  const dynamicInsights = useMemo(() => {
    const insights: { id: string; title: string; body: string; action: string; severity: "success" | "warning" | "danger" }[] = [];
    if (pct > 30) insights.push({ id: "save", title: "Great savings rate!", body: `You're saving ${pct.toFixed(0)}% of your income this month.`, action: "View goals", severity: "success" });
    if (pct < 10 && monthlyIncome > 0) insights.push({ id: "low-save", title: "Low savings this month", body: `Only ${pct.toFixed(0)}% savings rate. Consider cutting discretionary spending.`, action: "View budgets", severity: "warning" });
    if (leaks.totalAnnual > 5000) insights.push({ id: "leak", title: `₹${Math.round(leaks.totalAnnual).toLocaleString("en-IN")} annual leakage`, body: "Detected potential money leaks in subscriptions and recurring charges.", action: "View leaks", severity: "danger" });
    if (goals.length > 0) {
      const topGoal = goals[0];
      const gPct = topGoal.target > 0 ? (topGoal.current / topGoal.target) * 100 : 0;
      insights.push({ id: "goal", title: `${topGoal.name}: ${gPct.toFixed(0)}% done`, body: `₹${topGoal.current.toLocaleString("en-IN")} of ₹${topGoal.target.toLocaleString("en-IN")} saved.`, action: "View goals", severity: gPct > 50 ? "success" : "warning" });
    }
    if (insights.length === 0 && transactions.length === 0) {
      insights.push({ id: "start", title: "Welcome to LiveSync!", body: "Add your first transaction to start getting personalized insights.", action: "Get started", severity: "success" });
    }
    return insights.slice(0, 3);
  }, [pct, monthlyIncome, leaks, goals, transactions]);

  // Empty state check
  const hasData = transactions.length > 0;

  return (
    <>
      <Header title={`Good morning, ${userName}`} subtitle={formatMonthName(selectedMonth)} />
      <Screen>
        <div className="px-5 pt-4 space-y-5">
          
          {/* Month Selector Carousel */}
          <div className="flex justify-between items-center bg-card rounded-2xl p-3.5 border border-border/60 shadow-sm">
            <button onClick={handlePrevMonth} className="size-9 bg-muted hover:bg-muted/80 rounded-xl flex items-center justify-center transition">
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-display text-sm font-bold text-slate-800">{formatMonthName(selectedMonth)}</span>
            <button onClick={handleNextMonth} className="size-9 bg-muted hover:bg-muted/80 rounded-xl flex items-center justify-center transition">
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Health score hero */}
          <button onClick={() => go("health")} className="w-full text-left">
            <div className="rounded-2xl p-5 bg-gradient-to-br from-primary to-indigo-700 text-white shadow-lg shadow-primary/20">
              <div className="flex items-center gap-4">
                <ScoreRing score={healthScore} />
                <div className="flex-1">
                  <div className="text-white/70 text-xs uppercase tracking-wider">Financial Health</div>
                  <div className="font-display" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
                    {healthScore}/100
                  </div>
                  <div className="text-white/80 text-sm mt-1">{healthScore >= 70 ? "Good" : healthScore >= 40 ? "Improving" : "Needs attention"}</div>
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

          {/* Wealth intelligence row */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => go("networth")} className="text-left bg-card rounded-2xl p-4 border border-border/60 hover:border-primary/40 transition">
              <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2"><Wallet className="size-4" /></div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Net worth</div>
              <div className="font-display mt-0.5" style={{ fontSize: 17, fontWeight: 700 }}>{inr(livenw)}</div>
            </button>
            <button onClick={() => go("leakage")} className="text-left bg-card rounded-2xl p-4 border border-border/60 hover:border-rose-400 transition">
              <div className="size-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-2"><Droplets className="size-4" /></div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Annual leakage</div>
              <div className="font-display text-rose-600 mt-0.5" style={{ fontSize: 17, fontWeight: 700 }}>{inr(Math.round(leaks.totalAnnual))}</div>
            </button>
            <button onClick={() => go("fire")} className="text-left bg-card rounded-2xl p-4 border border-border/60 hover:border-violet-400 transition">
              <div className="size-9 rounded-lg flex items-center justify-center mb-2" style={{ background: "#8B5CF615", color: "#8B5CF6" }}><Flame className="size-4" /></div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">FIRE progress</div>
              <div className="font-display mt-0.5" style={{ fontSize: 17, fontWeight: 700 }}>{fireR.progress.toFixed(1)}%</div>
            </button>
            <button onClick={() => go("inflation")} className="text-left bg-card rounded-2xl p-4 border border-border/60 hover:border-amber-400 transition">
              <div className="size-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2"><TrendingUp className="size-4" /></div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Lifestyle inflation</div>
              <div className={`font-display mt-0.5 ${inflation.verdict === "outpacing" ? "text-rose-600" : "text-emerald-600"}`} style={{ fontSize: 17, fontWeight: 700 }}>{inflation.gap > 0 ? "+" : ""}{inflation.gap.toFixed(1)}%</div>
            </button>
          </div>

          <button onClick={() => go("timeline")} className="w-full text-left">
            <Card>
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Calendar className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm" style={{ fontWeight: 600 }}>Financial Timeline</div>
                  <div className="text-xs text-muted-foreground">Salary, bills, SIPs, taxes, goals — one view</div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Card>
          </button>

          {/* Cash flow */}
          <Card>
            <SectionHead title="Cash flow" subtitle="Last 6 months" onMore={() => go("reports")} />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Stat label="Income" value={inr(monthlyIncome)} icon={<ArrowUpRight className="size-3.5" />} tone="up" />
              <Stat label="Expenses" value={inr(monthlyExpenses)} icon={<ArrowDownRight className="size-3.5" />} tone="down" />
            </div>
            {hasData ? (
              <>
                <div className="h-32 -mx-1">
                  <ResponsiveContainer>
                    <AreaChart data={cashFlowData}>
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
                      <XAxis key="dash-x" dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                      <Tooltip key="dash-tip" content={<ChartTip />} />
                      <Area key="a-income" type="monotone" dataKey="income" stroke="#1E40AF" strokeWidth={2} fill="url(#dash-income)" dot={false} activeDot={false} isAnimationActive={false} legendType="none" />
                      <Area key="a-expenses" type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} fill="url(#dash-expenses)" dot={false} activeDot={false} isAnimationActive={false} legendType="none" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {pct > 0 && <div className="text-xs text-muted-foreground mt-2">Saving rate {pct.toFixed(0)}%</div>}
              </>
            ) : (
              <div className="text-center py-6">
                <div className="text-xs text-muted-foreground">Add transactions to see your cash flow chart</div>
              </div>
            )}
          </Card>

          {/* AI insights */}
          <Card>
            <SectionHead title="AI insights" icon={<Sparkles className="size-4 text-primary" />} onMore={() => go("coach")} />
            <div className="space-y-2.5">
              {dynamicInsights.map((i) => {
                const s = severityStyle[i.severity];
                return (
                  <div key={i.id} className={`flex gap-3 p-3 rounded-xl ${s.bg}`}>
                    <s.Icon className={`size-4 ${s.text} mt-0.5 shrink-0`} />
                    <div className="flex-1">
                      <div className="text-sm" style={{ fontWeight: 600 }}>{i.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{i.body}</div>
                      <button className={`text-xs mt-1.5 ${s.text}`} style={{ fontWeight: 600 }}>{i.action} →</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Goals */}
          <Card>
            <SectionHead title="Your goals" onMore={() => go("goals")} />
            {goals.length > 0 ? (
              <div className="space-y-3">
                {goals.slice(0, 2).map((g) => {
                  const p = g.target > 0 ? (g.current / g.target) * 100 : 0;
                  return (
                    <div key={g.id}>
                      <div className="flex justify-between items-baseline mb-1.5">
                        <span className="text-sm font-semibold" style={{ fontWeight: 600 }}>{g.name}</span>
                        <span className="text-xs text-muted-foreground">{inr(g.current)} / {inr(g.target)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p}%`, background: g.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <button onClick={() => go("goals")} className="w-full flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground hover:text-primary transition">
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
              {monthlyTx.slice(0, 4).map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2">
                  <div className={`size-9 rounded-lg flex items-center justify-center ${t.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                    {t.type === "income" ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ fontWeight: 500 }}>{t.merchant || t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.category} · {t.date}</div>
                  </div>
                  <div className={`text-sm ${t.type === "income" ? "text-emerald-600" : ""}`} style={{ fontWeight: 600 }}>
                    {t.type === "income" ? "+" : "-"}{inr(t.amount)}
                  </div>
                </div>
              ))}
              {monthlyTx.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">No transactions logged for this month.</div>
              )}
            </div>
          </Card>
        </div>
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

function ChartTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-2 shadow-md text-xs">
      {payload.map((p: any, idx: number) => (
        <div key={`${p.dataKey ?? "v"}-${idx}`} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.dataKey}</span>
          <span style={{ fontWeight: 600 }}>{inr(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
