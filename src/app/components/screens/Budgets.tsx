import { useState } from "react";
import { Plus, ChevronLeft, ChevronRight, Trash2, Edit3, X } from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { useStore, Budget } from "../../store";
import { getMonthKey, formatMonthName, shiftMonth } from "../../lib/dateUtils";
import { useTranslation } from "../../lib/i18n";
import { feedback } from "../../lib/feedback";
import { rolloverCarry, budgetView, MonthFigures } from "../../lib/budgetRollover";

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
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();
  
  // Form States
  const [formCategory, setFormCategory] = useState("Food");
  const [formLimit, setFormLimit] = useState("");
  const [formColor, setFormColor] = useState("#1E40AF");
  const [editLimitVal, setEditLimitVal] = useState("");
  const [editRollover, setEditRollover] = useState(false);

  // Cycle Months
  const handlePrevMonth = () => {
    setSelectedMonth(shiftMonth(selectedMonth, -1));
  };

  const handleNextMonth = () => {
    setSelectedMonth(shiftMonth(selectedMonth, 1));
  };

  // Filter budgets for selected month
  // A budget without a month is a standing monthly budget (applies every month).
  const monthlyBudgets = budgets.filter((b) => (b.month ? b.month === selectedMonth : true));

  // Compute spent amount per budget category dynamically from transactions
  const getCategorySpent = (b: Budget) => {
    // Always computed live from this month's expenses in that category.
    return transactions
      .filter((t) => (t.category || "").trim().toLowerCase() === (b.category || "").trim().toLowerCase() && t.type === "expense" && getMonthKey(t.date) === selectedMonth)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
  };

  // Money carried in from earlier months (only for budgets with rollover switched on).
  const carryFor = (b: Budget): number => {
    if (!b.rollover) return 0;
    const cat = (b.category || "").trim().toLowerCase();
    const history: MonthFigures[] = [];
    for (let i = 6; i >= 1; i--) {
      const m = shiftMonth(selectedMonth, -i);
      const own = budgets.find((x) => (x.category || "").trim().toLowerCase() === cat && x.month === m)
        ?? budgets.find((x) => (x.category || "").trim().toLowerCase() === cat && !x.month);
      const spent = transactions
        .filter((t) => (t.category || "").trim().toLowerCase() === cat && t.type === "expense" && getMonthKey(t.date) === m)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      // A month with no expenses recorded at all was not tracked — don't treat it as a fully unspent budget.
      const tracked = transactions.some((t) => t.type === "expense" && getMonthKey(t.date) === m);
      history.push({ limit: own && tracked ? own.limit : null, spent });
    }
    return rolloverCarry(history);
  };

  const prevMonth = shiftMonth(selectedMonth, -1);
  const prevBudgets = budgets.filter((b) => b.month === prevMonth);
  const copyPrevious = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      for (const b of prevBudgets) {
        await addBudget({ category: b.category, limit: b.limit, spent: 0, color: b.color, month: selectedMonth, rollover: b.rollover });
      }
      feedback({ kind: "success", title: `${prevBudgets.length} budgets copied`, subtitle: `From ${formatMonthName(prevMonth)}` });
    } finally {
      setSubmitting(false);
    }
  };

  const totalSpent = monthlyBudgets.reduce((s, b) => s + getCategorySpent(b), 0);
  const totalLimit = monthlyBudgets.reduce((s, b) => s + b.limit + carryFor(b), 0);

  const handleSaveBudget = async () => {
    if (submitting) return;
    const limitNum = Number(formLimit);
    if (!limitNum || limitNum <= 0) return;
    setSubmitting(true);
    try {
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
      feedback({ kind: "success", title: `${formCategory} budget saved`, subtitle: `Limit ₹${limitNum.toLocaleString("en-IN")} for ${formatMonthName(selectedMonth)}` });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateLimit = async () => {
    if (submitting) return;
    const limitNum = Number(editLimitVal);
    if (editBudget && limitNum > 0) {
      setSubmitting(true);
      try {
        await updateBudget({
          ...editBudget,
          limit: limitNum,
          rollover: editRollover,
        });
        setEditBudget(null);
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <>
      <Header title={t("budgets.title")} subtitle={formatMonthName(selectedMonth)} showBack onBack={onBack} />
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
                <div className="text-xs text-muted-foreground">{t("budgets.totalSpent")}</div>
                <div className="font-display mt-1" style={{ fontSize: 28, fontWeight: 700 }}>{inr(totalSpent)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">of {inr(totalLimit)} limit</div>
                <div className={`text-sm font-semibold mt-1 ${totalLimit - totalSpent >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {totalLimit - totalSpent >= 0 ? `${inr(totalLimit - totalSpent)} ${t("budgets.left", { amount: "" }).replace(" ", "")}` : `${inr(totalSpent - totalLimit)} ${t("budgets.over", { amount: "" }).replace(" ", "")}`}
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
            <span className="text-sm font-bold">{t("budgets.addCategoryBudget")}</span>
          </button>

          {/* Budgets List */}
          <div className="space-y-3">
            {monthlyBudgets.map((b) => {
              const spentAmt = getCategorySpent(b);
              const v = budgetView(b.limit, spentAmt, carryFor(b));
              const p = v.pct;
              const over = p >= 90;
              return (
                <div key={b.id} className="bg-card rounded-2xl p-4 border border-border/60 shadow-sm relative group">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-sm font-bold text-slate-800">{b.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        <span className="text-foreground font-extrabold">{inr(spentAmt)}</span> / {inr(v.effectiveLimit)}
                      </span>
                      <button 
                        onClick={() => { setEditBudget(b); setEditLimitVal(String(b.limit)); setEditRollover(!!b.rollover); }}
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
                  {v.carry > 0 && (
                    <div className="text-[11px] text-emerald-700 mt-1.5 font-semibold">+{inr(v.carry)} carried over from earlier months</div>
                  )}
                  {over && (
                    <div className="text-[11px] text-rose-600 mt-1.5 font-bold">
                      ⚠ {p >= 100 ? t("budgets.limitExceeded") : t("budgets.limitSpending", { pct: p.toFixed(0) })}
                    </div>
                  )}
                </div>
              );
            })}
            {monthlyBudgets.length === 0 && (
              <div className="text-center py-10 bg-card rounded-2xl border border-dashed border-border/80">
                <p className="text-sm text-muted-foreground">{t("budgets.noBudgets")}</p>
                <button onClick={() => setAddOpen(true)} className="text-xs text-primary font-bold mt-1 hover:underline">{t("budgets.setOneNow")}</button>
                {prevBudgets.length > 0 && (
                  <button onClick={copyPrevious} disabled={submitting} className="block mx-auto mt-3 text-xs font-bold text-white bg-primary px-4 py-2 rounded-full active:scale-95">
                    Copy {prevBudgets.length} budgets from {formatMonthName(prevMonth, "short")}
                  </button>
                )}
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
              <div className="font-display font-bold text-lg text-slate-800">{t("budgets.setCategoryBudget")}</div>
              <button onClick={() => setAddOpen(false)} className="size-8 rounded-full bg-muted flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">{t("budgets.selectCategory")}</label>
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
                <label className="text-xs text-muted-foreground font-bold block mb-1 font-display">{t("budgets.limitAmount")}</label>
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
                <label className="text-xs text-muted-foreground font-bold block mb-1">{t("budgets.themeColor")}</label>
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
                disabled={submitting}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary/95 transition shadow-md shadow-primary/20 disabled:opacity-40"
              >
                {submitting ? t("budgets.saving") : t("budgets.saveBudgetLimit")}
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
              <div className="font-display font-bold text-lg text-slate-800">{t("budgets.editBudgetLimit")}</div>
              <button onClick={() => setEditBudget(null)} className="size-8 rounded-full bg-muted flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1">{t("budgets.category")}</label>
                <div className="w-full rounded-xl bg-muted/60 px-3.5 py-2.5 text-sm font-semibold text-slate-700">
                  {editBudget.category}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-bold block mb-1 font-display">{t("budgets.newLimit")}</label>
                <input 
                  type="number"
                  inputMode="decimal"
                  value={editLimitVal}
                  onChange={(e) => setEditLimitVal(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full rounded-xl border border-border px-3 py-2.5 text-sm bg-background focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer">
                <input type="checkbox" checked={editRollover} onChange={(e) => setEditRollover(e.target.checked)} className="mt-0.5 size-4" />
                <span className="text-xs leading-snug">
                  <span className="font-bold text-slate-800 block">Carry unspent money forward</span>
                  <span className="text-muted-foreground">Whatever you don’t spend this month is added to next month’s limit (up to 6 months back). Overspending never reduces next month.</span>
                </span>
              </label>

              <button 
                onClick={handleUpdateLimit}
                disabled={submitting}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:bg-primary/95 transition shadow-md shadow-primary/20 disabled:opacity-40"
              >
                {submitting ? t("budgets.updating") : t("budgets.updateLimit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
