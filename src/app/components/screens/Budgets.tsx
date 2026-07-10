import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Trash2, Edit3, X } from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { useStore, Budget } from "../../store";

// Helper to match months
function getMonthKey(dateStr: string): string {
  if (/^\d{4}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 7);
  const parts = dateStr.split(" ");
  if (parts.length >= 2) {
    const monthName = parts[0].toLowerCase();
    const year = parts[2] || "2026";
    const monthMap: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const mm = monthMap[monthName.slice(0, 3)];
    if (mm) return `${year}-${mm}`;
  }
  return "2026-06";
}

function formatMonthName(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const idx = parseInt(month, 10) - 1;
  return `${monthNames[idx] || month} ${year}`;
}

export function Budgets({ onBack }: { onBack: () => void }) {
  const {
    budgets,
    transactions,
    selectedMonth,
    setSelectedMonth,
    addBudget,
    updateBudget,
    removeBudget,
    categories
  } = useStore();

  const [addOpen, setAddOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  
  // Form States
  const [formCategory, setFormCategory] = useState("Food");
  const [formLimit, setFormLimit] = useState("");
  const [formColor, setFormColor] = useState("#1E40AF");
  const [editLimitVal, setEditLimitVal] = useState("");

  // Cycle Months
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(prevDate.toISOString().slice(0, 7));
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(nextDate.toISOString().slice(0, 7));
  };

  // Filter budgets for selected month
  const monthlyBudgets = budgets.filter((b) => (b.month || "2026-06") === selectedMonth);

  // Compute spent amount per budget category dynamically from transactions
  const getCategorySpent = (b: Budget) => {
    const txSpent = transactions
      .filter((t) => t.category === b.category && t.type === "expense" && getMonthKey(t.date) === selectedMonth)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    // Fallback to budget.spent if it's June 2026 (to preserve seed presentation)
    if (selectedMonth === "2026-06" && b.id.startsWith("seed-budget-")) {
      return Math.max(b.spent || 0, txSpent);
    }
    return txSpent;
  };

  const totalSpent = monthlyBudgets.reduce((s, b) => s + getCategorySpent(b), 0);
  const totalLimit = monthlyBudgets.reduce((s, b) => s + b.limit, 0);

  const handleSaveBudget = async () => {
    const limitNum = Number(formLimit);
    if (!limitNum || limitNum <= 0) return;
    
    // Check if category budget already exists for this month
    const existing = monthlyBudgets.find((b) => b.category === formCategory);
    if (existing) {
      await updateBudget({
        ...existing,
        limit: limitNum,
        color: formColor
      });
    } else {
      await addBudget({
        category: formCategory,
        limit: limitNum,
        spent: 0,
        color: formColor,
        month: selectedMonth
      });
    }
    setAddOpen(false);
    setFormLimit("");
  };

  const handleUpdateLimit = async () => {
    const limitNum = Number(editLimitVal);
    if (editBudget && limitNum > 0) {
      await updateBudget({
        ...editBudget,
        limit: limitNum
      });
      setEditBudget(null);
    }
  };

  return (
    <>
      <Header title="Budgets" subtitle={formatMonthName(selectedMonth)} showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          
          {/* Month Selector Carousel */}
          <div className="flex justify-between items-center bg-card rounded-2xl p-3.5 border border-border/60 shadow-sm">
            <button onClick={handlePrevMonth} className="size-9 bg-muted hover:bg-muted/80 rounded-xl flex items-center justify-center transition">
              <ChevronLeft className="size-4" />
            </button>
            <span className="font-display text-sm font-bold text-slate-800">{formatMonthName(selectedMonth)}</span>
            <button onClick={handleNextMonth} className="size-9 bg-muted hover:bg-muted/80 rounded-xl flex items-center justify-center transition">
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Overall Monthly summary */}
          <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm">
            <div className="flex justify-between items-baseline">
              <div>
                <div className="text-xs text-muted-foreground">Total spent this month</div>
                <div className="font-display mt-1" style={{ fontSize: 28, fontWeight: 700 }}>{inr(totalSpent)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">of {inr(totalLimit)} limit</div>
                <div className={`text-sm font-semibold mt-1 ${totalLimit - totalSpent >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {totalLimit - totalSpent >= 0 ? `${inr(totalLimit - totalSpent)} left` : `${inr(totalSpent - totalLimit)} over`}
                </div>
              </div>
            </div>
            {totalLimit > 0 && (
              <div className="h-2.5 bg-muted rounded-full overflow-hidden mt-4">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${totalSpent / totalLimit >= 1.0 ? "bg-rose-500" : totalSpent / totalLimit >= 0.85 ? "bg-amber-500" : "bg-primary"}`} 
                  style={{ width: `${Math.min((totalSpent / totalLimit) * 100, 100)}%` }} 
                />
              </div>
            )}
          </div>

          {/* Add Category Budget Trigger */}
          <button onClick={() => setAddOpen(true)} className="w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-primary py-3.5 flex items-center justify-center gap-2 transition bg-card hover:bg-primary/5">
            <Plus className="size-4" />
            <span className="text-sm font-bold">Add category budget</span>
          </button>

          {/* Budgets List */}
          <div className="space-y-3">
            {monthlyBudgets.map((b) => {
              const spentAmt = getCategorySpent(b);
              const p = b.limit > 0 ? (spentAmt / b.limit) * 100 : 0;
              const over = p >= 90;
              return (
                <div key={b.id} className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm relative group">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm font-bold text-slate-800">{b.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        <span className="text-foreground font-extrabold">{inr(spentAmt)}</span> / {inr(b.limit)}
                      </span>
                      <button 
                        onClick={() => { setEditBudget(b); setEditLimitVal(String(b.limit)); }}
                        className="size-7 bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg flex items-center justify-center transition"
                      >
                        <Edit3 className="size-3.5" />
                      </button>
                      <button 
                        onClick={() => removeBudget(b.id)}
                        className="size-7 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center transition"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(p, 100)}%`, background: over ? "#EF4444" : b.color || "#1E40AF" }} />
                  </div>
                  {over && (
                    <div className="text-[11px] text-rose-600 mt-1.5 font-bold">
                      ⚠ {p >= 100 ? "Limit exceeded!" : `${p.toFixed(0)}% used — limit spending`}
                    </div>
                  )}
                </div>
              );
            })}
            {monthlyBudgets.length === 0 && (
              <div className="text-center py-10 bg-card rounded-2xl border border-dashed border-border/80">
                <p className="text-sm text-muted-foreground">No budgets set for this month.</p>
                <button onClick={() => setAddOpen(true)} className="text-xs text-primary font-bold mt-1 hover:underline">Set one now</button>
              </div>
            )}
          </div>
        </div>
      </Screen>

      {/* Add Budget Modal */}
      {addOpen && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => setAddOpen(false)}>
          <div className="absolute inset-0 bg-black/40 animate-in fade-in" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center mb-4">
              <div className="font-display font-bold text-lg text-slate-800">Set Category Budget</div>
              <button onClick={() => setAddOpen(false)} className="size-8 rounded-full bg-muted flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Select Category</label>
                <select 
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background"
                >
                  {categories.filter(c => c !== "All").map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1 font-display">Limit (₹)</label>
                <input 
                  type="number"
                  inputMode="decimal"
                  value={formLimit}
                  onChange={(e) => setFormLimit(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
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
                onClick={handleSaveBudget}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary/95 transition shadow-md shadow-primary/20"
              >
                Save Budget Limit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Budget Modal */}
      {editBudget && (
        <div className="absolute inset-0 z-50 flex items-end" onClick={() => setEditBudget(null)}>
          <div className="absolute inset-0 bg-black/40 animate-in fade-in" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center mb-4">
              <div className="font-display font-bold text-lg text-slate-800">Edit Budget Limit</div>
              <button onClick={() => setEditBudget(null)} className="size-8 rounded-full bg-muted flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">Category</label>
                <div className="w-full rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm font-semibold text-slate-700">
                  {editBudget.category}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1 font-display">New Limit (₹)</label>
                <input 
                  type="number"
                  inputMode="decimal"
                  value={editLimitVal}
                  onChange={(e) => setEditLimitVal(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <button 
                onClick={handleUpdateLimit}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary/95 transition shadow-md shadow-primary/20"
              >
                Update Limit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
