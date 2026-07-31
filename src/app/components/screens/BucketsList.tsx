import { useState } from "react";
import { Shield, Plane, Bike, Home, Plus, Sparkles, PiggyBank, Car, GraduationCap, Laptop, X, ArrowUpCircle } from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { useStore, Bucket } from "../../store";
import { useNavigate } from "react-router";

const iconMap: Record<string, any> = { Shield, Plane, Bike, Home, PiggyBank, Car, GraduationCap, Laptop };

export function BucketsList({ onBack }: { onBack?: () => void }) {
  const { buckets, addBucket, bucketContributions } = useStore();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  
  // New Bucket Form States
  const [formName, setFormName] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formIcon, setFormIcon] = useState("PiggyBank");
  const [formColor, setFormColor] = useState("#1E40AF");
  const [formMonthlyTarget, setFormMonthlyTarget] = useState("");

  const activeBuckets = buckets.filter((b) => b.status === "active");
  const totalSaved = activeBuckets.reduce((s, b) => s + b.savedAmount, 0);
  const totalTarget = activeBuckets.reduce((s, b) => s + b.targetAmount, 0);
  const pct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const handleSaveBucket = async () => {
    const targetNum = Number(formTarget);
    if (!formName.trim() || !targetNum || targetNum <= 0) return;
    
    await addBucket({
      name: formName.trim(),
      description: formNotes.trim(),
      targetAmount: targetNum,
      targetDate: formDeadline || undefined,
      iconOrColor: `${formIcon}:${formColor}`,
      monthlySaveTarget: formMonthlyTarget ? Number(formMonthlyTarget) : undefined,
    });

    setAddOpen(false);
    setFormName("");
    setFormTarget("");
    setFormDeadline("");
    setFormNotes("");
    setFormMonthlyTarget("");
  };

  return (
    <>
      <Header title="Goal Buckets" subtitle={`${activeBuckets.length} active`} showBack={!!onBack} onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4 pb-24">
          
          {/* Main Progress Card */}
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-5 shadow-lg shadow-indigo-600/10">
            <div className="text-white/70 text-[10px] uppercase tracking-wider font-bold">Total saved towards goals</div>
            <div className="font-display mt-1" style={{ fontSize: 28, fontWeight: 700 }}>{inr(totalSaved)}</div>
            <div className="text-white/80 text-xs">of {inr(totalTarget)} aggregate target</div>
            {totalTarget > 0 && (
              <div className="h-2 bg-white/20 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            )}
            {totalTarget > 0 && (
              <div className="text-[10px] text-white/70 mt-1 text-right font-bold">{pct.toFixed(0)}% Saved</div>
            )}
          </div>

          {/* Trigger Create Bucket */}
          <button onClick={() => setAddOpen(true)} className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary py-3.5 flex items-center justify-center gap-2 transition bg-card hover:bg-primary/5">
            <Plus className="size-4" />
            <span className="text-sm font-bold">Create a new goal bucket</span>
          </button>

          {/* Buckets List */}
          <div className="space-y-3">
            {activeBuckets.map((b) => {
              const [iconName, colorHex] = b.iconOrColor.split(":");
              const Icon = iconMap[iconName] || PiggyBank;
              const color = colorHex || "#1E40AF";
              const p = b.targetAmount > 0 ? (b.savedAmount / b.targetAmount) * 100 : 0;
              const remaining = Math.max(0, b.targetAmount - b.savedAmount);

              return (() => {
                const currentMonth = new Date().toISOString().slice(0, 7);
                const monthlyContrib = bucketContributions
                  .filter(c => c.bucketId === b.id && c.date.startsWith(currentMonth))
                  .reduce((s, c) => s + c.amount, 0);
                const isOnTrack = !b.monthlySaveTarget || monthlyContrib >= b.monthlySaveTarget * 0.5;
                return (
                  <div 
                    key={b.id} 
                    onClick={() => navigate(`/buckets/${b.id}`)}
                    className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm relative group cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="size-11 rounded-xl flex items-center justify-center" style={{ background: color + "15", color: color }}>
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate">{b.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.monthlySaveTarget ? `₹${b.monthlySaveTarget.toLocaleString("en-IN")}/mo target · ` : ""}
                          {b.targetDate || "No deadline"}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <div className="text-sm font-extrabold text-slate-800">{p.toFixed(0)}%</div>
                        {b.monthlySaveTarget && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isOnTrack ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {isOnTrack ? "On Track" : "Behind"}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(p, 100)}%`, background: color }} />
                    </div>
                    
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span><span className="text-foreground font-semibold">{inr(b.savedAmount)}</span> saved</span>
                      <span>{inr(remaining)} to go</span>
                    </div>
                    {b.monthlySaveTarget && (
                      <div className="mt-2 pt-2 border-t border-border/40 flex justify-between text-[10px] text-muted-foreground">
                        <span>This month: <strong className="text-foreground">{inr(monthlyContrib)}</strong></span>
                        <span>Target: <strong className="text-foreground">{inr(b.monthlySaveTarget)}</strong></span>
                      </div>
                    )}
                  </div>
                );
              })();
            })}
            {activeBuckets.length === 0 && (
              <div className="text-center py-10 bg-card rounded-2xl border border-dashed border-border/80">
                <PiggyBank className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-slate-800 font-semibold">No active buckets</p>
                <p className="text-xs text-muted-foreground mt-0.5">Define your milestones and start tracking progress.</p>
              </div>
            )}
          </div>
        </div>
      </Screen>

      {/* Create Bucket Modal */}
      {addOpen && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => setAddOpen(false)}>
          <div className="absolute inset-0 bg-black/40 animate-in fade-in" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-card py-2 z-10">
              <div className="font-display font-bold text-lg text-slate-800">Create Goal Bucket</div>
              <button onClick={() => setAddOpen(false)} className="size-8 rounded-full bg-muted flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Bucket Name</label>
                <input 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. New House, Emergency Fund"
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Target Amount (₹)</label>
                <input 
                  type="number"
                  inputMode="decimal"
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                  placeholder="e.g. 150000"
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Target Date (Optional)</label>
                <input 
                  type="date"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Notes (Optional)</label>
                <textarea 
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Save for house down payment"
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none min-h-[80px]"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Monthly Save Target (₹) — for on-track alerts</label>
                <input 
                  type="number"
                  inputMode="decimal"
                  value={formMonthlyTarget}
                  onChange={(e) => setFormMonthlyTarget(e.target.value)}
                  placeholder="e.g. 5000 — I'll save ₹5k/month"
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <div className="text-[10px] text-muted-foreground mt-1">Smart notifications will alert you if you fall behind this target.</div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Select Icon</label>
                <div className="flex flex-wrap gap-2">
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

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Theme Color</label>
                <div className="flex gap-2.5">
                  {["#1E40AF", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"].map((color) => (
                    <button 
                      key={color}
                      onClick={() => setFormColor(color)}
                      className={`size-8 rounded-full border-2 transition ${formColor === color ? "border-slate-800 scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <button 
                onClick={handleSaveBucket}
                disabled={!formName.trim() || !formTarget}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary/95 transition shadow-md shadow-primary/20 disabled:opacity-50"
              >
                Create Goal Bucket
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
