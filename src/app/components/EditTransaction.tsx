import { useEffect, useState } from "react";
import { X, Loader2, Trash2, Clock, Lock, CreditCard } from "lucide-react";
import { Tx, canEditTx, txEditRemaining, useStore } from "../store";

export function EditTransaction({ tx, onClose }: { tx: Tx | null; onClose: () => void }) {
  const { categories, updateTransaction, deleteTransaction, creditCards } = useStore();
  const cardMap = Object.fromEntries(creditCards.map((c) => [c.id, c]));
  const usedCard = tx?.creditCardId ? cardMap[tx.creditCardId] : null;
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("Food");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!tx) return;
    setAmount(String(Math.abs(tx.amount)));
    setCat(tx.category);
    setMerchant(tx.merchant || "");
    setNotes(tx.notes || "");
    setErr(null);
    setRemaining(txEditRemaining(tx));
  }, [tx]);

  useEffect(() => {
    if (!tx) return;
    const t = setInterval(() => setRemaining(txEditRemaining(tx)), 1000);
    return () => clearInterval(t);
  }, [tx]);

  if (!tx) return null;
  const editable = canEditTx(tx) && remaining > 0;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  const save = async () => {
    if (!editable) return;
    setSaving(true);
    setErr(null);
    const n = Number(amount);
    const result = await updateTransaction({
      ...tx,
      title: merchant || (tx.type === "income" ? "Income" : cat),
      category: tx.type === "income" ? "Income" : cat,
      amount: tx.type === "income" ? n : -n,
      merchant: merchant || undefined,
      notes: notes || undefined,
    });
    setSaving(false);
    if (!result.ok) setErr(result.error || "Could not save");
    else onClose();
  };

  const remove = async () => {
    if (!editable) return;
    setSaving(true);
    const result = await deleteTransaction(tx.id);
    setSaving(false);
    if (!result.ok) setErr(result.error || "Could not delete");
    else onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>{editable ? "Edit transaction" : "Transaction"}</div>
            {editable ? (
              <div className="text-xs text-amber-600 flex items-center gap-1 mt-0.5" style={{ fontWeight: 600 }}>
                <Clock className="size-3" /> {mins}:{secs.toString().padStart(2, "0")} left to edit
              </div>
            ) : (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Lock className="size-3" /> Locked — older than 5 minutes
              </div>
            )}
          </div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center">
            <X className="size-4" />
          </button>
        </div>

        {!editable && (
          <div className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground mb-4">
            For data integrity, transactions can only be edited for 5 minutes after they're added. To correct an older entry, add an offsetting transaction.
          </div>
        )}

        <Field label="Amount (₹)">
          <input disabled={!editable} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none disabled:opacity-60" />
        </Field>

        {tx.type === "expense" && (
          <>
            <Field label="Merchant / shop">
              <input disabled={!editable} value={merchant} onChange={(e) => setMerchant(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none disabled:opacity-60" />
            </Field>

            <Field label="Category">
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button key={c} disabled={!editable} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-xs transition disabled:opacity-50 ${cat === c ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`} style={{ fontWeight: 600 }}>
                    {c}
                  </button>
                ))}
              </div>
            </Field>

            {/* Credit card used — read only */}
            {usedCard && (
              <Field label="Paid with card">
                <div
                  className="flex items-center gap-3 p-3 rounded-xl border"
                  style={{ borderColor: usedCard.color + "40", background: usedCard.color + "08" }}
                >
                  <div
                    className="size-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: usedCard.color + "20" }}
                  >
                    <CreditCard className="size-4" style={{ color: usedCard.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm" style={{ fontWeight: 600 }}>{usedCard.cardName}</div>
                    <div className="text-[11px] text-muted-foreground">{usedCard.bankName} &bull;&bull;&bull;&bull; {usedCard.last4Digits}</div>
                  </div>
                  <Lock className="size-3.5 text-muted-foreground/50" />
                </div>
              </Field>
            )}
          </>
        )}

        <Field label="Notes">
          <textarea disabled={!editable} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none disabled:opacity-60" />
        </Field>

        {err && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2.5 mb-3">{err}</div>}

        {editable && (
          <div className="flex gap-2">
            <button onClick={remove} disabled={saving} className="px-4 rounded-xl bg-rose-50 text-rose-700 text-sm flex items-center gap-1.5" style={{ fontWeight: 600 }}>
              <Trash2 className="size-4" /> Delete
            </button>
            <button onClick={save} disabled={saving || !amount} className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm disabled:opacity-40 flex items-center justify-center gap-2" style={{ fontWeight: 700 }}>
              {saving && <Loader2 className="size-4 animate-spin" />} Save changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}
