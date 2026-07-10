import { Tv, Music, Cloud, Palette, FileText, AlertTriangle, TrendingUp, Eye, Copy } from "lucide-react";
import { subscriptions } from "../../data";
import { Header, Screen } from "../Shell";
import { inr } from "../types";

const icons = { Tv, Music, Cloud, Palette, FileText } as Record<string, any>;
const statusBadge = {
  active: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Active" },
  increased: { bg: "bg-amber-50", text: "text-amber-700", label: "Price ↑" },
  unused: { bg: "bg-rose-50", text: "text-rose-700", label: "Unused" },
  duplicate: { bg: "bg-rose-50", text: "text-rose-700", label: "Duplicate" },
};

export function Subscriptions({ onBack }: { onBack: () => void }) {
  const monthly = subscriptions.reduce((s, x) => s + x.cost, 0);
  const wasted = subscriptions.filter((s) => s.status === "unused" || s.status === "duplicate").reduce((s, x) => s + x.cost, 0);

  return (
    <>
      <Header title="Subscription Shield" subtitle={`${subscriptions.length} active`} showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl p-4 border border-border/60">
              <div className="text-xs text-muted-foreground">Monthly total</div>
              <div className="font-display mt-1" style={{ fontSize: 20, fontWeight: 700 }}>{inr(monthly)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{inr(monthly * 12)} / year</div>
            </div>
            <div className="bg-rose-50 rounded-2xl p-4">
              <div className="text-xs text-rose-700">Potential savings</div>
              <div className="font-display text-rose-800 mt-1" style={{ fontSize: 20, fontWeight: 700 }}>{inr(wasted)}/mo</div>
              <div className="text-xs text-rose-700 mt-0.5">Cancel to save {inr(wasted * 12)}/yr</div>
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4 flex gap-3">
            <AlertTriangle className="size-4 text-amber-700 mt-0.5" />
            <div className="flex-1 text-sm text-amber-800">
              <div style={{ fontWeight: 700 }}>1 price increase detected</div>
              <div className="text-xs mt-0.5 opacity-80">Spotify rose ₹30/mo this cycle.</div>
            </div>
          </div>

          <div className="space-y-2.5">
            {subscriptions.map((s) => {
              const Icon = icons[s.icon];
              const sb = statusBadge[s.status as keyof typeof statusBadge];
              return (
                <div key={s.id} className="bg-card rounded-2xl p-4 border border-border/60">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-muted flex items-center justify-center">
                      <Icon className="size-5 text-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm truncate" style={{ fontWeight: 700 }}>{s.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${sb.bg} ${sb.text}`} style={{ fontWeight: 600 }}>{sb.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Renews {s.renewal} · {s.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm" style={{ fontWeight: 700 }}>{inr(s.cost)}</div>
                      {s.trend === "up" && <div className="text-[10px] text-amber-600 flex items-center gap-0.5 justify-end"><TrendingUp className="size-3" />+₹{s.priceChange}</div>}
                    </div>
                  </div>
                  {(s.status === "unused" || s.status === "duplicate" || s.status === "increased") && (
                    <div className="mt-3 pt-3 border-t border-border/60 flex gap-2">
                      <button className="flex-1 py-1.5 rounded-lg bg-muted text-xs" style={{ fontWeight: 600 }}>Keep</button>
                      <button className="flex-1 py-1.5 rounded-lg bg-muted text-xs flex items-center justify-center gap-1" style={{ fontWeight: 600 }}><Eye className="size-3" />Review</button>
                      <button className="flex-1 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs" style={{ fontWeight: 600 }}>Cancel</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Screen>
    </>
  );
}
