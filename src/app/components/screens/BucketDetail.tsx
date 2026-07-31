import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Shield, Plane, Bike, Home, PiggyBank, Car, GraduationCap, Laptop, X, ArrowUpCircle, Settings, Plus, Sparkles, Trash2, Archive } from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { useStore } from "../../store";
import { format, parseISO } from "date-fns";

const iconMap: Record<string, any> = { Shield, Plane, Bike, Home, PiggyBank, Car, GraduationCap, Laptop };

export function BucketDetail({ onBack }: { onBack?: () => void }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { buckets, bucketContributions, addBucketContribution, archiveBucket } = useStore();
  
  const bucket = buckets.find((b) => b.id === id);
  const [contribOpen, setContribOpen] = useState(false);
  const [contribAmt, setContribAmt] = useState("");
  const [contribNote, setContribNote] = useState("");
  const [loading, setLoading] = useState(false);

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
  
  const [iconName, colorHex] = bucket.iconOrColor.split(":");
  const Icon = iconMap[iconName] || PiggyBank;
  const color = colorHex || "#1E40AF";

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

  // Ring calc
  const strokeWidth = 8;
  const radius = 50 - strokeWidth / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(p, 100) / 100) * circumference;

  return (
    <>
      <Header 
        title={bucket.name} 
        showBack={!!onBack} 
        onBack={onBack} 
        rightNode={
          <button onClick={handleArchive} className="size-8 flex items-center justify-center text-muted-foreground hover:text-rose-600 transition">
            <Archive className="size-5" />
          </button>
        }
      />
      <Screen>
        <div className="px-5 pt-4 space-y-6 pb-24">
          
          {/* Main Progress Ring */}
          <div className="bg-card rounded-3xl p-6 border border-border/60 shadow-sm flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              {bucket.status === "completed" && (
                <div className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] uppercase font-bold rounded-md flex items-center gap-1">
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
                <div className="size-12 rounded-full flex items-center justify-center mb-1" style={{ background: color + "15", color: color }}>
                  <Icon className="size-6" />
                </div>
                <div className="font-extrabold text-xl">{p.toFixed(0)}%</div>
              </div>
            </div>

            <div className="mt-6 w-full grid grid-cols-2 gap-4 text-center">
              <div className="bg-slate-50 rounded-2xl p-3 border border-border/50">
                <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-0.5">Saved</div>
                <div className="font-bold text-slate-800">{inr(bucket.savedAmount)}</div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3 border border-border/50">
                <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-0.5">Remaining</div>
                <div className="font-bold text-slate-800">{inr(remaining)}</div>
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

          {/* Notes */}
          {bucket.description && (
            <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm">
              <div className="text-xs uppercase text-muted-foreground font-bold tracking-wider mb-2">Notes</div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{bucket.description}</p>
            </div>
          )}

          {/* Details */}
          <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Target Amount</span>
              <span className="font-semibold text-slate-800">{inr(bucket.targetAmount)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Target Date</span>
              <span className="font-semibold text-slate-800">{bucket.targetDate ? format(parseISO(bucket.targetDate), "MMM yyyy") : "No deadline"}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-semibold capitalize text-slate-800">{bucket.status}</span>
            </div>
          </div>

          {/* History */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50 flex justify-between items-center">
              <div className="text-xs uppercase text-slate-800 font-extrabold tracking-wider">Contribution History</div>
              <div className="text-xs font-bold text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">{history.length}</div>
            </div>
            <div className="divide-y divide-border/50">
              {history.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No contributions yet. Start saving!
                </div>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <ArrowUpCircle className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800">Deposit</div>
                        <div className="text-xs text-muted-foreground">{format(parseISO(h.date), "dd MMM yyyy, h:mm a")}</div>
                        {h.note && <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">"{h.note}"</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-600 text-sm">+{inr(h.amount)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </Screen>

      {/* Contribution Modal */}
      {contribOpen && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => !loading && setContribOpen(false)}>
          <div className="absolute inset-0 bg-black/40 animate-in fade-in" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200">
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
