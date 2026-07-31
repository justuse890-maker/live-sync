import { useEffect, useState, useMemo } from "react";
import { Bell, CheckCircle2, AlertTriangle, Info, Loader2, CheckCheck, Zap, PiggyBank, Receipt, Shield, CreditCard, TrendingDown } from "lucide-react";
import { Header, Screen } from "../Shell";
import { api } from "../../lib/api";
import { useStore } from "../../store";
import { generateSmartNotifications, SmartNotif } from "../../lib/notifEngine";

type ApiNotif = { id: string; title: string; body?: string; kind: string; at: string; read: boolean };
type CombinedNotif = { id: string; title: string; body?: string; kind: string; at: string; read: boolean; isLocal?: boolean; severity?: "info" | "warning" | "urgent" };

const kindIcon: Record<string, typeof Bell> = {
  emi_due: CreditCard,
  budget_alert: TrendingDown,
  bucket_behind: PiggyBank,
  subscription_due: Receipt,
  insurance_due: Shield,
  credit_due: CreditCard,
  monthly_summary: Zap,
  goal_update: CheckCircle2,
};

const severityStyle = {
  urgent: { bg: "bg-rose-50", border: "border-rose-200/80", icon: "text-rose-600", dot: "bg-rose-500" },
  warning: { bg: "bg-amber-50", border: "border-amber-200/80", icon: "text-amber-600", dot: "bg-amber-500" },
  info: { bg: "bg-blue-50/60", border: "border-blue-200/60", icon: "text-blue-600", dot: "bg-blue-400" },
};

function sectionKey(at: string): string {
  const d = new Date(at);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff <= 7) return "This Week";
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function Notifications({ onBack }: { onBack: () => void }) {
  const store = useStore();
  const [apiItems, setApiItems] = useState<ApiNotif[]>([]);
  const [loading, setLoading] = useState(true);
  const [readLocal, setReadLocal] = useState<Set<string>>(new Set());

  const load = async () => {
    try { setApiItems(await api.notifications()); } catch (e) { console.warn("notifications load failed", e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    api.markNotificationsRead().catch(() => {});
  }, []);

  // Generate smart local notifications from store data
  const localNotifs = useMemo(() => {
    return generateSmartNotifications({
      transactions: store.transactions,
      budgets: store.budgets,
      buckets: store.buckets,
      bucketContributions: store.bucketContributions,
      subscriptions: store.subscriptions,
      insurance: store.insurance,
      structuredLoans: store.structuredLoans,
      creditCards: store.creditCards,
    });
  }, [store.transactions, store.budgets, store.buckets, store.bucketContributions,
      store.subscriptions, store.insurance, store.structuredLoans, store.creditCards]);

  // Merge local + API notifications (deduplicate by id)
  const allItems = useMemo((): CombinedNotif[] => {
    const apiMapped: CombinedNotif[] = apiItems.map(n => ({ ...n, isLocal: false }));
    const localMapped: CombinedNotif[] = localNotifs.map(n => ({
      id: n.id,
      title: n.title,
      body: n.body,
      kind: n.kind,
      at: n.at,
      read: readLocal.has(n.id),
      isLocal: true,
      severity: n.severity,
    }));
    const seen = new Set<string>();
    const merged: CombinedNotif[] = [];
    for (const n of [...localMapped, ...apiMapped]) {
      if (!seen.has(n.id)) { seen.add(n.id); merged.push(n); }
    }
    return merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [apiItems, localNotifs, readLocal]);

  const urgentCount = allItems.filter(n => !n.read && (n.severity === "urgent" || n.severity === "warning")).length;

  const grouped = allItems.reduce<Record<string, CombinedNotif[]>>((acc, n) => {
    const key = sectionKey(n.at);
    (acc[key] ||= []).push(n);
    return acc;
  }, {});

  const markAllRead = async () => {
    try { await api.markNotificationsRead(); } catch {}
    setApiItems(xs => xs.map(n => ({ ...n, read: true })));
    setReadLocal(new Set(localNotifs.map(n => n.id)));
  };

  return (
    <>
      <Header
        title="Notifications"
        subtitle={loading ? "Loading…" : `${allItems.length} item${allItems.length === 1 ? "" : "s"}${urgentCount > 0 ? ` · ${urgentCount} need attention` : ""}`}
        showBack
        onBack={onBack}
        right={
          allItems.some(n => !n.read) ? (
            <button
              onClick={markAllRead}
              className="text-[11px] text-primary flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted font-semibold"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          ) : <div className="w-1" />
        }
      />
      <Screen>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : allItems.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="size-14 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
              <Bell className="size-6 text-muted-foreground" />
            </div>
            <div className="text-sm font-bold">You're all caught up</div>
            <div className="text-xs text-muted-foreground mt-1">We'll alert you when EMIs, budgets, or renewals need attention.</div>
          </div>
        ) : (
          <div className="px-5 pt-4 space-y-5 pb-24">
            {Object.entries(grouped).map(([section, list]) => (
              <div key={section}>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 px-1 font-semibold">{section}</div>
                <div className="space-y-2">
                  {list.map(n => {
                    const Icon = kindIcon[n.kind] || Bell;
                    const sev = (n.severity as keyof typeof severityStyle) || "info";
                    const style = severityStyle[sev] || severityStyle.info;
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (n.isLocal) setReadLocal(prev => new Set([...prev, n.id]));
                        }}
                        className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${style.bg} ${style.border} ${n.read ? "opacity-60" : ""}`}
                      >
                        <div className={`size-9 rounded-xl flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                          <Icon className={`size-4 ${style.icon}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 text-sm font-bold text-slate-900 leading-snug">{n.title}</div>
                            {!n.read && <div className={`size-2 rounded-full mt-1.5 flex-shrink-0 ${style.dot}`} />}
                          </div>
                          {n.body && <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.body}</div>}
                          <div className="text-[10px] text-muted-foreground mt-1 font-medium">
                            {new Date(n.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            {n.isLocal && <span className="ml-1.5 text-primary font-semibold">· Smart Alert</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Screen>
    </>
  );
}
