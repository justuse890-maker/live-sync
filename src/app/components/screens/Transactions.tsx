import { useMemo, useState } from "react";
import { Search, ArrowDownRight, ArrowUpRight, SlidersHorizontal, Clock, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { Tx, canEditTx, useStore } from "../../store";
import { EditTransaction } from "../EditTransaction";

const categories = ["All", "Food", "Travel", "Shopping", "Subscriptions", "Rent", "Grocery", "Medical", "Salary", "Freelance"];

const paymentShort = (m: string) => ({ cash: "Cash", upi: "UPI", credit: "Credit", debit: "Debit", other: "Other" } as Record<string, string>)[m] || m;

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

export function Transactions() {
  const { transactions, selectedMonth, setSelectedMonth } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [editing, setEditing] = useState<Tx | null>(null);

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

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchQ = !q || t.title.toLowerCase().includes(q.toLowerCase()) || (t.merchant && t.merchant.toLowerCase().includes(q.toLowerCase()));
      const matchC = cat === "All" || t.category === cat;
      const matchMonth = getMonthKey(t.date) === selectedMonth;
      return matchQ && matchC && matchMonth;
    });
  }, [q, cat, transactions, selectedMonth]);

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, t) => {
    (acc[t.date] ||= []).push(t);
    return acc;
  }, {});

  const totalIn = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalOut = -filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <Header title="Transactions" subtitle={formatMonthName(selectedMonth)} />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3.5 shadow-sm">
              <div className="text-xs text-emerald-700">Income</div>
              <div className="font-display text-emerald-800 mt-1" style={{ fontSize: 18, fontWeight: 700 }}>{inr(totalIn)}</div>
            </div>
            <div className="rounded-2xl bg-rose-50 border border-rose-100 p-3.5 shadow-sm">
              <div className="text-xs text-rose-700">Expenses</div>
              <div className="font-display text-rose-800 mt-1" style={{ fontSize: 18, fontWeight: 700 }}>{inr(totalOut)}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search transactions"
                className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button className="size-10 bg-card border border-border rounded-xl flex items-center justify-center">
              <SlidersHorizontal className="size-4" />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1" style={{ scrollbarWidth: "none" }}>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs transition ${
                  cat === c ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"
                }`}
                style={{ fontWeight: 600 }}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="space-y-5">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1" style={{ fontWeight: 600 }}>{date}</div>
                <div className="bg-card rounded-2xl border border-border/60 overflow-hidden shadow-sm">
                  {items.map((t, i) => {
                    const editable = canEditTx(t);
                    return (
                      <button key={t.id} onClick={() => setEditing(t)} className={`w-full text-left flex items-center gap-3 p-3.5 ${i ? "border-t border-border/60" : ""} hover:bg-muted/40 transition`}>
                        <div className={`size-10 rounded-xl flex items-center justify-center ${t.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                          {t.type === "income" ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate flex items-center gap-1.5" style={{ fontWeight: 600 }}>
                            {t.merchant || t.title}
                            {editable ? (
                              <span title="Editable" className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                            ) : (
                              <Lock className="size-3 text-muted-foreground/60" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {t.category}
                            {t.payments && t.payments.length > 0 && (
                              <> · {t.payments.length === 1 ? paymentShort(t.payments[0].mode) : `Split ${t.payments.map((p) => paymentShort(p.mode)).join("+")}`}</>
                            )}
                          </div>
                        </div>
                        <div className={`text-sm ${t.type === "income" ? "text-emerald-600 font-extrabold" : "font-extrabold"}`} style={{ fontWeight: 700 }}>
                          {t.type === "income" ? "+" : "-"}{inr(t.amount)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-sm text-muted-foreground">No transactions match this month or filters.</div>
            )}
          </div>

          <div className="text-[11px] text-muted-foreground text-center px-6 pb-2 flex items-center justify-center gap-1.5">
            <Clock className="size-3" />
            Entries are editable for 5 minutes after adding, then locked for audit integrity.
          </div>
        </div>
      </Screen>
      <EditTransaction tx={editing} onClose={() => setEditing(null)} />
    </>
  );
}
