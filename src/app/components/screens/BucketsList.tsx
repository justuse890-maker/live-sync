import { useState, useMemo } from "react";
import {
  Shield,
  Plane,
  Bike,
  Home,
  Plus,
  Sparkles,
  PiggyBank,
  Car,
  GraduationCap,
  Laptop,
  X,
  ArrowUpCircle,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Clock,
  Archive,
  Calendar,
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { useStore, Bucket } from "../../store";
import { useNavigate } from "react-router";
import { getMonthKey, getCurrentMonthKey, getGoalDeadlineMetrics, getQuickDatePreset, isValidGoalDate } from "../../lib/dateUtils";

const iconMap: Record<string, any> = { Shield, Plane, Bike, Home, PiggyBank, Car, GraduationCap, Laptop };

export function BucketsList({ onBack }: { onBack?: () => void }) {
  const { buckets, addBucket, removeBucket, archiveBucket, bucketContributions, addBucketContribution } = useStore();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // New Bucket Form States
  const [formName, setFormName] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formDeadline, setFormDeadline] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formIcon, setFormIcon] = useState("PiggyBank");
  const [formColor, setFormColor] = useState("#1E40AF");
  const [formMonthlyTarget, setFormMonthlyTarget] = useState("");

  const activeBuckets = useMemo(() => buckets.filter((b) => b.status === "active"), [buckets]);

  // ─── 1. Duplicate Detection ─────────────────────────────────────────────────
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, Bucket[]>();
    for (const b of activeBuckets) {
      const key = `${b.name.trim().toLowerCase()}__${b.targetAmount}`;
      const list = map.get(key) || [];
      list.push(b);
      map.set(key, list);
    }
    return Array.from(map.values()).filter((list) => list.length > 1);
  }, [activeBuckets]);

  const totalDuplicatesCount = useMemo(() => {
    return duplicateGroups.reduce((acc, list) => acc + (list.length - 1), 0);
  }, [duplicateGroups]);

  // ─── 2. One-Click Clean Up Duplicates Handler ──────────────────────────────
  const handleCleanUpDuplicates = async () => {
    if (duplicateGroups.length === 0) return;
    setCleaningUp(true);
    try {
      for (const group of duplicateGroups) {
        // Keep the one with the highest savedAmount (or first one)
        const sorted = [...group].sort((a, b) => b.savedAmount - a.savedAmount);
        const primary = sorted[0];
        const duplicates = sorted.slice(1);

        for (const dup of duplicates) {
          // If duplicate had any contributions, migrate or merge
          if (dup.savedAmount > 0) {
            try {
              await addBucketContribution(primary.id, dup.savedAmount, `Merged from duplicate ${dup.name}`);
            } catch (e) {
              console.warn("Could not merge contribution:", e);
            }
          }
          await removeBucket(dup.id);
        }
      }
    } catch (err) {
      console.error("Clean up duplicates failed:", err);
      alert("Failed to clean up all duplicates. Please try deleting manually.");
    } finally {
      setCleaningUp(false);
    }
  };

  // ─── 3. Delete Single Bucket Handler ────────────────────────────────────────
  const handleDeleteBucket = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to permanently delete "${name}"?`)) {
      setDeletingId(id);
      try {
        await removeBucket(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  // ─── 4. Totals Calculation ──────────────────────────────────────────────────
  const totalSaved = activeBuckets.reduce((s, b) => s + b.savedAmount, 0);
  const totalTarget = activeBuckets.reduce((s, b) => s + b.targetAmount, 0);
  const pct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  // ─── 5. Save New Bucket Handler (With Duplicate Prevention & Real Date Validation)
  const handleSaveBucket = async () => {
    const targetNum = Number(formTarget);
    const trimmedName = formName.trim();
    if (!trimmedName || !targetNum || targetNum <= 0 || isSaving) return;

    // Validate deadline year if set
    if (formDeadline && !isValidGoalDate(formDeadline)) {
      alert("Please enter a valid target date (year up to 2099).");
      return;
    }

    setIsSaving(true);
    try {
      await addBucket({
        name: trimmedName,
        description: formNotes.trim(),
        targetAmount: targetNum,
        targetDate: formDeadline.trim() || undefined,
        iconOrColor: `${formIcon}:${formColor}`,
        monthlySaveTarget: formMonthlyTarget ? Number(formMonthlyTarget) : undefined,
      });

      setAddOpen(false);
      setFormName("");
      setFormTarget("");
      setFormDeadline("");
      setFormNotes("");
      setFormMonthlyTarget("");
    } catch (e) {
      console.error("Save bucket error:", e);
    } finally {
      setIsSaving(false);
    }
  };

  // Check if current form inputs match an existing active bucket
  const isFormDuplicate = useMemo(() => {
    const trimmed = formName.trim().toLowerCase();
    const targetNum = Number(formTarget);
    if (!trimmed || !targetNum) return false;
    return activeBuckets.some(
      (b) => b.name.trim().toLowerCase() === trimmed && b.targetAmount === targetNum
    );
  }, [formName, formTarget, activeBuckets]);

  const todayStr = new Date().toISOString().split("T")[0];
  const formDeadlineMetrics = getGoalDeadlineMetrics(formDeadline, Number(formTarget) || 0, 0);

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

          {/* Duplicate Buckets Alert & 1-Click Fixer */}
          {duplicateGroups.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2.5 shadow-sm animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <div className="size-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-amber-900">
                    {totalDuplicatesCount} Duplicate Goal Bucket{totalDuplicatesCount > 1 ? "s" : ""} Detected
                  </div>
                  <div className="text-[11px] text-amber-800/80 mt-0.5">
                    Identical goals were created ({duplicateGroups.map((g) => g[0].name).join(", ")}), causing your aggregate target to double.
                  </div>
                </div>
              </div>

              <button
                onClick={handleCleanUpDuplicates}
                disabled={cleaningUp}
                className="w-full bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                <Sparkles className="size-3.5" />
                {cleaningUp ? "Merging & Cleaning..." : "1-Click Merge & Remove Duplicates"}
              </button>
            </div>
          )}

          {/* Trigger Create Bucket */}
          <button
            onClick={() => setAddOpen(true)}
            className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary py-3.5 flex items-center justify-center gap-2 transition bg-card hover:bg-primary/5 active:scale-[0.99]"
          >
            <Plus className="size-4" />
            <span className="text-sm font-bold">Create a new goal bucket</span>
          </button>

          {/* Buckets List */}
          <div className="space-y-3">
            {activeBuckets.map((b) => {
              const [iconName, colorHex] = (b.iconOrColor || "PiggyBank:#1E40AF").split(":");
              const Icon = iconMap[iconName] || PiggyBank;
              const color = colorHex || "#1E40AF";
              const p = b.targetAmount > 0 ? (b.savedAmount / b.targetAmount) * 100 : 0;
              const remaining = Math.max(0, b.targetAmount - b.savedAmount);
              const isDeleting = deletingId === b.id;
              const metrics = getGoalDeadlineMetrics(b.targetDate, b.targetAmount, b.savedAmount);

              return (() => {
                const currentMonth = getCurrentMonthKey();
                const monthlyContrib = bucketContributions
                  .filter((c) => c.bucketId === b.id && getMonthKey(c.date) === currentMonth)
                  .reduce((s, c) => s + c.amount, 0);
                const isOnTrack = !b.monthlySaveTarget || monthlyContrib >= b.monthlySaveTarget * 0.5;

                return (
                  <div
                    key={b.id}
                    onClick={() => navigate(`/buckets/${b.id}`)}
                    className={`bg-card rounded-2xl p-4 border border-border/60 shadow-sm relative group cursor-pointer active:scale-[0.98] transition-transform ${
                      isDeleting ? "opacity-40 pointer-events-none" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="size-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: color + "15", color: color }}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate">{b.name}</div>
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          {b.monthlySaveTarget ? (
                            <span>₹{b.monthlySaveTarget.toLocaleString("en-IN")}/mo target · </span>
                          ) : null}
                          {metrics.isInvalid ? (
                            <span className="text-rose-600 font-semibold flex items-center gap-1">
                              <AlertTriangle className="size-3" /> Fix date ({b.targetDate})
                            </span>
                          ) : metrics.hasDeadline ? (
                            <span className={metrics.isOverdue ? "text-rose-600 font-semibold" : "text-slate-600"}>
                              {metrics.formattedDate} ({metrics.timeText})
                            </span>
                          ) : (
                            <span>No deadline</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-sm font-extrabold text-slate-800">{p.toFixed(0)}%</div>
                          {b.monthlySaveTarget && (
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                isOnTrack ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {isOnTrack ? "On Track" : "Behind"}
                            </span>
                          )}
                        </div>

                        {/* Quick Delete Action */}
                        <button
                          onClick={(e) => handleDeleteBucket(e, b.id, b.name)}
                          title="Delete Goal Bucket"
                          className="size-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition opacity-60 group-hover:opacity-100"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>

                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(p, 100)}%`, background: color }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        <span className="text-foreground font-semibold">{inr(b.savedAmount)}</span> saved
                      </span>
                      <span>{inr(remaining)} to go</span>
                    </div>

                    {b.monthlySaveTarget && (
                      <div className="mt-2 pt-2 border-t border-border/40 flex justify-between text-[10px] text-muted-foreground">
                        <span>
                          This month: <strong className="text-foreground">{inr(monthlyContrib)}</strong>
                        </span>
                        <span>
                          Target: <strong className="text-foreground">{inr(b.monthlySaveTarget)}</strong>
                        </span>
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
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => !isSaving && setAddOpen(false)}>
          <div className="fixed inset-0 bg-black/40 animate-in fade-in" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto z-10 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-card py-2 z-10 border-b border-border/40">
              <div className="font-display font-bold text-lg text-slate-800">Create Goal Bucket</div>
              <button
                onClick={() => !isSaving && setAddOpen(false)}
                className="size-8 rounded-full bg-muted flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Bucket Name</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Travel, New House, Emergency Fund"
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Target Amount (₹)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                />
              </div>

              {isFormDuplicate && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                  <span>A goal bucket named <strong>{formName}</strong> for <strong>₹{formTarget}</strong> already exists!</span>
                </div>
              )}

              {/* Target Date Input with Real Validation and Quick Presets */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-muted-foreground font-bold">Target Date (Milestone Deadline)</label>
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
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                />

                {/* Quick Presets */}
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

                {/* Live Deadline Intelligence Feedback */}
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
                      <div className="space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-blue-600" />
                          <span>Target: {formDeadlineMetrics.formattedDate} ({formDeadlineMetrics.timeText})</span>
                        </div>
                        {formDeadlineMetrics.suggestedMonthly > 0 && (
                          <div className="text-[11px] flex items-center justify-between text-blue-800 pt-1">
                            <span>Recommended savings: <strong>{inr(formDeadlineMetrics.suggestedMonthly)}/mo</strong></span>
                            <button
                              type="button"
                              onClick={() => setFormMonthlyTarget(String(formDeadlineMetrics.suggestedMonthly))}
                              className="text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded-md transition"
                            >
                              Use this
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Monthly Save Target (₹) — for on-track alerts</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={formMonthlyTarget}
                  onChange={(e) => setFormMonthlyTarget(e.target.value)}
                  placeholder="e.g. 600 — I'll save ₹600/month"
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <div className="text-[10px] text-muted-foreground mt-1">Smart notifications will alert you if you fall behind this target.</div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Notes (Optional)</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Save for October vacation"
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none min-h-[70px]"
                />
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
                        className={`size-10 rounded-xl flex items-center justify-center border transition ${
                          formIcon === k
                            ? "border-primary bg-primary/10 text-primary scale-105"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
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
                      className={`size-8 rounded-full border-2 transition ${
                        formColor === color ? "border-slate-800 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveBucket}
                disabled={!formName.trim() || !formTarget || isSaving || isFormDuplicate || formDeadlineMetrics.isInvalid}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary/95 transition shadow-md shadow-primary/20 disabled:opacity-50"
              >
                {isSaving ? "Creating Bucket..." : "Create Goal Bucket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
