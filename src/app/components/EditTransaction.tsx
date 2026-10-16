import { useEffect, useState } from "react";
import { X, Loader2, Trash2, Clock, Lock, Unlock, CreditCard, AlertTriangle, Banknote, Smartphone, Wallet, MoreHorizontal, Check, Home, Car, User, GraduationCap, Building2 } from "lucide-react";
import { Tx, PaymentMode, PaymentSplit, canEditTx, txEditRemaining, useStore } from "../store";
import { inr } from "./types";
import { TAX_TAGS, TaxTag } from "../lib/taxTags";
import { usePersona } from "../lib/usePersona";
import { numberToIndianWords, sanitizeAmountInput, validateTransactionAmount } from "../lib/currencyUtils";

const loanTypeIcons: Record<string, { label: string; icon: any; color: string }> = {
  home_loan:             { label: "Home Loan",            icon: Home,           color: "#1E40AF" },
  car_loan:              { label: "Car Loan",              icon: Car,            color: "#0891B2" },
  personal_loan:         { label: "Personal Loan",         icon: User,           color: "#7C3AED" },
  education_loan:        { label: "Education Loan",        icon: GraduationCap,  color: "#059669" },
  property_registration: { label: "Property Registration", icon: Building2,      color: "#D97706" },
  builder_demand:        { label: "Builder Demand",        icon: Building2,      color: "#DC2626" },
  bnpl:                  { label: "BNPL / Pay-later",      icon: CreditCard,     color: "#BE185D" },
  other:                 { label: "Other Loan",            icon: CreditCard,     color: "#64748B" },
};

const paymentMeta: Record<PaymentMode, { label: string; icon: any; tint: string }> = {
  cash:   { label: "Cash",   icon: Banknote,         tint: "#10B981" },
  upi:    { label: "UPI",    icon: Smartphone,       tint: "#1E40AF" },
  credit: { label: "Credit", icon: CreditCard,       tint: "#8B5CF6" },
  debit:  { label: "Debit",  icon: Wallet,           tint: "#F59E0B" },
  other:  { label: "Other",  icon: MoreHorizontal,   tint: "#64748B" },
};
const paymentOrder: PaymentMode[] = ["cash", "upi", "credit", "debit", "other"];

export function EditTransaction({ tx, onClose }: { tx: Tx | null; onClose: () => void }) {
  const { categories, updateTransaction, deleteTransaction, creditCards, structuredLoans, properties } = useStore();
  const cardMap = Object.fromEntries(creditCards.map((c) => [c.id, c]));
  const loanMap = Object.fromEntries(structuredLoans.map((l) => [l.id, l]));
  const propMap = Object.fromEntries(properties.map((p) => [p.id, p]));

  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("Food");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [taxTag, setTaxTag] = useState<TaxTag | undefined>(undefined);
  const [scope, setScope] = useState<"personal" | "business" | undefined>(undefined);
  const { persona } = usePersona();
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("upi");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [loanPaymentType, setLoanPaymentType] = useState<"emi" | "prepayment">("emi");
  const [loanTypeFilter, setLoanTypeFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!tx) return;
    setAmount(String(Math.abs(tx.amount)));
    setCat(tx.category);
    setMerchant(tx.merchant || "");
    setNotes(tx.notes || "");
    setTaxTag(tx.taxTag);
    setScope(tx.scope);
    setErr(null);
    setUnlocked(false);
    setConfirmDelete(false);
    setRemaining(txEditRemaining(tx));

    const initialMode: PaymentMode =
      tx.payments && tx.payments.length > 0 && tx.payments[0].mode
        ? tx.payments[0].mode
        : tx.creditCardId
        ? "credit"
        : "upi";
    setPaymentMode(initialMode);
    setSelectedCardId(tx.creditCardId || (initialMode === "credit" && creditCards.length > 0 ? creditCards[0].id : null));
    setSelectedLoanId(tx.loanId || null);
    setLoanPaymentType(tx.loanPaymentType || "emi");
  }, [tx, creditCards]);

  useEffect(() => {
    if (!tx) return;
    const t = setInterval(() => setRemaining(txEditRemaining(tx)), 1000);
    return () => clearInterval(t);
  }, [tx]);

  if (!tx) return null;
  const isWithin5Min = canEditTx(tx) && remaining > 0;
  const editable = isWithin5Min || unlocked;
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);

  const handleSetPaymentMode = (m: PaymentMode) => {
    if (!editable) return;
    setPaymentMode(m);
    if (m === "credit" && creditCards.length > 0 && !selectedCardId) {
      setSelectedCardId(creditCards[0].id);
    }
    if (m !== "credit") {
      setSelectedCardId(null);
    }
  };

  const save = async () => {
    if (!editable) return;
    setSaving(true);
    setErr(null);
    const n = Number(amount);
    const validation = validateTransactionAmount(n);
    if (!validation.valid) {
      setErr(validation.error || "Please enter a valid amount");
      setSaving(false);
      return;
    }

    const isIncome = tx.type === "income";
    const payments: PaymentSplit[] = isIncome
      ? []
      : [{ mode: paymentMode, amount: n }];

    const linkedLoan = selectedLoanId ? loanMap[selectedLoanId] : null;
    const defaultTitle = isIncome
      ? "Income"
      : linkedLoan
      ? `${linkedLoan.lenderName} ${loanPaymentType === "prepayment" ? "Prepayment" : "EMI"}`
      : cat;

    const result = await updateTransaction({
      ...tx,
      title: merchant || defaultTitle,
      category: isIncome ? "Income" : cat,
      amount: isIncome ? n : -n,
      merchant: merchant || undefined,
      notes: notes || undefined,
      taxTag,
      scope,
      creditCardId: !isIncome && paymentMode === "credit" && selectedCardId ? selectedCardId : undefined,
      loanId: !isIncome && (cat === "EMI" || selectedLoanId) ? (selectedLoanId || undefined) : undefined,
      loanPaymentType: !isIncome && selectedLoanId ? loanPaymentType : undefined,
      payments: payments.length ? payments : undefined,
    });
    setSaving(false);
    if (!result.ok) setErr(result.error || "Could not save");
    else onClose();
  };

  const remove = async () => {
    setSaving(true);
    setErr(null);
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
            <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>
              {editable ? "Edit transaction" : "Transaction Details"}
            </div>
            {isWithin5Min ? (
              <div className="text-xs text-amber-600 flex items-center gap-1 mt-0.5" style={{ fontWeight: 600 }}>
                <Clock className="size-3" /> {mins}:{secs.toString().padStart(2, "0")} left in quick-edit window
              </div>
            ) : unlocked ? (
              <div className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5" style={{ fontWeight: 600 }}>
                <Unlock className="size-3" /> Unlocked for correction
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

        {/* Audit lock notice with unlock action */}
        {!isWithin5Min && !unlocked && (
          <div className="rounded-2xl bg-amber-50/80 border border-amber-200/80 p-3.5 text-xs text-amber-900 mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <Lock className="size-3.5" /> Audit Integrity Lock
              </div>
              <div className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                This transaction was logged over 5 minutes ago. You can unlock it to correct typos, adjust amounts, or change payment card.
              </div>
            </div>
            <button
              onClick={() => setUnlocked(true)}
              className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-3 py-1.5 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Unlock className="size-3" /> Unlock
            </button>
          </div>
        )}

        {/* Delete Confirmation Alert */}
        {confirmDelete && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 mb-4 text-rose-900 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
              <AlertTriangle className="size-4 text-rose-600" />
              Delete this transaction?
            </div>
            <div className="text-xs text-rose-700 mt-1.5 leading-relaxed">
              Are you sure you want to remove <strong>{tx.merchant || tx.title || tx.category}</strong> ({inr(Math.abs(tx.amount))})? This action cannot be undone.
            </div>
            <div className="flex gap-2 mt-3.5">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={saving}
                className="flex-1 bg-card border border-border text-foreground rounded-xl py-2 text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={remove}
                disabled={saving}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                Confirm Delete
              </button>
            </div>
          </div>
        )}

        {/* Prominent Linked Card Banner */}
        {selectedCardId && cardMap[selectedCardId] && (
          <div
            className="rounded-2xl p-3.5 mb-4 border flex items-center justify-between gap-3 shadow-xs animate-in fade-in"
            style={{
              backgroundColor: `${cardMap[selectedCardId].color || "#4338CA"}10`,
              borderColor: `${cardMap[selectedCardId].color || "#4338CA"}30`,
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="size-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                style={{
                  backgroundColor: cardMap[selectedCardId].color || "#4338CA",
                  color: "#FFFFFF",
                }}
              >
                <CreditCard className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: cardMap[selectedCardId].color || "#4338CA" }}>
                  Paid with Credit Card
                </div>
                <div className="text-sm font-bold text-foreground truncate">
                  {cardMap[selectedCardId].bankName} {cardMap[selectedCardId].cardName}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  •••• {cardMap[selectedCardId].last4Digits}
                  {cardMap[selectedCardId].creditLimit ? ` · Limit ${inr(cardMap[selectedCardId].creditLimit)}` : ""}
                </div>
              </div>
            </div>
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase shrink-0"
              style={{
                backgroundColor: `${cardMap[selectedCardId].color || "#4338CA"}25`,
                color: cardMap[selectedCardId].color || "#4338CA",
              }}
            >
              Linked
            </span>
          </div>
        )}

        {/* Prominent Linked Loan Banner */}
        {selectedLoanId && loanMap[selectedLoanId] && (
          <div
            className="rounded-2xl p-3.5 mb-4 border flex items-center justify-between gap-3 shadow-xs animate-in fade-in"
            style={{
              backgroundColor: `${(loanTypeIcons[loanMap[selectedLoanId].loanType] || loanTypeIcons.other).color}10`,
              borderColor: `${(loanTypeIcons[loanMap[selectedLoanId].loanType] || loanTypeIcons.other).color}30`,
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="size-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs text-white"
                style={{
                  backgroundColor: (loanTypeIcons[loanMap[selectedLoanId].loanType] || loanTypeIcons.other).color,
                }}
              >
                {(() => {
                  const Icon = (loanTypeIcons[loanMap[selectedLoanId].loanType] || loanTypeIcons.other).icon;
                  return <Icon className="size-5" />;
                })()}
              </div>
              <div className="min-w-0">
                <div
                  className="text-[10px] uppercase font-extrabold tracking-wider"
                  style={{ color: (loanTypeIcons[loanMap[selectedLoanId].loanType] || loanTypeIcons.other).color }}
                >
                  {loanPaymentType === "prepayment" ? "Loan Pre-payment" : "Home / EMI Loan Payment"}
                </div>
                <div className="text-sm font-bold text-foreground truncate">
                  {loanMap[selectedLoanId].lenderName}
                </div>
                {loanMap[selectedLoanId].linkedPropertyId && propMap[loanMap[selectedLoanId].linkedPropertyId!] && (
                  <div className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1 mt-0.5 truncate">
                    <Building2 className="size-3 shrink-0" />
                    <span>{propMap[loanMap[selectedLoanId].linkedPropertyId!].name}</span>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  EMI: {inr(loanMap[selectedLoanId].emiAmount)}/mo · {loanMap[selectedLoanId].interestRatePA}% p.a.
                </div>
              </div>
            </div>
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase shrink-0"
              style={{
                backgroundColor: `${(loanTypeIcons[loanMap[selectedLoanId].loanType] || loanTypeIcons.other).color}25`,
                color: (loanTypeIcons[loanMap[selectedLoanId].loanType] || loanTypeIcons.other).color,
              }}
            >
              Linked
            </span>
          </div>
        )}

        <Field label="Amount (₹)">
          <input
            disabled={!editable}
            inputMode="decimal"
            maxLength={12}
            value={amount}
            onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
            className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none disabled:opacity-60 font-mono font-bold"
          />
          {Number(amount) > 0 && (
            <div className="mt-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 rounded-lg px-2.5 py-1 inline-block max-w-full truncate">
              {numberToIndianWords(Number(amount))}
            </div>
          )}
        </Field>

        {tx.type === "expense" && (
          <>
            <Field label="Merchant / shop">
              <input
                disabled={!editable}
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="e.g. Swiggy, Amazon, Starbucks"
                className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none disabled:opacity-60"
              />
            </Field>

            <Field label="Category">
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c}
                    disabled={!editable}
                    onClick={() => setCat(c)}
                    className={`px-3 py-1.5 rounded-full text-xs transition disabled:opacity-50 ${
                      cat === c ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                    style={{ fontWeight: 600 }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Field>

            {/* Loan / EMI selector when category is EMI or loan is selected */}
            {(cat === "EMI" || selectedLoanId) && (
              <Field
                label="Linked Loan / EMI"
                rightSlot={
                  selectedLoanId && editable ? (
                    <button
                      type="button"
                      onClick={() => setSelectedLoanId(null)}
                      className="text-xs text-rose-500 font-semibold hover:underline"
                    >
                      Unlink
                    </button>
                  ) : null
                }
              >
                {structuredLoans.length === 0 ? (
                  <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/70 text-xs text-amber-900 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <Home className="size-4 text-amber-600" /> No loans added yet
                    </div>
                    <div className="text-[11px] text-amber-700 leading-relaxed">
                      Track your Home Loan, Car Loan, or other EMIs by adding them in the <strong>Loans &amp; EMI Tracker</strong>.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* List of loans */}
                    <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                      {structuredLoans.map((loan) => {
                        const isSelected = selectedLoanId === loan.id;
                        const cfg = loanTypeIcons[loan.loanType] || loanTypeIcons.other;
                        const Icon = cfg.icon;
                        const linkedProp = properties.find((p) => p.id === loan.linkedPropertyId);

                        return (
                          <button
                            key={loan.id}
                            type="button"
                            disabled={!editable}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedLoanId(null);
                              } else {
                                setSelectedLoanId(loan.id);
                                if (!merchant) setMerchant(loan.lenderName);
                              }
                            }}
                            className={`p-3 rounded-2xl border text-left transition disabled:opacity-60 flex items-start justify-between gap-3 ${
                              isSelected
                                ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary"
                                : "border-border/70 bg-card hover:bg-muted/40"
                            }`}
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className="size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                                style={{ backgroundColor: `${cfg.color}18`, color: cfg.color }}
                              >
                                <Icon className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-foreground truncate">
                                    {loan.lenderName}
                                  </span>
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground">
                                    {cfg.label}
                                  </span>
                                </div>

                                {linkedProp && (
                                  <div className="text-[11px] font-semibold text-indigo-600 flex items-center gap-1 mt-0.5 truncate">
                                    <Building2 className="size-3 shrink-0" />
                                    <span>{linkedProp.name}</span>
                                  </div>
                                )}

                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                  EMI: <strong className="text-foreground">{inr(loan.emiAmount)}/mo</strong> · {loan.interestRatePA}% p.a.
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <div
                                className={`size-5 rounded-full border-2 flex items-center justify-center transition ${
                                  isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                                }`}
                              >
                                {isSelected && <Check className="size-3 stroke-[3]" />}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Payment type selector if loan is selected */}
                    {selectedLoanId && (
                      <div className="bg-muted/50 rounded-xl p-2.5 flex items-center justify-between gap-2 border border-border/50">
                        <div className="text-xs font-semibold text-muted-foreground">Payment Type:</div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => setLoanPaymentType("emi")}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition disabled:opacity-50 ${
                              loanPaymentType === "emi"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "bg-card text-foreground border border-border/60"
                            }`}
                          >
                            Regular EMI
                          </button>
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => setLoanPaymentType("prepayment")}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition disabled:opacity-50 ${
                              loanPaymentType === "prepayment"
                                ? "bg-amber-600 text-white shadow-xs"
                                : "bg-card text-foreground border border-border/60"
                            }`}
                          >
                            Part Pre-payment
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Field>
            )}

            {/* Payment mode & Card Link */}
            <Field label="Payment mode">
              <div className="grid grid-cols-5 gap-2">
                {paymentOrder.map((m) => {
                  const meta = paymentMeta[m];
                  const active = paymentMode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={!editable}
                      onClick={() => handleSetPaymentMode(m)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] transition border disabled:opacity-50 ${
                        active
                          ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                          : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted font-medium"
                      }`}
                    >
                      <meta.icon className="size-4" style={{ color: active ? meta.tint : undefined }} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              {/* Credit card selection when paymentMode is 'credit' */}
              {paymentMode === "credit" && (
                <div className="mt-3 space-y-2">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    Paid with Credit Card
                  </div>
                  {creditCards.length === 0 ? (
                    <div className="p-3 rounded-xl bg-violet-50/80 border border-violet-100 text-xs text-violet-800">
                      No credit cards added yet. Add cards in Card Desk to track spend and limits.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {creditCards.map((card) => {
                        const isSelected = selectedCardId === card.id;
                        return (
                          <button
                            key={card.id}
                            type="button"
                            disabled={!editable}
                            onClick={() => setSelectedCardId(isSelected ? null : card.id)}
                            className={`flex items-center gap-3 p-3 rounded-xl border text-left transition disabled:opacity-60 ${
                              isSelected
                                ? "border-indigo-500 bg-indigo-50/60 shadow-sm ring-1 ring-indigo-500"
                                : "border-border/70 bg-muted/30 hover:bg-muted/60"
                            }`}
                          >
                            <div
                              className="size-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: (card.color || "#4338CA") + "20" }}
                            >
                              <CreditCard className="size-4" style={{ color: card.color || "#4338CA" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-foreground truncate">
                                {card.bankName} {card.cardName}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                &bull;&bull;&bull;&bull; {card.last4Digits || "0000"}
                                {card.creditLimit ? ` · Limit: ${inr(card.creditLimit)}` : ""}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="size-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                <Check className="size-3 stroke-[3]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </Field>
          </>
        )}

        {persona === "business" && (
          <Field label="Business or personal">
            <div className="flex bg-muted rounded-xl p-1 text-xs font-bold">
              {(["personal", "business"] as const).map((sc) => (
                <button key={sc} type="button" disabled={!editable} onClick={() => setScope(sc)} className={`flex-1 py-2 rounded-lg capitalize disabled:opacity-50 ${(scope ?? "personal") === sc ? "bg-card shadow-sm" : "text-muted-foreground"}`}>{sc}</button>
              ))}
            </div>
          </Field>
        )}

        <Field label="Tax tag (optional)">
          <div className="flex flex-wrap gap-1.5">
            {TAX_TAGS.map((t) => (
              <button key={t.id} type="button" disabled={!editable} title={t.hint} onClick={() => setTaxTag(taxTag === t.id ? undefined : t.id)}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold disabled:opacity-50 ${taxTag === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{t.label}</button>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Marks this entry for year-end tax totals in CA Lens.</div>
        </Field>

        <Field label="Notes">
          <textarea
            disabled={!editable}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none disabled:opacity-60"
          />
        </Field>

        {err && <div className="text-xs text-rose-600 bg-rose-50 rounded-lg p-2.5 mb-3">{err}</div>}

        {/* Action Buttons: Always allow deletion (with confirmation) and saving when editable */}
        {!confirmDelete && (
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={saving}
              className="px-4 py-3 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-sm flex items-center gap-1.5 transition-colors"
              style={{ fontWeight: 600 }}
            >
              <Trash2 className="size-4" /> Delete
            </button>

            {editable ? (
              <button
                onClick={save}
                disabled={saving || !amount}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm disabled:opacity-40 flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
                style={{ fontWeight: 700 }}
              >
                {saving && <Loader2 className="size-4 animate-spin" />} Save changes
              </button>
            ) : (
              <button
                onClick={() => setUnlocked(true)}
                className="flex-1 bg-muted border border-border text-foreground rounded-xl py-3 text-sm flex items-center justify-center gap-2 hover:bg-muted/80 transition-colors"
                style={{ fontWeight: 600 }}
              >
                <Unlock className="size-4 text-muted-foreground" /> Unlock to edit
              </button>
            )}
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
