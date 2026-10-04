import { useMemo, useState, useEffect } from "react";
import { todayISO } from "../lib/dateUtils";
import { X, ArrowDownLeft, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Loader2, Plus, Banknote, Smartphone, CreditCard, Wallet, MoreHorizontal, Trash2, Pencil, Mic, Camera, Info, Home, Car, User, GraduationCap, Building2, Check } from "lucide-react";
import { PaymentMode, PaymentSplit, useStore } from "../store";
import { inr } from "./types";
import { CaptureVoiceScan } from "./CaptureVoiceScan";
import { hapticLight } from "../lib/native";
import { feedback } from "../lib/feedback";
import { numberToIndianWords, sanitizeAmountInput, validateTransactionAmount } from "../lib/currencyUtils";

const loanTypeIcons: Record<string, { label: string; icon: any; color: string }> = {
  home_loan:             { label: "Home Loan",            icon: Home,           color: "#1E40AF" },
  car_loan:              { label: "Car Loan",              icon: Car,            color: "#0891B2" },
  personal_loan:         { label: "Personal Loan",         icon: User,           color: "#7C3AED" },
  education_loan:        { label: "Education Loan",        icon: GraduationCap,  color: "#059669" },
  property_registration: { label: "Property Registration", icon: Building2,      color: "#D97706" },
  builder_demand:        { label: "Builder Demand",        icon: Building2,      color: "#DC2626" },
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

export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addTransaction, categories, addCategory, creditCards, structuredLoans, properties } = useStore();
  const [tab, setTab] = useState<"manual" | "voice" | "scan">("manual");
  const [type, setType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("Food");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [loanPaymentType, setLoanPaymentType] = useState<"emi" | "prepayment">("emi");
  const [loanTypeFilter, setLoanTypeFilter] = useState<string>("all");
  const [singleMode, setSingleMode] = useState<PaymentMode>("upi");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [splitOn, setSplitOn] = useState(false);
  const [splits, setSplits] = useState<PaymentSplit[]>([{ mode: "cash", amount: 0 }, { mode: "upi", amount: 0 }]);
  const [newCat, setNewCat] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [saving, setSaving] = useState(false);

  const total = Number(amount || 0);
  const amountValidation = useMemo(() => validateTransactionAmount(total, splitOn ? undefined : singleMode), [total, splitOn, singleMode]);
  const splitTotal = useMemo(() => splits.reduce((s, p) => s + (Number(p.amount) || 0), 0), [splits]);
  const splitOk = !splitOn || (total > 0 && Math.abs(splitTotal - total) < 0.01);

  // Auto-select first card when switching to Credit mode (if none selected)
  const handleSetSingleMode = (m: PaymentMode) => {
    setSingleMode(m);
    if (m === "credit" && creditCards.length > 0 && !selectedCardId) {
      setSelectedCardId(creditCards[0].id);
    }
    if (m !== "credit") setSelectedCardId(null);
  };

  // Auto-select first card when creditCards list loads and credit mode is active
  useEffect(() => {
    if (singleMode === "credit" && creditCards.length > 0 && !selectedCardId) {
      setSelectedCardId(creditCards[0].id);
    }
  }, [creditCards, singleMode]);

  const reset = () => {
    setAmount(""); setMerchant(""); setNotes("");
    setSplitOn(false); setSplits([{ mode: "cash", amount: 0 }, { mode: "upi", amount: 0 }]);
    setNewCat(""); setShowNewCat(false);
    setSelectedCardId(null);
    setSelectedLoanId(null);
    setLoanPaymentType("emi");
    setLoanTypeFilter("all");
  };

  const save = async () => {
    if (saving) return;
    if (!amount || !splitOk || !amountValidation.valid) {
      feedback({
        kind: "error",
        title: !amount ? "Enter an amount" : !splitOk ? "Split doesn't add up" : "Check the amount",
        subtitle: !amount ? "Type how much you spent or received" : !splitOk ? "Payment split must equal the total" : undefined,
      });
      return;
    }
    setSaving(true);
    const isIncome = type === "income";
    const payments: PaymentSplit[] = isIncome
      ? []
      : splitOn
        ? splits.filter((s) => s.amount > 0)
        : [{ mode: singleMode, amount: total }];

    const linkedLoan = selectedLoanId ? structuredLoans.find((l) => l.id === selectedLoanId) : null;
    const defaultTitle = isIncome
      ? "Income"
      : linkedLoan
      ? `${linkedLoan.lenderName} ${loanPaymentType === "prepayment" ? "Prepayment" : "EMI"}`
      : cat;

    // Fire save — optimistic, so this resolves immediately in memory
    addTransaction({
      title: (merchant || defaultTitle).trim(),
      category: isIncome ? "Income" : cat,
      amount: isIncome ? total : -total,
      type: isIncome ? "income" : "expense",
      date: todayISO(),
      merchant: merchant ? merchant.trim() : undefined,
      payments: payments.length ? payments : undefined,
      creditCardId: (!isIncome && !splitOn && singleMode === "credit" && selectedCardId) ? selectedCardId : undefined,
      loanId: (!isIncome && (cat === "EMI" || selectedLoanId)) ? (selectedLoanId || undefined) : undefined,
      loanPaymentType: (!isIncome && selectedLoanId) ? loanPaymentType : undefined,
      notes: notes ? notes.trim() : undefined,
    }).catch(() => {}); // errors handled in store

    // Tone + haptic + animated confirmation are fired by the store (feedback.ts)
    reset();
    setSaving(false);
    onClose(); // saved on-device instantly — no server round-trip
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
            { id: "expense", label: "Expense", icon: ArrowUpRight },
            { id: "income", label: "Income", icon: ArrowDownLeft },
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

        <div className="bg-muted/60 rounded-2xl p-4 text-center mb-4 overflow-hidden">
          <div className="text-xs text-muted-foreground mb-1 font-semibold">Amount</div>
          <div className="flex items-center justify-center gap-1.5 max-w-full px-2">
            <span className="font-display text-muted-foreground text-2xl font-bold">₹</span>
            <input
              autoFocus
              inputMode="decimal"
              maxLength={12}
              value={amount}
              onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
              placeholder="0"
              className="bg-transparent outline-none text-center font-display font-bold w-full max-w-[260px] tracking-tight text-foreground"
              style={{ fontSize: amount.length > 7 ? 22 : amount.length > 5 ? 26 : 32, fontWeight: 700 }}
            />
          </div>

          {/* Live Indian Numbering Words Preview like CRED & PhonePe */}
          {total > 0 && (
            <div className="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50/90 border border-emerald-200/70 rounded-xl px-3 py-1 inline-block max-w-full truncate animate-in fade-in duration-150">
              {numberToIndianWords(total)}
            </div>
          )}

          {/* IT Act Sec 269ST Cash Warning / High Value Warning */}
          {amountValidation.warning && (
            <div className="mt-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl p-2 text-center font-medium leading-tight">
              {amountValidation.warning}
            </div>
          )}

          {/* Regulatory Limit Error (Retail Cap) */}
          {amountValidation.error && Boolean(amount) && (
            <div className="mt-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2 text-center font-medium leading-tight">
              {amountValidation.error}
            </div>
          )}
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

            {/* Loan / EMI selector when category is EMI or loan is selected */}
            {cat === "EMI" && (
              <Field
                label="Select Loan / EMI"
                rightSlot={
                  selectedLoanId ? (
                    <button
                      type="button"
                      onClick={() => setSelectedLoanId(null)}
                      className="text-xs text-rose-500 font-semibold hover:underline"
                    >
                      Clear
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
                    {/* Filter tabs if user has multiple types of loans */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      <button
                        type="button"
                        onClick={() => setLoanTypeFilter("all")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                          loanTypeFilter === "all" ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        All ({structuredLoans.length})
                      </button>
                      {structuredLoans.some((l) => l.loanType === "home_loan") && (
                        <button
                          type="button"
                          onClick={() => setLoanTypeFilter("home_loan")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                            loanTypeFilter === "home_loan" ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Home className="size-3" /> Home Loans
                        </button>
                      )}
                      {structuredLoans.some((l) => l.loanType === "car_loan") && (
                        <button
                          type="button"
                          onClick={() => setLoanTypeFilter("car_loan")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                            loanTypeFilter === "car_loan" ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Car className="size-3" /> Car Loans
                        </button>
                      )}
                      {structuredLoans.some((l) => l.loanType !== "home_loan" && l.loanType !== "car_loan") && (
                        <button
                          type="button"
                          onClick={() => setLoanTypeFilter("other")}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                            loanTypeFilter === "other" ? "bg-primary text-primary-foreground shadow-xs" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          Other
                        </button>
                      )}
                    </div>

                    {/* List of loans */}
                    <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                      {structuredLoans
                        .filter((loan) => {
                          if (loanTypeFilter === "all") return true;
                          if (loanTypeFilter === "other") return loan.loanType !== "home_loan" && loan.loanType !== "car_loan";
                          return loan.loanType === loanTypeFilter;
                        })
                        .map((loan) => {
                          const isSelected = selectedLoanId === loan.id;
                          const cfg = loanTypeIcons[loan.loanType] || loanTypeIcons.other;
                          const Icon = cfg.icon;
                          const linkedProp = properties.find((p) => p.id === loan.linkedPropertyId);

                          return (
                            <button
                              key={loan.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedLoanId(null);
                                } else {
                                  setSelectedLoanId(loan.id);
                                  if (!amount) setAmount(String(loan.emiAmount));
                                  if (!merchant) setMerchant(loan.lenderName);
                                }
                              }}
                              className={`p-3 rounded-2xl border text-left transition flex items-start justify-between gap-3 ${
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

                                  {/* If Home Loan has linked property, show it! */}
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
                                <span className="text-[10px] text-muted-foreground">
                                  Due {loan.nextEmiDueDate?.slice(8, 10) || "monthly"}
                                </span>
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
                            onClick={() => setLoanPaymentType("emi")}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                              loanPaymentType === "emi"
                                ? "bg-primary text-primary-foreground shadow-xs"
                                : "bg-card text-foreground border border-border/60"
                            }`}
                          >
                            Regular EMI
                          </button>
                          <button
                            type="button"
                            onClick={() => setLoanPaymentType("prepayment")}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
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
                  <>
                    {/* Payment mode buttons */}
                    <div className="grid grid-cols-5 gap-2">
                      {paymentOrder.map((m) => {
                        const meta = paymentMeta[m];
                        const active = singleMode === m;
                        return (
                          <button
                            key={m}
                            onClick={() => handleSetSingleMode(m)}
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

                    {/* Credit card selector — appears when Credit mode is active */}
                    {singleMode === "credit" && (
                      <div className="mt-3">
                        {creditCards.length === 0 ? (
                          /* ── No cards saved: guide user to Profile ── */
                          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-violet-50 border border-violet-100">
                            <Info className="size-4 text-violet-500 shrink-0 mt-0.5" />
                            <div>
                              <div className="text-xs text-violet-800" style={{ fontWeight: 600 }}>No credit cards added yet</div>
                              <div className="text-[11px] text-violet-600 mt-0.5 leading-relaxed">
                                Go to <span style={{ fontWeight: 700 }}>Profile → Loans & Borrowings → Cards</span> to add your cards once — then select them here whenever you pay by credit.
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* ── Card selector ── */
                          <>
                            <div className="text-[10px] text-muted-foreground mb-2" style={{ fontWeight: 600 }}>WHICH CARD DID YOU USE?</div>
                            <div className="flex flex-col gap-2">
                              {creditCards.map((card) => {
                                const isSelected = selectedCardId === card.id;
                                return (
                                  <button
                                    key={card.id}
                                    onClick={() => setSelectedCardId(isSelected ? null : card.id)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                                      isSelected
                                        ? "border-violet-400 bg-violet-50"
                                        : "border-border bg-muted/40 hover:bg-muted/60"
                                    }`}
                                  >
                                    <div
                                      className="size-9 rounded-lg flex items-center justify-center shrink-0"
                                      style={{ background: card.color + "20" }}
                                    >
                                      <CreditCard className="size-4" style={{ color: card.color }} />
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                      <div className="text-sm truncate" style={{ fontWeight: 600 }}>{card.cardName}</div>
                                      <div className="text-[11px] text-muted-foreground">{card.bankName} &bull;&bull;&bull;&bull; {card.last4Digits}</div>
                                    </div>
                                    <div className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${isSelected ? "border-violet-500 bg-violet-500" : "border-border"}`}>
                                      {isSelected && <div className="size-2 rounded-full bg-white" />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
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
          disabled={saving}
          className={`w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm disabled:opacity-40 ${!amount || !splitOk || !amountValidation.valid ? "opacity-50" : ""} flex items-center justify-center gap-2 mt-1 active:scale-[0.97] transition-transform duration-150`}
          style={{ fontWeight: 700 }}
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {type === "income" ? "Save income" : type === "transfer" ? "Save transfer" : "Save expense"}
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
