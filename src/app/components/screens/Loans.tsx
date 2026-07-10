import { useState } from "react";
import { Plus, ArrowDownLeft, ArrowUpRight, Bell, Check, Trash2, X } from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { Loan, PaymentMode, useStore } from "../../store";

const paymentLabel: Record<PaymentMode, string> = { cash: "Cash", upi: "UPI", credit: "Credit", debit: "Debit", other: "Other" };

export function Loans({ onBack }: { onBack: () => void }) {
  const { loans, addLoan, settleLoan, removeLoan } = useStore();
  const [open, setOpen] = useState(false);

  const active = loans.filter((l) => !l.settled);
  const settled = loans.filter((l) => l.settled);
  const owed = active.filter((l) => l.direction === "borrowed").reduce((s, l) => s + l.amount, 0);
  const owedToYou = active.filter((l) => l.direction === "lent").reduce((s, l) => s + l.amount, 0);

  return (
    <>
      <Header title="Loans & Borrowings" subtitle="Friends & family" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-rose-50 rounded-2xl p-4">
              <div className="text-xs text-rose-700">You owe</div>
              <div className="font-display text-rose-800 mt-1" style={{ fontSize: 20, fontWeight: 700 }}>{inr(owed)}</div>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-4">
              <div className="text-xs text-emerald-700">Owed to you</div>
              <div className="font-display text-emerald-800 mt-1" style={{ fontSize: 20, fontWeight: 700 }}>{inr(owedToYou)}</div>
            </div>
          </div>

          <button onClick={() => setOpen(true)} className="w-full rounded-2xl border-2 border-dashed border-border text-muted-foreground py-3 flex items-center justify-center gap-2 hover:bg-card transition">
            <Plus className="size-4" />
            <span className="text-sm" style={{ fontWeight: 600 }}>Add a loan / borrowing</span>
          </button>

          {active.length > 0 && (
            <Section title="Active">
              {active.map((l) => <LoanRow key={l.id} loan={l} onSettle={() => settleLoan(l.id)} onRemove={() => removeLoan(l.id)} />)}
            </Section>
          )}

          {settled.length > 0 && (
            <Section title="Settled">
              {settled.map((l) => <LoanRow key={l.id} loan={l} onSettle={() => {}} onRemove={() => removeLoan(l.id)} muted />)}
            </Section>
          )}

          {loans.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No loans yet. Track money lent to or borrowed from friends so nothing slips through.
            </div>
          )}
        </div>
      </Screen>

      {open && <AddLoanSheet onClose={() => setOpen(false)} onSave={async (l) => { await addLoan(l); setOpen(false); }} />}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1" style={{ fontWeight: 600 }}>{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function LoanRow({ loan, onSettle, onRemove, muted }: { loan: Loan; onSettle: () => void; onRemove: () => void; muted?: boolean }) {
  const isBorrowed = loan.direction === "borrowed";
  const daysLeft = Math.ceil((new Date(loan.repayBy).getTime() - Date.now()) / 86400000);
  const overdue = !loan.settled && daysLeft < 0;
  const soon = !loan.settled && daysLeft >= 0 && daysLeft <= 2;
  return (
    <div className={`bg-card rounded-2xl p-4 border border-border/60 ${muted ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`size-10 rounded-xl flex items-center justify-center ${isBorrowed ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
          {isBorrowed ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm" style={{ fontWeight: 700 }}>{loan.person}</div>
          <div className="text-xs text-muted-foreground">{paymentLabel[loan.mode]} · taken {loan.takenOn}</div>
        </div>
        <div className="text-right">
          <div className="text-sm" style={{ fontWeight: 700 }}>{inr(loan.amount)}</div>
          {loan.settled ? (
            <div className="text-xs text-muted-foreground">Settled</div>
          ) : overdue ? (
            <div className="text-xs text-rose-600" style={{ fontWeight: 600 }}>Overdue {-daysLeft}d</div>
          ) : (
            <div className={`text-xs ${soon ? "text-amber-600" : "text-muted-foreground"}`} style={{ fontWeight: soon ? 600 : 400 }}>
              Due {loan.repayBy}
            </div>
          )}
        </div>
      </div>
      {loan.notes && <div className="mt-2 text-xs text-muted-foreground pl-13">{loan.notes}</div>}
      {!loan.settled && (
        <div className="mt-3 pt-3 border-t border-border/60 flex gap-2">
          {soon || overdue ? (
            <div className="flex-1 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs flex items-center justify-center gap-1" style={{ fontWeight: 600 }}>
              <Bell className="size-3" /> Reminder set
            </div>
          ) : (
            <div className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs flex items-center justify-center" style={{ fontWeight: 600 }}>
              {daysLeft}d to repay
            </div>
          )}
          <button onClick={onSettle} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs flex items-center gap-1" style={{ fontWeight: 600 }}>
            <Check className="size-3" /> Settle
          </button>
          <button onClick={onRemove} className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function AddLoanSheet({ onClose, onSave }: { onClose: () => void; onSave: (l: Omit<Loan, "id">) => Promise<void> }) {
  const [direction, setDirection] = useState<"borrowed" | "lent">("borrowed");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [repayBy, setRepayBy] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!person || !amount) return;
    setSaving(true);
    await onSave({
      direction,
      person,
      amount: Number(amount),
      mode,
      takenOn: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
      repayBy,
      notes: notes || undefined,
    });
    setSaving(false);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200">
        <div className="flex justify-between items-center mb-4">
          <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>New loan</div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>

        <div className="bg-muted rounded-xl p-1 flex mb-4">
          {[
            { id: "borrowed", label: "I borrowed", icon: ArrowDownLeft },
            { id: "lent", label: "I lent", icon: ArrowUpRight },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setDirection(t.id as any)}
              className={`flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5 transition ${
                direction === t.id ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
              style={{ fontWeight: 600 }}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <Label label="Person">
          <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="e.g. Rahul" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
        </Label>

        <Label label="Amount (₹)">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
        </Label>

        <Label label="Payment mode">
          <div className="grid grid-cols-5 gap-2">
            {(["cash", "upi", "credit", "debit", "other"] as PaymentMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`py-2 rounded-xl text-[10px] border ${mode === m ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-muted text-muted-foreground"}`} style={{ fontWeight: 600 }}>
                {paymentLabel[m]}
              </button>
            ))}
          </div>
        </Label>

        <Label label="Repay by">
          <input type="date" value={repayBy} onChange={(e) => setRepayBy(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
          <div className="text-xs text-muted-foreground mt-1.5">You'll get a reminder 2 days before this date.</div>
        </Label>

        <Label label="Notes (optional)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="What's it for?" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none" />
        </Label>

        <button onClick={submit} disabled={!person || !amount || saving} className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm disabled:opacity-40 mt-2" style={{ fontWeight: 700 }}>
          Save loan
        </button>
      </div>
    </div>
  );
}

function Label({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3.5">
      <div className="text-xs text-muted-foreground mb-1.5" style={{ fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}
