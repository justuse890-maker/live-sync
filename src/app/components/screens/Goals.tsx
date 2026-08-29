import { useState } from "react";
import { Shield, Plane, Bike, Home, Plus, Sparkles, Trash2, PiggyBank, Car, GraduationCap, Laptop, X, ArrowUpCircle, Calendar, AlertTriangle } from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { useStore, Goal } from "../../store";
import { getGoalDeadlineMetrics, getQuickDatePreset, isValidGoalDate } from "../../lib/dateUtils";

const iconMap: Record<string, any> = { Shield, Plane, Bike, Home, PiggyBank, Car, GraduationCap, Laptop };

export function Goals({ onBack }: { onBack?: () => void }) {
  const { goals, addGoal, updateGoal, removeGoal } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  const [contribGoal, setContribGoal] = useState<Goal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // New Goal Form States
  const [formName, setFormName] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formCurrent, setFormCurrent] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formIcon, setFormIcon] = useState("PiggyBank");
  const [formColor, setFormColor] = useState("#1E40AF");

  // Contribution Form State
  const [contribAmt, setContribAmt] = useState("");

  const total = goals.reduce((s, g) => s + g.current, 0);
  const target = goals.reduce((s, g) => s + g.target, 0);
  const pct = target > 0 ? (total / target) * 100 : 0;

  const handleSaveGoal = async () => {
    if (submitting) return;
    const targetNum = Number(formTarget);
    if (!formName.trim() || !targetNum || targetNum <= 0) return;
    setSubmitting(true);
    try {
      await addGoal({
        name: formName.trim(),
        target: targetNum,
        current: Number(formCurrent) || 0,
        deadline: formDeadline || getQuickDatePreset(12),
        icon: formIcon,
        color: formColor
      });

      setAddOpen(false);
      // Reset fields
      setFormName("");
      setFormTarget("");
      setFormCurrent("");
      setFormDeadline("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleContribute = async () => {
    if (submitting) return;
    const amt = Number(contribAmt);
    if (contribGoal && amt > 0) {
      setSubmitting(true);
      try {
        const newCurrent = Math.min(contribGoal.current + amt, contribGoal.target);
        await updateGoal({
          ...contribGoal,
          current: newCurrent
        });
        setContribGoal(null);
        setContribAmt("");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const formDeadlineMetrics = getGoalDeadlineMetrics(formDeadline, Number(formTarget) || 0, Number(formCurrent) || 0);

  return (
    <>
      <Header title="Goals" subtitle={`${goals.length} active`} showBack={!!onBack} onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          
          {/* Main Progress Card */}
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-700 text-white p-5 shadow-lg shadow-indigo-600/10">
            <div className="text-white/70 text-[10px] uppercase tracking-wider font-bold">Total saved towards goals</div>
            <div className="font-display mt-1" style={{ fontSize: 28, fontWeight: 700 }}>{inr(total)}</div>
            <div className="text-white/80 text-xs">of {inr(target)} aggregate target</div>
            {target > 0 && (
              <div className="h-2 bg-white/20 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            )}
            {target > 0 && (
              <div className="text-[10px] text-white/70 mt-1 text-right font-bold">{pct.toFixed(0)}% Saved</div>
            )}
          </div>

          {/* Trigger Create Goal */}
          <button onClick={() => setAddOpen(true)} className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary py-3.5 flex items-center justify-center gap-2 transition bg-card hover:bg-primary/5">
            <Plus className="size-4" />
            <span className="text-sm font-bold">Create a new goal</span>
          </button>

          {/* Goals List */}
          <div className="space-y-3">
            {goals.map((g) => {
              const Icon = iconMap[g.icon] || PiggyBank;
              const p = g.target > 0 ? (g.current / g.target) * 100 : 0;
              const remaining = Math.max(0, g.target - g.current);
              const metrics = getGoalDeadlineMetrics(g.deadline, g.target, g.current);

              return (
                <div key={g.id} className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm relative group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="size-11 rounded-xl flex items-center justify-center" style={{ background: (g.color || "#1E40AF") + "15", color: g.color || "#1E40AF" }}>
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{g.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        {metrics.isInvalid ? (
                          <span className="text-rose-600 font-semibold">⚠️ Fix date ({g.deadline})</span>
                        ) : metrics.hasDeadline ? (
                          <span>Target: {metrics.formattedDate} ({metrics.timeText})</span>
                        ) : (
                          <span>Target: {g.deadline || "No deadline"}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div className="text-sm font-extrabold text-slate-800">{p.toFixed(0)}%</div>
                      <button 
                        onClick={() => setContribGoal(g)}
                        className="size-7 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg flex items-center justify-center transition"
                        title="Add funds"
                      >
                        <ArrowUpCircle className="size-4" />
                      </button>
                      <button 
                        onClick={() => removeGoal(g.id)}
                        className="size-7 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center transition"
                        title="Delete Goal"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(p, 100)}%`, background: g.color || "#1E40AF" }} />
                  </div>
                  
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span><span className="text-foreground font-semibold">{inr(g.current)}</span> saved</span>
                    <span>{inr(remaining)} to go</span>
                  </div>

                  {remaining > 0 && metrics.hasDeadline && !metrics.isOverdue && (
                    <div className="mt-2 pt-2 border-t border-border/40 flex justify-between text-[11px] text-muted-foreground">
                      <span>Timeline: {metrics.timeText}</span>
                      <span className="font-semibold text-foreground">Save {inr(metrics.suggestedMonthly)}/mo</span>
                    </div>
                  )}
                </div>
              );
            })}
            {goals.length === 0 && (
              <div className="text-center py-10 bg-card rounded-2xl border border-dashed border-border/80">
                <PiggyBank className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-slate-800 font-semibold">No active goals</p>
                <p className="text-xs text-muted-foreground mt-0.5">Define your milestones and start tracking progress.</p>
              </div>
            )}
          </div>
        </div>
      </Screen>

      {/* Create Goal Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setAddOpen(false)}>
          <div className="fixed inset-0 bg-black/40 animate-in fade-in" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto z-10 shadow-2xl">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-card py-2 z-10 border-b border-border/40">
              <div className="font-display font-bold text-lg text-slate-800">Create New Goal</div>
              <button onClick={() => setAddOpen(false)} className="size-8 rounded-full bg-muted flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Goal Name</label>
                <input 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. New Macbook Pro, Home Deposit"
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="text-xs text-muted-foreground font-bold block mb-1">Initial Savings (₹)</label>
                  <input 
                    type="number"
                    inputMode="decimal"
                    value={formCurrent}
                    onChange={(e) => setFormCurrent(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-muted-foreground font-bold">Target Deadline</label>
                  {formDeadline && (
                    <button
                      type="button"
                      onClick={() => setFormDeadline("")}
                      className="text-[11px] text-rose-600 hover:underline font-semibold"
                    >
                      Clear Date
                    </button>
                  )}
                </div>
                <input 
                  type="date"
                  min={todayStr}
                  max="2099-12-31"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-muted-foreground mr-0.5">Quick set:</span>
                  {[
                    { label: "+3M", months: 3 },
                    { label: "+6M", months: 6 },
                    { label: "+1 Yr", months: 12 },
                    { label: "+2 Yrs", months: 24 },
                    { label: "+5 Yrs", months: 60 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFormDeadline(getQuickDatePreset(preset.months))}
                      className="text-[11px] font-semibold px-2 py-1 bg-slate-100 hover:bg-primary/10 hover:text-primary rounded-lg transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {formDeadline && (
                  <div className={`mt-2 p-2.5 rounded-xl text-xs border ${
                    formDeadlineMetrics.isInvalid 
                      ? "bg-rose-50 border-rose-200 text-rose-800" 
                      : "bg-blue-50/80 border-blue-200 text-blue-900"
                  }`}>
                    {formDeadlineMetrics.isInvalid ? (
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="size-3.5 text-rose-600 shrink-0" />
                        <span>Please enter a realistic year between 2000 and 2099.</span>
                      </div>
                    ) : (
                      <div className="font-bold flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-blue-600" />
                        <span>Target: {formDeadlineMetrics.formattedDate} ({formDeadlineMetrics.timeText})</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Select Icon</label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(iconMap).map((k) => {
                    const TargetIcon = iconMap[k];
                    return (
                      <button 
                        key={k}
                        type="button"
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
                      type="button"
                      onClick={() => setFormColor(color)}
                      className={`size-8 rounded-full border-2 transition ${formColor === color ? "border-slate-800 scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <button 
                type="button"
                onClick={handleSaveGoal}
                disabled={!formName.trim() || !formTarget || formDeadlineMetrics.isInvalid || submitting}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary/95 transition shadow-md shadow-primary/20 disabled:opacity-50"
              >
                {submitting ? "Creating Goal..." : "Create Financial Goal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contribution Modal */}
      {contribGoal && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => setContribGoal(null)}>
          <div className="absolute inset-0 bg-black/40 animate-in fade-in" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center mb-4">
              <div className="font-display font-bold text-lg text-slate-800">Add Savings to Goal</div>
              <button onClick={() => setContribGoal(null)} className="size-8 rounded-full bg-muted flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="text-xs text-muted-foreground block mb-0.5">Goal</span>
                <span className="text-sm font-bold text-slate-850">{contribGoal.name}</span>
                <span className="text-xs text-muted-foreground block mt-1">Current Balance: {inr(contribGoal.current)} of {inr(contribGoal.target)}</span>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1 font-display font-bold">Contribution Amount (₹)</label>
                <input 
                  type="number"
                  inputMode="decimal"
                  value={contribAmt}
                  onChange={(e) => setContribAmt(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                  autoFocus
                />
              </div>

              <button 
                onClick={handleContribute}
                disabled={submitting}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary/95 transition shadow-md shadow-primary/20 disabled:opacity-50"
              >
                {submitting ? "Allocating..." : "Confirm Allocation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
