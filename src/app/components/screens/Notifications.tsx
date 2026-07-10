import { useEffect, useState } from "react";
import { Bell, CheckCircle2, Gift, Info, Loader2, CheckCheck } from "lucide-react";
import { Header, Screen } from "../Shell";
import { api } from "../../lib/api";

type Notif = { id: string; title: string; body?: string; kind: string; at: string; read: boolean };

export function Notifications({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setItems(await api.notifications()); } catch (e) { console.warn("notifications load failed", e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    // Mark all read on open (mirrors prior overlay behaviour).
    api.markNotificationsRead().catch((e) => console.warn("mark read failed", e));
  }, []);

  const sorted = Array.from(new Map(items.map((n) => [n.id, n])).values())
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const grouped = sorted.reduce<Record<string, Notif[]>>((acc, n) => {
    const key = sectionKey(n.at);
    (acc[key] ||= []).push(n);
    return acc;
  }, {});

  const markAll = async () => {
    try { await api.markNotificationsRead(); setItems((xs) => xs.map((n) => ({ ...n, read: true }))); }
    catch (e) { console.warn("mark all failed", e); }
  };

  return (
    <>
      <Header
        title="Notifications"
        subtitle={loading ? "Loading…" : `${items.length} item${items.length === 1 ? "" : "s"}`}
        showBack
        onBack={onBack}
        right={
          items.some((n) => !n.read) ? (
            <button
              onClick={markAll}
              className="text-[11px] text-primary flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted"
              style={{ fontWeight: 600 }}
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          ) : (
            <div className="w-1" />
          )
        }
      />
      <Screen>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="size-14 rounded-full bg-muted mx-auto flex items-center justify-center mb-3">
              <Bell className="size-6 text-muted-foreground" />
            </div>
            <div className="text-sm" style={{ fontWeight: 700 }}>You're all caught up</div>
            <div className="text-xs text-muted-foreground mt-1">
              We'll let you know when something needs your attention.
            </div>
          </div>
        ) : (
          <div className="px-5 pt-4 space-y-5">
            {Object.entries(grouped).map(([section, list]) => (
              <div key={section}>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 px-1" style={{ fontWeight: 600 }}>
                  {section}
                </div>
                <div className="bg-card border border-border/60 rounded-2xl overflow-hidden">
                  {list.map((n) => (
                    <div key={n.id} className={`flex gap-3 px-4 py-3 border-b border-border/60 last:border-0 ${n.read ? "" : "bg-indigo-500/[0.04]"}`}>
                      <KindIcon kind={n.kind} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <div className="text-sm flex-1 min-w-0 break-words" style={{ fontWeight: n.read ? 500 : 700 }}>{n.title}</div>
                          {!n.read && <span className="size-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />}
                        </div>
                        {n.body && <div className="text-xs text-muted-foreground mt-0.5 break-words leading-relaxed">{n.body}</div>}
                        <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Screen>
    </>
  );
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "success") return <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />;
  if (kind === "offer") return <Gift className="size-4 text-amber-500 mt-0.5 shrink-0" />;
  return <Info className="size-4 text-sky-500 mt-0.5 shrink-0" />;
}

function sectionKey(at: string) {
  const d = new Date(at); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "Earlier this week";
  if (diff < 30) return "This month";
  return "Older";
}
