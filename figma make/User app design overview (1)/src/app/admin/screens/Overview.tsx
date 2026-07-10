import { useEffect, useState } from "react";
import { Loader2, Users, Activity, IndianRupee, TrendingUp, CreditCard, UserMinus, UserCheck, Wallet } from "lucide-react";
import { adminApi, Metrics } from "../lib/adminApi";

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function Overview() {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    adminApi.metrics().then(setM).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="text-rose-400 text-sm">Failed to load metrics: {err}</div>;
  if (!m) return <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="size-4 animate-spin" /> Loading metrics…</div>;

  const planEntries = Object.entries(m.planDistribution).sort((a, b) => b[1] - a[1]);
  const featureEntries = Object.entries(m.featureUsage).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxFeature = featureEntries[0]?.[1] || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-slate-400">Real-time KPIs across the LiveSync user base.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={<Users className="size-4" />} label="Total users" value={m.totalUsers.toLocaleString()} tint="#6366F1" />
        <Kpi icon={<Activity className="size-4" />} label="Active · 7d" value={m.activeUsersLast7d.toLocaleString()} tint="#10B981" />
        <Kpi icon={<CreditCard className="size-4" />} label="Paid users" value={m.paidUsers.toLocaleString()} sub={`${m.freeUsers.toLocaleString()} on free`} tint="#06B6D4" />
        <Kpi icon={<Wallet className="size-4" />} label="ARPU" value={inr(Math.round(m.arpu))} sub="per paid user / mo" tint="#A855F7" />
        <Kpi icon={<IndianRupee className="size-4" />} label="MRR" value={inr(m.mrr)} tint="#F59E0B" />
        <Kpi icon={<TrendingUp className="size-4" />} label="ARR" value={inr(m.arr)} tint="#EF4444" />
        <Kpi icon={<UserCheck className="size-4" />} label="Retention · 30d" value={`${m.retentionPct.toFixed(1)}%`} tint="#10B981" />
        <Kpi icon={<UserMinus className="size-4" />} label="Churn · 30d" value={`${m.churnPct.toFixed(1)}%`} sub={`${m.churnedLast30d} cancelled`} tint="#F43F5E" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Plan distribution">
          {planEntries.length === 0 ? (
            <div className="text-sm text-slate-500">No paid plans assigned yet.</div>
          ) : (
            <div className="space-y-2">
              {planEntries.map(([planId, count]) => (
                <div key={planId} className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">{planId}</span>
                  <span className="text-slate-100 font-semibold">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Top features (events)">
          {featureEntries.length === 0 ? (
            <div className="text-sm text-slate-500">No usage events tracked yet.</div>
          ) : (
            <div className="space-y-2.5">
              {featureEntries.map(([feature, count]) => (
                <div key={feature}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300">{feature}</span>
                    <span className="text-slate-400">{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${(count / maxFeature) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub, tint }: { icon: React.ReactNode; label: string; value: string; sub?: string; tint: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="size-7 rounded-lg flex items-center justify-center" style={{ background: tint + "22", color: tint }}>{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-50">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="text-sm font-semibold text-slate-200 mb-3">{title}</div>
      {children}
    </div>
  );
}
