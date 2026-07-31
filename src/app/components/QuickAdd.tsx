import { useMemo, useState } from "react";
import { X, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Loader2, Plus, Banknote, Smartphone, CreditCard, Wallet, MoreHorizontal, Trash2, Pencil, Mic, Camera } from "lucide-react";
import { PaymentMode, PaymentSplit, useStore } from "../store";
import { CaptureVoiceScan } from "./CaptureVoiceScan";
import { hapticSuccess, hapticLight } from "../lib/native";

const paymentMeta: Record<PaymentMode, { label: string; icon: any; tint: string }> = {
  cash:   { label: "Cash",   icon: Banknote,         tint: "#10B981" },
  upi:    { label: "UPI",    icon: Smartphone,       tint: "#1E40AF" },
  credit: { label: "Credit", icon: CreditCard,       tint: "#8B5CF6" },
  debit:  { label: "Debit",  icon: Wallet,           tint: "#F59E0B" },
  other:  { label: "Other",  icon: MoreHorizontal,   tint: "#64748B" },
};
const paymentOrder: PaymentMode[] = ["cash", "upi", "credit", "debit", "other"];

export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addTransaction, categories, addCategory } = useStore();
  const [tab, setTab] = useState<"manual" | "voice" | "scan">("manual");
  const [type, setType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("Food");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [singleMode, setSingleMode] = useState<PaymentMode>("upi");
  const [splitOn, setSplitOn] = useState(false);
  const [splits, setSplits] = useState<PaymentSplit[]>([{ mode: "cash", amount: 0 }, { mode: "upi", amount: 0 }]);
  const [newCat, setNewCat] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [saving, setSaving] = useState(false);

  const total = Number(amount || 0);
  const splitTotal = useMemo(() => splits.reduce((s, p) => s + (Number(p.amount) || 0), 0), [splits]);
  const splitOk = !splitOn || (total > 0 && Math.abs(splitTotal - total) < 0.01);

  const reset = () => {
    setAmount(""); setMerchant(""); setNotes("");
    setSplitOn(false); setSplits([{ mode: "cash", amount: 0 }, { mode: "upi", amount: 0 }]);
    setNewCat(""); setShowNewCat(false);
  };

  const save = async () => {
    if (!amount || !splitOk) return;
    setSaving(true);
    const isIncome = type === "income";
    const payments: PaymentSplit[] = isIncome
      ? []
      : splitOn
        ? splits.filter((s) => s.amount > 0)
        : [{ mode: singleMode, amount: total }];
    await addTransaction({
      title: merchant || (isIncome ? "Income" : cat),
      category: isIncome ? "Income" : cat,
      amount: isIncome ? total : -total,
      type: isIncome ? "income" : "expense",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
      merchant: merchant || undefined,
      payments: payments.length ? payments : undefined,
      notes: notes || undefined,
    });
    hapticSuccess();
    setSaving(false);
    reset();
    onClose();
  };

  const handleAddCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    await addCategory(name);
    setCat(name);
    setNewCat("");
    setShowNewCat(false);
  };

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 animate-in fade-in" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200">
        <div className="flex justify-between items-center mb-4">
          <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>Add transaction</div>
          <button onClick={() => { hapticLight(); onClose(); }} className="size-8 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform duration-150">
            <X className="size-4" />
          </button>
        </div>

        <div className="bg-muted rounded-xl p-1 flex mb-4">
          {[
            { id: "manual", label: "Manual", icon: Pencil },
            { id: "voice", label: "Voice", icon: Mic },
            { id: "scan", label: "Scan", icon: Camera },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-1 transition ${
                tab === t.id ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
              style={{ fontWeight: 600 }}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {tab !== "manual" && <CaptureVoiceScan mode={tab} onClose={onClose} />}

        {tab === "manual" && <>
        <div className="bg-muted rounded-xl p-1 flex mb-4">
          {[
            { id: "expense", label: "Expense", icon: ArrowDownRight },
            { id: "income", label: "Income", icon: ArrowUpRight },
            { id: "transfer", label: "Transfer", icon: ArrowLeftRight },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id as any)}
              className={`flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-1 transition ${
                type === t.id ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
              style={{ fontWeight: 600 }}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <div className="bg-muted/60 rounded-2xl p-5 text-center mb-4">
          <div className="text-xs text-muted-foreground mb-1">Amount</div>
          <div className="flex items-center justify-center gap-2">
            <span className="font-display text-muted-foreground" style={{ fontSize: 24 }}>₹</span>
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0"
              className="bg-transparent outline-none w-40 text-center font-display"
              style={{ fontSize: 32, fontWeight: 700 }}
            />
          </div>
        </div>

        {type !== "transfer" && (
          <>
            <Field label="Merchant / shop">
              <input
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="e.g. Starbucks, BigBasket"
                className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>

            <Field label="Category">
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    className={`px-3 py-1.5 rounded-full text-xs transition ${
                      cat === c ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                    style={{ fontWeight: 600 }}
                  >
                    {c}
                  </button>
                ))}
                <button onClick={() => setShowNewCat((v) => !v)} className="px-3 py-1.5 rounded-full text-xs bg-muted text-muted-foreground border border-dashed border-border flex items-center gap-1" style={{ fontWeight: 600 }}>
                  <Plus className="size-3" /> New
                </button>
              </div>
              {showNewCat && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                    placeholder="Category name"
                    className="flex-1 bg-muted/60 rounded-xl px-3 py-2 text-sm outline-none"
                  />
                  <button onClick={handleAddCategory} className="px-3 rounded-xl bg-primary text-primary-foreground text-xs" style={{ fontWeight: 600 }}>Add</button>
                </div>
              )}
            </Field>

            {type === "expense" && (
              <Field
                label="Payment mode"
                rightSlot={
                  <button onClick={() => setSplitOn((v) => !v)} className={`text-xs ${splitOn ? "text-primary" : "text-muted-foreground"}`} style={{ fontWeight: 600 }}>
                    {splitOn ? "Single" : "Split payment"}
                  </button>
                }
              >
                {!splitOn ? (
                  <div className="grid grid-cols-5 gap-2">
                    {paymentOrder.map((m) => {
                      const meta = paymentMeta[m];
                      const active = singleMode === m;
                      return (
                        <button
                          key={m}
                          onClick={() => setSingleMode(m)}
                          className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] transition border ${
                            active ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-muted text-muted-foreground"
                          }`}
                          style={{ fontWeight: 600 }}
                        >
                          <meta.icon className="size-4" style={{ color: active ? meta.tint : undefined }} />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <SplitEditor splits={splits} setSplits={setSplits} total={total} splitTotal={splitTotal} />
                )}
              </Field>
            )}

            <Field label="Notes (optional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What was this for?"
                rows={2}
                className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none focus:ring-2 focus:ring-primary/30"
              />
            </Field>
          </>
        )}

        <button
          onClick={save}
          disabled={!amount || saving || !splitOk}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm disabled:opacity-40 flex items-center justify-center gap-2 mt-1 active:scale-[0.97] transition-transform duration-150"
          style={{ fontWeight: 700 }}
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save {type}
        </button>
        </>}
      </div>
    </div>
  );
}

function Field({ label, rightSlot, children }: { label: string; rightSlot?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-muted-foreground" style={{ fontWeight: 600 }}>{label}</span>
        {rightSlot}
      </div>
      {children}
    </div>
  );
}

function SplitEditor({ splits, setSplits, total, splitTotal }: { splits: PaymentSplit[]; setSplits: (s: PaymentSplit[]) => void; total: number; splitTotal: number }) {
  const remaining = total - splitTotal;
  const update = (i: number, patch: Partial<PaymentSplit>) => {
    setSplits(splits.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const remove = (i: number) => setSplits(splits.filter((_, idx) => idx !== i));
  const add = () => setSplits([...splits, { mode: "other", amount: Math.max(remaining, 0) }]);

  return (
    <div className="space-y-2">
      {splits.map((s, i) => {
        const meta = paymentMeta[s.mode];
        return (
          <div key={i} className="flex gap-2 items-center bg-muted/60 rounded-xl p-2">
            <select
              value={s.mode}
              onChange={(e) => update(i, { mode: e.target.value as PaymentMode })}
              className="bg-card border border-border rounded-lg px-2 py-1.5 text-xs outline-none"
              style={{ fontWeight: 600 }}
            >
              {paymentOrder.map((m) => <option key={m} value={m}>{paymentMeta[m].label}</option>)}
            </select>
            <div className="flex-1 flex items-center gap-1 bg-card rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-muted-foreground">₹</span>
              <input
                inputMode="decimal"
                value={s.amount || ""}
                onChange={(e) => update(i, { amount: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
                placeholder="0"
                className="flex-1 bg-transparent outline-none text-sm min-w-0"
                style={{ fontWeight: 600, color: meta.tint }}
              />
            </div>
            {splits.length > 1 && (
              <button onClick={() => remove(i)} className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-600">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        );
      })}
      <div className="flex justify-between items-center px-1">
        <button onClick={add} className="text-xs text-primary flex items-center gap-1" style={{ fontWeight: 600 }}>
          <Plus className="size-3" /> Add split
        </button>
        <div className={`text-xs ${Math.abs(remaining) < 0.01 ? "text-emerald-600" : "text-amber-600"}`} style={{ fontWeight: 600 }}>
          {Math.abs(remaining) < 0.01
            ? "Balanced ✓"
            : remaining > 0
              ? `₹${remaining.toLocaleString("en-IN")} unallocated`
              : `₹${Math.abs(remaining).toLocaleString("en-IN")} over`}
        </div>
      </div>
    </div>
  );
}
