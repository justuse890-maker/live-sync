import { useState } from "react";
import { Tv, Music, Cloud, Palette, FileText, AlertTriangle, TrendingUp, Eye, Plus, X, Trash2, ShieldAlert } from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { useStore, Subscription } from "../../store";

const iconMap: Record<string, any> = { Tv, Music, Cloud, Palette, FileText };

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Active" },
  increased: { bg: "bg-amber-50", text: "text-amber-700", label: "Price ↑" },
  unused: { bg: "bg-rose-50", text: "text-rose-700", label: "Unused" },
  duplicate: { bg: "bg-rose-50", text: "text-rose-700", label: "Duplicate" },
};

export function Subscriptions({ onBack }: { onBack: () => void }) {
  const { subscriptions, addSubscription, removeSubscription } = useStore();
  const [addOpen, setAddOpen] = useState(false);

  // Add Form States
  const [formName, setFormName] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formRenewal, setFormRenewal] = useState("");
  const [formCategory, setFormCategory] = useState("Entertainment");
  const [formStatus, setFormStatus] = useState("active");
  const [formIcon, setFormIcon] = useState("Tv");

  const monthlyTotal = subscriptions.reduce((s, x) => s + x.cost, 0);
  const wastedTotal = subscriptions
    .filter((s) => s.status === "unused" || s.status === "duplicate")
    .reduce((s, x) => s + x.cost, 0);

  const priceIncreases = subscriptions.filter((s) => s.status === "increased");

  const handleSaveSubscription = async () => {
    const costNum = Number(formCost);
    if (!formName.trim() || !costNum || costNum <= 0) return;

    await addSubscription({
      name: formName.trim(),
      cost: costNum,
      renewal: formRenewal || "Monthly",
      category: formCategory,
      status: formStatus,
      icon: formIcon,
      trend: "stable",
      priceChange: 0
    });

    setAddOpen(false);
    setFormName("");
    setFormCost("");
    setFormRenewal("");
  };

  const handleKeep = async (sub: Subscription) => {
    // Mark as active to remove flags
    await addSubscription({
      ...sub,
      status: "active"
    });
  };

  return (
    <>
      <Header title="Subscription Shield" subtitle={`${subscriptions.length} active`} showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm">
              <div className="text-xs text-muted-foreground">Monthly outlay</div>
              <div className="font-display mt-1" style={{ fontSize: 20, fontWeight: 700 }}>{inr(monthlyTotal)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{inr(monthlyTotal * 12)} / year</div>
            </div>
            <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100 shadow-sm">
              <div className="text-xs text-rose-700">Wasted outgoings</div>
              <div className="font-display text-rose-800 mt-1" style={{ fontSize: 20, fontWeight: 700 }}>{inr(wastedTotal)}/mo</div>
              <div className="text-[10px] text-rose-700 mt-0.5">Cancel unused & duplicates</div>
            </div>
          </div>

          {/* Alert of Price Hikes */}
          {priceIncreases.length > 0 && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3 shadow-sm">
              <AlertTriangle className="size-4 text-amber-700 mt-0.5" />
              <div className="flex-1 text-sm text-amber-800">
                <div style={{ fontWeight: 700 }}>{priceIncreases.length} price increase(s) detected</div>
                <div className="text-xs mt-0.5 opacity-80">
                  {priceIncreases.map(s => `${s.name} rose ₹${s.priceChange}/mo`).join(", ")}
                </div>
              </div>
            </div>
          )}

          {/* Trigger Modal */}
          <button onClick={() => setAddOpen(true)} className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary py-3.5 flex items-center justify-center gap-2 transition bg-card hover:bg-primary/5">
            <Plus className="size-4" />
            <span className="text-sm font-bold">Track new subscription</span>
          </button>

          {/* Subscriptions list */}
          <div className="space-y-2.5">
            {subscriptions.map((s) => {
              const Icon = iconMap[s.icon] || Tv;
              const sb = statusBadge[s.status] || statusBadge.active;
              const isWasted = s.status === "unused" || s.status === "duplicate" || s.status === "increased";

              return (
                <div key={s.id} className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm transition">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-muted flex items-center justify-center">
                      <Icon className="size-5 text-slate-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800 truncate">{s.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${sb.bg} ${sb.text}`}>{sb.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Renews {s.renewal} · {s.category}</div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <div className="text-sm font-extrabold text-slate-800">{inr(s.cost)}</div>
                        {s.trend === "up" && (
                          <div className="text-[10px] text-amber-600 flex items-center gap-0.5 justify-end">
                            <TrendingUp className="size-3" />+₹{s.priceChange}
                          </div>
                        )}
                      </div>
                      {!isWasted && (
                        <button 
                          onClick={() => removeSubscription(s.id)}
                          className="size-8 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center transition"
                          title="Delete subscription"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {isWasted && (
                    <div className="mt-3 pt-3 border-t border-border/60 flex gap-2">
                      <button onClick={() => handleKeep(s)} className="flex-1 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-bold text-slate-700 transition">Keep</button>
                      <button onClick={() => removeSubscription(s.id)} className="flex-1 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold transition">Cancel Sub</button>
                    </div>
                  )}
                </div>
              );
            })}
            {subscriptions.length === 0 && (
              <div className="text-center py-10 bg-card rounded-2xl border border-dashed border-border/80">
                <ShieldAlert className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-slate-800 font-semibold">No active subscriptions</p>
                <p className="text-xs text-muted-foreground mt-0.5">Add subscriptions to monitor leakage & duplicate bills.</p>
              </div>
            )}
          </div>
        </div>
      </Screen>

      {/* Add Subscription Modal */}
      {addOpen && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => setAddOpen(false)}>
          <div className="absolute inset-0 bg-black/40 animate-in fade-in" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center mb-4">
              <div className="font-display font-bold text-lg text-slate-800">Track Subscription</div>
              <button onClick={() => setAddOpen(false)} className="size-8 rounded-full bg-muted flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Subscription Name</label>
                <input 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Netflix, Disney+, Adobe CC"
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-bold block mb-1">Cost (₹ / month)</label>
                  <input 
                    type="number"
                    inputMode="decimal"
                    value={formCost}
                    onChange={(e) => setFormCost(e.target.value)}
                    placeholder="e.g. 199"
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-bold block mb-1">Renewal Cycle / Date</label>
                  <input 
                    value={formRenewal}
                    onChange={(e) => setFormRenewal(e.target.value)}
                    placeholder="e.g. Jun 18, 15th of month"
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-bold block mb-1">Category</label>
                  <select 
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background"
                  >
                    <option value="Entertainment">Entertainment</option>
                    <option value="Music">Music</option>
                    <option value="Productivity">Productivity</option>
                    <option value="Storage">Storage</option>
                    <option value="Utility">Utility</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-bold block mb-1">Flag Status</label>
                  <select 
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background"
                  >
                    <option value="active">Active (Good)</option>
                    <option value="unused">Unused (Leakage)</option>
                    <option value="duplicate">Duplicate (Warning)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Select Icon</label>
                <div className="flex gap-2">
                  {Object.keys(iconMap).map((k) => {
                    const TargetIcon = iconMap[k];
                    return (
                      <button 
                        key={k}
                        onClick={() => setFormIcon(k)}
                        className={`size-10 rounded-xl flex items-center justify-center border transition ${formIcon === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                      >
                        <TargetIcon className="size-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={handleSaveSubscription}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary/95 transition shadow-md shadow-primary/20"
              >
                Start Shield Monitoring
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
