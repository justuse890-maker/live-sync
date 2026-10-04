import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Bell, BellOff, BellRing, CheckCheck, CreditCard, PiggyBank, Receipt, Shield, TrendingDown, Zap,
  StickyNote, Home, Building2, HandCoins, Music, Volume2, Vibrate, Send,
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { useAlerts, AlertItem } from "../../lib/useAlerts";
import { getNotificationPermission, requestNotificationPermission, PermissionState, logToInbox } from "../../lib/notifications";
import { prefs, playTone, feedback, tap } from "../../lib/feedback";
import { isNative } from "../../lib/native";

const kindIcon: Record<string, typeof Bell> = {
  emi: CreditCard, card: CreditCard, credit_due: CreditCard, emi_due: CreditCard,
  bill: Receipt, subscription: Receipt, subscription_due: Receipt,
  insurance: Shield, insurance_due: Shield,
  note: StickyNote, reminder: BellRing,
  household: Home, society: Building2, loan: HandCoins,
  budget_alert: TrendingDown, bucket_behind: PiggyBank, monthly_summary: Zap,
};

const sevStyle = {
  urgent: { bg: "bg-rose-50", border: "border-rose-200/80", icon: "text-rose-600", dot: "bg-rose-500" },
  warning: { bg: "bg-amber-50", border: "border-amber-200/80", icon: "text-amber-600", dot: "bg-amber-500" },
  info: { bg: "bg-white", border: "border-slate-200/80", icon: "text-indigo-600", dot: "bg-indigo-500" },
};

export function Notifications({ onBack }: { onBack: () => void }) {
  const store = useStore();
  const navigate = useNavigate();
  const { items, unread, markRead } = useAlerts();
  const [perm, setPerm] = useState<PermissionState>("prompt");
  const [sounds, setSounds] = useState(prefs.sounds);
  const [haptics, setHaptics] = useState(prefs.haptics);

  useEffect(() => { getNotificationPermission().then(setPerm); }, []);

  const enable = async () => {
    tap();
    const p = await requestNotificationPermission();
    setPerm(p);
    if (p === "granted") feedback({ kind: "success", title: "Notifications on", subtitle: "You'll be reminded before every bill" });
  };

  const sendTest = async () => {
    tap();
    if (isNative() && perm === "granted") {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.schedule({
        notifications: [{ id: 42, title: "LiveSync test alert", body: "Notifications are working 🎉", schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true } }],
      });
      feedback({ kind: "success", title: "Test scheduled", subtitle: "Arrives in 3 seconds" });
    } else {
      playTone("reminder");
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("LiveSync test alert", { body: "Notifications are working 🎉" });
      }
      void logToInbox("LiveSync test alert", "Notifications are working 🎉", "reminder");
      feedback({ kind: "success", title: "Test alert sent" });
    }
  };

  const open = (n: AlertItem) => {
    tap();
    markRead([n.id]);
    if (n.screen) navigate(n.noteId ? `/${n.screen}?note=${n.noteId}` : `/${n.screen}`);
  };

  const groups: Array<[string, AlertItem[]]> = [
    ["Needs attention", items.filter((i) => !i.read && i.severity !== "info")],
    ["Coming up", items.filter((i) => !i.read && i.severity === "info")],
    ["Earlier", items.filter((i) => i.read)],
  ].filter(([, l]) => (l as AlertItem[]).length > 0) as Array<[string, AlertItem[]]>;

  return (
    <>
      <Header
        title="Notifications"
        subtitle={items.length === 0 ? "All caught up" : `${unread} unread`}
        showBack
        onBack={onBack}
        right={unread > 0 ? (
          <button onClick={() => { tap(); markRead(items.map((i) => i.id)); }} className="text-[11px] text-primary flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted font-semibold">
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        ) : <div className="w-1" />}
      />
      <Screen>
        <div className="px-5 pt-4 pb-28 space-y-4">
          {/* Permission status */}
          {perm !== "granted" ? (
            <div className="rounded-2xl p-4 bg-indigo-50 border border-indigo-200/70 ls-rise">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0"><BellOff className="size-5" /></div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-900">Turn on reminders</div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {perm === "denied"
                      ? (isNative() ? "Notifications are blocked. Open your phone Settings → Apps → LiveSync → Notifications and allow them." : "Notifications are blocked in this browser. Allow them from the site settings (lock icon in the address bar).")
                      : "Get alerted a day before every EMI, rent, electricity bill or note reminder — even when the app is closed."}
                  </p>
                  {perm !== "denied" && perm !== "unsupported" && (
                    <button onClick={enable} className="mt-3 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-full active:scale-95 transition">Allow notifications</button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-3 bg-emerald-50 border border-emerald-200/70 flex items-center gap-3">
              <BellRing className="size-4 text-emerald-700" />
              <div className="flex-1 text-xs font-semibold text-emerald-800">Reminders are on. Scheduled on this device — nothing is sent to a server.</div>
              <button onClick={sendTest} className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 bg-white border border-emerald-200 rounded-full px-2.5 py-1 active:scale-95">
                <Send className="size-3" /> Test
              </button>
            </div>
          )}

          {/* Feed */}
          {items.length === 0 ? (
            <div className="py-14 text-center">
              <div className="size-14 rounded-full bg-muted mx-auto flex items-center justify-center mb-3"><Bell className="size-6 text-muted-foreground" /></div>
              <div className="text-sm font-bold">You're all caught up</div>
              <div className="text-xs text-muted-foreground mt-1 max-w-[260px] mx-auto">Add a bill or reminder in Notes and we'll alert you before it's due.</div>
              <button onClick={() => navigate("/notes")} className="mt-4 text-xs font-bold text-primary bg-primary/10 px-4 py-2 rounded-full">Open Notes & Reminders</button>
            </div>
          ) : (
            groups.map(([section, list]) => (
              <div key={section}>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 px-1 font-semibold">{section}</div>
                <div className="space-y-2">
                  {list.map((n, i) => {
                    const Icon = kindIcon[n.kind] || Bell;
                    const st = sevStyle[n.severity];
                    return (
                      <button
                        key={n.id}
                        onClick={() => open(n)}
                        style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                        className={`ls-rise w-full text-left flex items-start gap-3 p-3.5 rounded-2xl border transition active:scale-[0.99] ${st.bg} ${st.border} ${n.read ? "opacity-60" : ""}`}
                      >
                        <div className="size-9 rounded-xl flex items-center justify-center shrink-0 bg-white/80 border border-black/5">
                          <Icon className={`size-4 ${st.icon}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 text-sm font-bold text-slate-900 leading-snug">{n.title}</div>
                            {!n.read && <div className={`size-2 rounded-full mt-1.5 shrink-0 ${st.dot}`} />}
                          </div>
                          {n.body && <div className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.body}</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Preferences */}
          <div className="rounded-2xl bg-card border border-border/60 p-4 space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Feedback</div>
            <Toggle icon={Volume2} label="Sounds for income, expenses & savings" on={sounds} onChange={(v) => { prefs.setSounds(v); setSounds(v); if (v) playTone("income"); }} />
            <Toggle icon={Vibrate} label="Vibration" on={haptics} onChange={(v) => { prefs.setHaptics(v); setHaptics(v); }} />
            <div className="pt-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-2"><Music className="size-3.5" /> Reminder sound (when app is closed)</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "default", label: "System" },
                  { id: "beep", label: "Beep" },
                  { id: "bell", label: "Bell" },
                  { id: "chime", label: "Chime" },
                  { id: "electronic", label: "Electronic" },
                ].map((snd) => (
                  <button
                    key={snd.id}
                    onClick={() => { tap(); store.setNotificationSound(snd.id); }}
                    className={`py-2 text-xs font-semibold rounded-xl border transition active:scale-95 ${store.notificationSound === snd.id ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground"}`}
                  >
                    {snd.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Screen>
    </>
  );
}

function Toggle({ icon: Icon, label, on, onChange }: { icon: typeof Bell; label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className="w-full flex items-center gap-3 text-left">
      <Icon className="size-4 text-slate-500" />
      <span className="flex-1 text-sm text-slate-800">{label}</span>
      <span className={`w-10 h-6 rounded-full p-0.5 transition ${on ? "bg-primary" : "bg-slate-300"}`}>
        <span className={`block size-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}
