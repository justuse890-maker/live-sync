import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Shield, Plane, Bike, Home, PiggyBank, Car, GraduationCap, Laptop, X,
  ArrowUpCircle, Pencil, Plus, Sparkles, Trash2, Archive, Calendar,
  AlertCircle, AlertTriangle, Clock, TrendingUp, CheckCircle2
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { useStore, Bucket } from "../../store";
import { format, parseISO } from "date-fns";
import { getGoalDeadlineMetrics, getQuickDatePreset, isValidGoalDate } from "../../lib/dateUtils";

const iconMap: Record<string, any> = { Shield, Plane, Bike, Home, PiggyBank, Car, GraduationCap, Laptop };

export function BucketDetail({ onBack }: { onBack?: () => void }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { buckets, bucketContributions, addBucketContribution, updateBucket, archiveBucket, removeBucket } = useStore();
  
  const bucket = buckets.find((b) => b.id === id);
  const [contribOpen, setContribOpen] = useState(false);
  const [contribAmt, setContribAmt] = useState("");
  const [contribNote, setContribNote] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit Bucket State
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editMonthlyTarget, setEditMonthlyTarget] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editIcon, setEditIcon] = useState("PiggyBank");
  const [editColor, setEditColor] = useState("#1E40AF");
  const [isUpdating, setIsUpdating] = useState(false);

  if (!bucket) {
    return (
      <>
        <Header title="Bucket Not Found" showBack={!!onBack} onBack={onBack} />
        <Screen>
          <div className="flex flex-col items-center justify-center p-10 h-full text-center">
            <PiggyBank className="size-12 text-muted-foreground mb-4" />
            <p className="font-semibold">Bucket not found</p>
            <p className="text-sm text-muted-foreground mt-1">It may have been deleted.</p>
            <button onClick={onBack} className="mt-4 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold">Go Back</button>
          </div>
        </Screen>
      </>
    );
  }

  const history = bucketContributions.filter((c) => c.bucketId === id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const p = bucket.targetAmount > 0 ? (bucket.savedAmount / bucket.targetAmount) * 100 : 0;
  const remaining = Math.max(0, bucket.targetAmount - bucket.savedAmount);
  
  const [iconName, colorHex] = (bucket.iconOrColor || "PiggyBank:#1E40AF").split(":");
  const Icon = iconMap[iconName] || PiggyBank;
  const color = colorHex || "#1E40AF";

  // Deadline intelligence metrics
  const deadlineMetrics = getGoalDeadlineMetrics(bucket.targetDate, bucket.targetAmount, bucket.savedAmount);

  const openEditModal = () => {
    setEditName(bucket.name);
    setEditTarget(String(bucket.targetAmount));
    // If target date is invalid year (e.g. 3333), leave empty or default to realistic
    setEditDeadline(isValidGoalDate(bucket.targetDate) ? (bucket.targetDate || "") : "");
    setEditMonthlyTarget(bucket.monthlySaveTarget ? String(bucket.monthlySaveTarget) : "");
    setEditNotes(bucket.description || "");
    setEditIcon(iconName);
    setEditColor(color);
    setEditOpen(true);
  };

  const handleUpdateBucket = async () => {
    const targetNum = Number(editTarget);
    const trimmedName = editName.trim();
    if (!trimmedName || !targetNum || targetNum <= 0 || isUpdating) return;

    setIsUpdating(true);
    try {
      const updated: Bucket = {
        ...bucket,
        name: trimmedName,
        targetAmount: targetNum,
        targetDate: editDeadline.trim() || undefined,
        monthlySaveTarget: editMonthlyTarget ? Number(editMonthlyTarget) : undefined,
        description: editNotes.trim() || undefined,
        iconOrColor: `${editIcon}:${editColor}`,
      };
      await updateBucket(updated);
      setEditOpen(false);
    } catch (e) {
      console.error("Update bucket error:", e);
      alert("Failed to update goal bucket");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleContribute = async () => {
    const amt = Number(contribAmt);
    if (!amt || amt <= 0) return;
    setLoading(true);
    try {
      await addBucketContribution(bucket.id, amt, contribNote.trim() || undefined);
      setContribOpen(false);
      setContribAmt("");
      setContribNote("");
    } catch (e) {
      alert("Failed to add contribution");
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (confirm("Are you sure you want to archive this bucket? It will no longer track new savings.")) {
      await archiveBucket(bucket.id);
      navigate(-1);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to permanently delete "${bucket.name}"? This cannot be undone.`)) {
      await removeBucket(bucket.id);
      navigate(-1);
    }
  };

  // Ring calc
  const strokeWidth = 8;
  const radius = 50 - strokeWidth / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(p, 100) / 100) * circumference;

  const todayStr = new Date().toISOString().split("T")[0];
  const editDeadlineMetrics = getGoalDeadlineMetrics(editDeadline, Number(editTarget) || 0, bucket.savedAmount);

  return (
    <>
      <Header 
        title={bucket.name} 
        showBack={!!onBack} 
        onBack={onBack} 
        rightNode={
          <div className="flex items-center gap-1">
            <button
              onClick={openEditModal}
              title="Edit Goal Bucket"
              className="size-8 flex items-center justify-center text-muted-foreground hover:text-primary transition rounded-lg hover:bg-muted"
            >
              <Pencil className="size-4" />
            </button>
            <button
              onClick={handleArchive}
              title="Archive Bucket"
              className="size-8 flex items-center justify-center text-muted-foreground hover:text-amber-600 transition rounded-lg hover:bg-muted"
            >
              <Archive className="size-4" />
            </button>
            <button
              onClick={handleDelete}
              title="Delete Bucket Permanently"
              className="size-8 flex items-center justify-center text-muted-foreground hover:text-rose-600 transition rounded-lg hover:bg-rose-50"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        }
      />
      <Screen>
        <div className="px-5 pt-4 space-y-5 pb-24">
          
          {/* Invalid Date Banner (e.g. year 3333 typo) */}
          {deadlineMetrics.isInvalid && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm animate-in fade-in">
              <AlertCircle className="size-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-rose-900">Invalid Target Date Detected</div>
                <div className="text-[11px] text-rose-700 mt-0.5">
                  The target date is set to an unrealistic year ({bucket.targetDate}). Tap below to set a real milestone date.
                </div>
                <button
                  onClick={openEditModal}
                  className="mt-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                >
                  <Calendar className="size-3.5" /> Fix Target Date Now
                </button>
              </div>
            </div>
          )}

          {/* Main Progress Ring Card */}
          <div className="bg-card rounded-3xl p-6 border border-border/60 shadow-sm flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              {bucket.status === "completed" && (
                <div className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold rounded-full flex items-center gap-1 shadow-sm">
                  <Sparkles className="size-3" /> Completed
                </div>
              )}
            </div>
            
            <div className="relative size-40 flex items-center justify-center">
              <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/30" />
                <circle 
                  cx="50" 
                  cy="50" 
                  r={radius} 
                  fill="none" 
                  stroke={color} 
                  strokeWidth={strokeWidth} 
                  strokeDasharray={circumference} 
                  strokeDashoffset={offset} 
                  strokeLinecap="round" 
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="size-12 rounded-full flex items-center justify-center mb-1 shadow-sm" style={{ background: color + "15", color: color }}>
                  <Icon className="size-6" />
                </div>
                <div className="font-extrabold text-2xl text-slate-800">{p.toFixed(0)}%</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Saved</div>
              </div>
            </div>

            <div className="mt-6 w-full grid grid-cols-2 gap-3 text-center">
              <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-border/50">
                <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-0.5">Saved</div>
                <div className="font-bold text-slate-800 text-base">{inr(bucket.savedAmount)}</div>
              </div>
              <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-border/50">
                <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-0.5">Remaining</div>
                <div className="font-bold text-slate-800 text-base">{inr(remaining)}</div>
              </div>
            </div>

            {remaining > 0 && (
              <button 
                onClick={() => setContribOpen(true)}
                className="w-full mt-4 rounded-xl py-3.5 text-white font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-lg shadow-primary/20"
                style={{ backgroundColor: color }}
              >
                <ArrowUpCircle className="size-5" /> Add Money
              </button>
            )}
          </div>

          {/* Target Date & Savings Runway Insight Card */}
          {deadlineMetrics.hasDeadline && remaining > 0 && (
            <div className="rounded-2xl p-4 bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-purple-50/80 border border-indigo-100 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
                  <Clock className="size-4 text-indigo-600" />
                  <span>Timeline: {deadlineMetrics.timeText}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  deadlineMetrics.isOverdue ? "bg-rose-100 text-rose-700" : "bg-indigo-100 text-indigo-700"
                }`}>
                  {deadlineMetrics.formattedDate}
                </span>
              </div>
              
              <div className="text-xs text-indigo-900/80 leading-relaxed">
                {deadlineMetrics.isOverdue ? (
                  <span>Deadline has passed. Target saving is <strong>{inr(remaining)}</strong> to finish this goal.</span>
                ) : (
                  <span>
                    Save approx <strong className="text-indigo-950">{inr(deadlineMetrics.suggestedMonthly)}/month</strong> over the next {deadlineMetrics.monthsRemaining} month{deadlineMetrics.monthsRemaining > 1 ? "s" : ""} to reach your target on schedule.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {bucket.description && (
            <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm">
              <div className="text-xs uppercase text-muted-foreground font-bold tracking-wider mb-2">Notes</div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{bucket.description}</p>
            </div>
          )}

          {/* Goal Details Breakdown */}
          <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm space-y-3.5">
            <div className="flex justify-between items-center pb-2 border-b border-border/40">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Goal Parameters</div>
              <button onClick={openEditModal} className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                <Pencil className="size-3" /> Edit
              </button>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground text-xs font-medium">Target Amount</span>
              <span className="font-bold text-slate-800">{inr(bucket.targetAmount)}</span>
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground text-xs font-medium">Target Date</span>
              <div className="text-right">
                <div className={`font-bold ${deadlineMetrics.isInvalid ? "text-rose-600" : "text-slate-800"}`}>
                  {deadlineMetrics.formattedDate}
                </div>
                {deadlineMetrics.hasDeadline && (
                  <div className={`text-[10px] font-semibold ${deadlineMetrics.isOverdue ? "text-rose-600" : "text-indigo-600"}`}>
                    {deadlineMetrics.timeText}
                  </div>
                )}
              </div>
            </div>

            {bucket.monthlySaveTarget && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground text-xs font-medium">Monthly Save Target</span>
                <span className="font-bold text-slate-800">{inr(bucket.monthlySaveTarget)}/mo</span>
              </div>
            )}

            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground text-xs font-medium">Status</span>
              <span className="font-semibold capitalize text-slate-800 px-2 py-0.5 bg-slate-100 rounded-md text-xs">
                {bucket.status}
              </span>
            </div>
          </div>

          {/* History */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 flex justify-between items-center bg-slate-50/50">
              <div className="text-xs uppercase text-slate-800 font-extrabold tracking-wider">Contribution History</div>
              <div className="text-xs font-bold text-muted-foreground bg-slate-200/70 px-2 py-0.5 rounded-full">{history.length}</div>
            </div>
            <div className="divide-y divide-border/50">
              {history.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No contributions yet. Start saving!
                </div>
              ) : (
                history.map((h) => {
                  let formattedDate = h.date;
                  try {
                    formattedDate = format(parseISO(h.date), "dd MMM yyyy, h:mm a");
                  } catch {
                    // Fallback if parsing fails
                  }
                  return (
                    <div key={h.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                          <ArrowUpCircle className="size-4" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800">Deposit</div>
                          <div className="text-xs text-muted-foreground">{formattedDate}</div>
                          {h.note && <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">"{h.note}"</div>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-600 text-sm">+{inr(h.amount)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </Screen>

      {/* Edit Bucket Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => !isUpdating && setEditOpen(false)}>
          <div className="fixed inset-0 bg-black/40 animate-in fade-in" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto z-10 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-card py-2 z-10 border-b border-border/40">
              <div className="font-display font-bold text-lg text-slate-800">Edit Goal Bucket</div>
              <button
                onClick={() => !isUpdating && setEditOpen(false)}
                className="size-8 rounded-full bg-muted flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Bucket Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Travel, New House, Emergency Fund"
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Target Amount (₹)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                />
              </div>

              {/* Target Date Section with Quick Presets & Real Validation */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-muted-foreground font-bold">Target Date (Milestone Deadline)</label>
                  {editDeadline && (
                    <button
                      type="button"
                      onClick={() => setEditDeadline("")}
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
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
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
                      onClick={() => setEditDeadline(getQuickDatePreset(preset.months))}
                      className="text-[11px] font-semibold px-2 py-1 bg-slate-100 hover:bg-primary/10 hover:text-primary rounded-lg transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Live Deadline Intelligence Feedback */}
                {editDeadline && (
                  <div className={`mt-2 p-2.5 rounded-xl text-xs border ${
                    editDeadlineMetrics.isInvalid 
                      ? "bg-rose-50 border-rose-200 text-rose-800" 
                      : "bg-blue-50/80 border-blue-200 text-blue-900"
                  }`}>
                    {editDeadlineMetrics.isInvalid ? (
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="size-3.5 text-rose-600 shrink-0" />
                        <span>Please enter a realistic year between 2000 and 2099.</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-blue-600" />
                          <span>Target: {editDeadlineMetrics.formattedDate} ({editDeadlineMetrics.timeText})</span>
                        </div>
                        {editDeadlineMetrics.suggestedMonthly > 0 && (
                          <div className="text-[11px] flex items-center justify-between text-blue-800 pt-1">
                            <span>Recommended savings: <strong>{inr(editDeadlineMetrics.suggestedMonthly)}/mo</strong></span>
                            <button
                              type="button"
                              onClick={() => setEditMonthlyTarget(String(editDeadlineMetrics.suggestedMonthly))}
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
                <label className="text-xs text-muted-foreground font-bold block mb-1">Monthly Save Target (₹) (Optional)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={editMonthlyTarget}
                  onChange={(e) => setEditMonthlyTarget(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Notes (Optional)</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Saving for house down payment"
                  className="w-full rounded-xl border border-border px-3.5 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none min-h-[60px]"
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
                        onClick={() => setEditIcon(k)}
                        className={`size-10 rounded-xl flex items-center justify-center border transition ${
                          editIcon === k
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
                  {["#1E40AF", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`size-8 rounded-full border-2 transition ${
                        editColor === c ? "border-slate-800 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleUpdateBucket}
                disabled={!editName.trim() || !editTarget || isUpdating || editDeadlineMetrics.isInvalid}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary/95 transition shadow-md shadow-primary/20 disabled:opacity-50"
              >
                {isUpdating ? "Saving Changes..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contribution Modal */}
      {contribOpen && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => !loading && setContribOpen(false)}>
          <div className="fixed inset-0 bg-black/40 animate-in fade-in" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200 z-10 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <div className="font-display font-bold text-lg text-slate-800">Add to Bucket</div>
              <button disabled={loading} onClick={() => setContribOpen(false)} className="size-8 rounded-full bg-muted flex items-center justify-center disabled:opacity-50">
                <X className="size-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1 font-display">Amount (₹)</label>
                <input 
                  type="number"
                  inputMode="decimal"
                  value={contribAmt}
                  onChange={(e) => setContribAmt(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full rounded-xl border border-border px-3 py-3 text-lg font-bold bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Note (Optional)</label>
                <input 
                  value={contribNote}
                  onChange={(e) => setContribNote(e.target.value)}
                  placeholder="e.g. Bonus, Monthly Savings"
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <button 
                onClick={handleContribute}
                disabled={loading || !contribAmt || Number(contribAmt) <= 0}
                className="w-full rounded-xl py-3.5 text-white font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-lg shadow-primary/20 disabled:opacity-50"
                style={{ backgroundColor: color }}
              >
                {loading ? "Adding..." : "Confirm Deposit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
