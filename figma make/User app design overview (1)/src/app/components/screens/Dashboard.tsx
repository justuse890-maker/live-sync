import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, Sparkles, Shield, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Zap, CreditCard, Wifi, Droplets, Flame, TrendingUp, Wallet, Calendar } from "lucide-react";
import { financial, cashFlow, aiInsights, upcomingBills, goals } from "../../data";
import { useStore } from "../../store";
import { inr, ScreenId } from "../types";
import { Header, Screen } from "../Shell";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { netWorth, detectLeaks, lifestyleInflation, fire, monthlyFlow } from "../../lib/intelligence";

const billIcons = { Zap, CreditCard, Wifi } as Record<string, any>;
const severityStyle = {
  success: { bg: "bg-emerald-50", text: "text-emerald-700", Icon: CheckCircle2 },
  warning: { bg: "bg-amber-50", text: "text-amber-700", Icon: AlertTriangle },
  danger: { bg: "bg-rose-50", text: "text-rose-700", Icon: XCircle },
};

export function Dashboard({ go }: { go: (id: ScreenId) => void }) {
  const { transactions, subscriptions, assets, liabilities } = useStore();
  const pct = (financial.monthlySavings / financial.monthlyIncome) * 100;

  const nw = useMemo(() => netWorth(assets, liabilities), [assets, liabilities]);
  const livenw = nw.netWorth || financial.netWorth;
  const leaks = useMemo(() => detectLeaks(transactions, subscriptions), [transactions, subscriptions]);
  const inflation = useMemo(() => lifestyleInflation(transactions), [transactions]);
  const flow = useMemo(() => monthlyFlow(transactions, 0), [transactions]);
  const fireR = useMemo(() => fire(flow.expense || financial.monthlyExpenses, Math.max(0, livenw), 28), [flow.expense, livenw]);
  return (
    <>
      <Header title="Good morning, Aarav" subtitle="Saturday, Jun 6" />
      <Screen>
        <div className="px-5 pt-4 space-y-5">
          {/* Health score hero */}
          <button onClick={() => go("health")} className="w-full text-left">
            <div className="rounded-2xl p-5 bg-gradient-to-br from-primary to-indigo-700 text-white shadow-lg shadow-primary/20">
              <div className="flex items-center gap-4">
                <ScoreRing score={financial.healthScore} />
                <div className="flex-1">
                  <div className="text-white/70 text-xs uppercase tracking-wider">Financial Health</div>
                  <div className="font-display" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
                    {financial.healthScore}/100
                  </div>
                  <div className="text-white/80 text-sm mt-1">Good · trending up</div>
                </div>
                <ChevronRight className="size-5 text-white/70" />
              </div>
              <div className="mt-4 pt-4 border-t border-white/15 grid grid-cols-3 gap-3">
                <Metric label="Net worth" value={inr(livenw)} />
                <Metric label="FIRE %" value={`${fireR.progress.toFixed(0)}%`} />
                <Metric label="Runway" value={`${financial.emergencyMonths}m`} />
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
              <Stat label="Income" value={inr(financial.monthlyIncome)} icon={<ArrowUpRight className="size-3.5" />} tone="up" />
              <Stat label="Expenses" value={inr(financial.monthlyExpenses)} icon={<ArrowDownRight className="size-3.5" />} tone="down" />
            </div>
            <div className="h-32 -mx-1">
              <ResponsiveContainer>
                <AreaChart data={cashFlow}>
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
            <div className="text-xs text-muted-foreground mt-2">Saving rate {pct.toFixed(0)}% — top 20% of users</div>
          </Card>

          {/* AI insights */}
          <Card>
            <SectionHead title="AI insights" icon={<Sparkles className="size-4 text-primary" />} onMore={() => go("coach")} />
            <div className="space-y-2.5">
              {aiInsights.slice(0, 3).map((i) => {
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
            <div className="space-y-3">
              {goals.slice(0, 2).map((g) => {
                const p = (g.current / g.target) * 100;
                return (
                  <div key={g.id}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-sm" style={{ fontWeight: 600 }}>{g.name}</span>
                      <span className="text-xs text-muted-foreground">{inr(g.current)} / {inr(g.target)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${p}%`, background: g.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
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
                  <div className="font-display" style={{ fontSize: 20, fontWeight: 700 }}>{financial.emergencyMonths}<span className="text-sm text-muted-foreground"> months</span></div>
                  <div className="text-xs text-emerald-600" style={{ fontWeight: 600 }}>Safe</div>
                </div>
              </div>
            </Card>
          </button>

          {/* Upcoming bills */}
          <Card>
            <SectionHead title="Upcoming bills" />
            <div className="space-y-2">
              {upcomingBills.map((b) => {
                const Icon = billIcons[b.icon];
                return (
                  <div key={b.id} className="flex items-center gap-3 py-1">
                    <div className="size-9 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm" style={{ fontWeight: 500 }}>{b.name}</div>
                      <div className="text-xs text-muted-foreground">Due {b.due}</div>
                    </div>
                    <div className="text-sm" style={{ fontWeight: 600 }}>{inr(b.amount)}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Recent */}
          <Card>
            <SectionHead title="Recent activity" onMore={() => go("transactions")} />
            <div className="space-y-1">
              {transactions.slice(0, 4).map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2">
                  <div className={`size-9 rounded-lg flex items-center justify-center ${t.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                    {t.type === "income" ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ fontWeight: 500 }}>{t.title}</div>
                    <div className="text-xs text-muted-foreground">{t.category} · {t.date}</div>
                  </div>
                  <div className={`text-sm ${t.type === "income" ? "text-emerald-600" : ""}`} style={{ fontWeight: 600 }}>
                    {t.type === "income" ? "+" : "-"}{inr(t.amount)}
                  </div>
                </div>
              ))}
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
