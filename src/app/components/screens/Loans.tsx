import { useState, useMemo } from "react";
import { Plus, ArrowDownLeft, ArrowUpRight, Bell, Check, Trash2, X, Building2, Car, GraduationCap, User, Home, CreditCard, ChevronDown, ChevronUp, AlertTriangle, Calendar, Palette } from "lucide-react";
import { Header, Screen } from "../Shell";
import { inr } from "../types";
import { Loan, PaymentMode, StructuredLoan, StructuredLoanType, BuilderMilestone, CreditCard as CreditCardData, useStore } from "../../store";

const paymentLabel: Record<PaymentMode, string> = { cash: "Cash", upi: "UPI", credit: "Credit", debit: "Debit", other: "Other" };

const loanTypeConfig: Record<StructuredLoanType, { label: string; icon: typeof Home; color: string }> = {
  home_loan:             { label: "Home Loan",            icon: Home,           color: "#1E40AF" },
  car_loan:              { label: "Car Loan",              icon: Car,            color: "#0891B2" },
  personal_loan:         { label: "Personal Loan",         icon: User,           color: "#7C3AED" },
  education_loan:        { label: "Education Loan",        icon: GraduationCap,  color: "#059669" },
  property_registration: { label: "Property Registration", icon: Building2,      color: "#D97706" },
  builder_demand:        { label: "Builder Demand",        icon: Building2,      color: "#DC2626" },
  other:                 { label: "Other Loan",            icon: CreditCard,     color: "#64748B" },
};

/** Calculates monthly EMI using standard amortization formula: P*r*(1+r)^n / ((1+r)^n - 1) */
function calcEmi(principal: number, ratePA: number, tenureMonths: number): number {
  if (ratePA === 0) return principal / tenureMonths;
  const r = ratePA / 12 / 100;
  return Math.round(principal * r * Math.pow(1 + r, tenureMonths) / (Math.pow(1 + r, tenureMonths) - 1));
}

/** Total interest payable over the full loan tenure */
function totalInterest(emi: number, tenureMonths: number, principal: number): number {
  return Math.max(0, emi * tenureMonths - principal);
}

/** Outstanding principal based on EMIs paid (flat approximation) */
function outstandingPrincipal(principal: number, ratePA: number, tenureMonths: number, emisPaid: number): number {
  if (ratePA === 0) return principal - (principal / tenureMonths) * emisPaid;
  const r = ratePA / 12 / 100;
  const outstanding = principal * Math.pow(1 + r, emisPaid) - (calcEmi(principal, ratePA, tenureMonths) * (Math.pow(1 + r, emisPaid) - 1)) / r;
  return Math.max(0, Math.round(outstanding));
}

/** Annual interest paid (FY) — approximate for ITR u/s 24(b) */
function annualInterestPaid(emi: number, principal: number, emisPaid: number, tenureMonths: number, ratePA: number): number {
  const totalPaid = emi * Math.min(emisPaid, tenureMonths);
  const principalRepaid = principal - outstandingPrincipal(principal, ratePA, tenureMonths, emisPaid);
  return Math.max(0, totalPaid - principalRepaid);
}

export function Loans({ onBack }: { onBack: () => void }) {
  const { loans, addLoan, settleLoan, removeLoan, structuredLoans, addStructuredLoan, updateStructuredLoan, removeStructuredLoan, properties, creditCards, addCreditCard, removeCreditCard } = useStore();
  const [tab, setTab] = useState<"structured" | "personal" | "cards">("structured");
  const [openAdd, setOpenAdd] = useState(false);
  const [openPersonal, setOpenPersonal] = useState(false);
  const [openAddCard, setOpenAddCard] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activePersonal = loans.filter((l) => !l.settled);
  const settledPersonal = loans.filter((l) => l.settled);
  const owed = activePersonal.filter((l) => l.direction === "borrowed").reduce((s, l) => s + l.amount, 0);
  const owedToYou = activePersonal.filter((l) => l.direction === "lent").reduce((s, l) => s + l.amount, 0);

  const totalOutstanding = structuredLoans.filter(l => !l.closed).reduce((s, l) => {
    return s + outstandingPrincipal(l.principalAmount, l.interestRatePA, l.tenureMonths, l.emisPaid);
  }, 0);

  const totalEmiMonthly = structuredLoans.filter(l => !l.closed).reduce((s, l) => s + l.emiAmount, 0);

  return (
    <>
      <Header title="Loans & EMI Tracker" subtitle="Expert loan intelligence" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4 pb-24">

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-2xl p-4 shadow-md shadow-rose-500/20">
              <div className="text-xs font-semibold text-rose-100">Total Outstanding</div>
              <div className="font-display text-xl font-black mt-1">{inr(totalOutstanding)}</div>
              <div className="text-[11px] text-rose-100 mt-1">{structuredLoans.filter(l => !l.closed).length} active loans</div>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-4 shadow-md shadow-amber-500/20">
              <div className="text-xs font-semibold text-amber-100">Monthly EMI Load</div>
              <div className="font-display text-xl font-black mt-1">{inr(totalEmiMonthly)}</div>
              <div className="text-[11px] text-amber-100 mt-1">across all loans</div>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="bg-muted rounded-xl p-1 flex">
            <button onClick={() => setTab("structured")} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${tab === "structured" ? "bg-card shadow-sm text-slate-900" : "text-muted-foreground"}`}>
              EMI Loans
            </button>
            <button onClick={() => setTab("personal")} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${tab === "personal" ? "bg-card shadow-sm text-slate-900" : "text-muted-foreground"}`}>
              Personal
            </button>
            <button onClick={() => setTab("cards")} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${tab === "cards" ? "bg-card shadow-sm text-slate-900" : "text-muted-foreground"}`}>
              Cards
            </button>
          </div>

          {/* === STRUCTURED LOANS TAB === */}
          {tab === "structured" && (
            <>
              <button onClick={() => setOpenAdd(true)} className="w-full rounded-2xl border-2 border-dashed border-border text-muted-foreground py-3.5 flex items-center justify-center gap-2 hover:bg-card hover:border-primary/50 transition">
                <Plus className="size-4" />
                <span className="text-sm font-semibold">Add EMI Loan / Property Loan</span>
              </button>

              {structuredLoans.length === 0 && (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  Add your home loan, car loan, or property registration fee to track EMIs, interest, and amortization.
                </div>
              )}

              <div className="space-y-3">
                {structuredLoans.map(loan => (
                  <StructuredLoanCard
                    key={loan.id}
                    loan={loan}
                    properties={properties}
                    expanded={expandedId === loan.id}
                    onToggle={() => setExpandedId(expandedId === loan.id ? null : loan.id)}
                    onPayEmi={() => {
                      const updated: StructuredLoan = {
                        ...loan,
                        emisPaid: Math.min(loan.emisPaid + 1, loan.totalEmis),
                        outstandingPrincipal: outstandingPrincipal(loan.principalAmount, loan.interestRatePA, loan.tenureMonths, loan.emisPaid + 1),
                        nextEmiDueDate: (() => {
                          const d = new Date(loan.nextEmiDueDate);
                          d.setMonth(d.getMonth() + 1);
                          return d.toISOString().slice(0, 10);
                        })(),
                        closed: loan.emisPaid + 1 >= loan.totalEmis,
                      };
                      updateStructuredLoan(updated);
                    }}
                    onRemove={() => removeStructuredLoan(loan.id)}
                  />
                ))}
              </div>
            </>
          )}

          {/* === PERSONAL LOANS TAB === */}
          {tab === "personal" && (
            <>
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

              <button onClick={() => setOpenPersonal(true)} className="w-full rounded-2xl border-2 border-dashed border-border text-muted-foreground py-3.5 flex items-center justify-center gap-2 hover:bg-card transition">
                <Plus className="size-4" />
                <span className="text-sm font-semibold">Add a personal loan / borrowing</span>
              </button>

              {activePersonal.length > 0 && (
                <PersonalSection title="Active">
                  {activePersonal.map((l) => <LoanRow key={l.id} loan={l} onSettle={() => settleLoan(l.id)} onRemove={() => removeLoan(l.id)} />)}
                </PersonalSection>
              )}
              {settledPersonal.length > 0 && (
                <PersonalSection title="Settled">
                  {settledPersonal.map((l) => <LoanRow key={l.id} loan={l} onSettle={() => {}} onRemove={() => removeLoan(l.id)} muted />)}
                </PersonalSection>
              )}
              {loans.length === 0 && (
                <div className="text-center py-10 text-sm text-muted-foreground">Track money lent to friends so nothing slips through.</div>
              )}
            </>
          )}

          {/* === CREDIT CARDS TAB === */}
          {tab === "cards" && (
            <>
              {/* Summary pill */}
              <div className="bg-gradient-to-br from-violet-500 to-violet-700 text-white rounded-2xl p-4 shadow-md shadow-violet-500/20">
                <div className="text-xs font-semibold text-violet-100">My Credit Cards</div>
                <div className="font-display text-xl font-black mt-1">{creditCards.length} Card{creditCards.length !== 1 ? "s" : ""}</div>
                <div className="text-[11px] text-violet-100 mt-1">Saved for expense tracking</div>
              </div>

              <button
                onClick={() => setOpenAddCard(true)}
                className="w-full rounded-2xl border-2 border-dashed border-border text-muted-foreground py-3.5 flex items-center justify-center gap-2 hover:bg-card hover:border-violet-400 transition"
              >
                <Plus className="size-4" />
                <span className="text-sm font-semibold">Add Credit Card</span>
              </button>

              {creditCards.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground px-4">
                  Add your credit cards here. When logging an expense, select Credit as payment mode and choose the card used — so you always know which card paid for what.
                </div>
              )}

              <div className="space-y-3">
                {creditCards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-card rounded-2xl border border-border/60 p-4 flex items-center gap-3 shadow-sm"
                  >
                    {/* Card art */}
                    <div
                      className="size-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `linear-gradient(135deg, ${card.color}dd, ${card.color}88)` }}
                    >
                      <CreditCard className="size-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{card.cardName}</div>
                      <div className="text-xs text-muted-foreground">{card.bankName} &bull;&bull;&bull;&bull; {card.last4Digits}</div>
                      {Boolean(card.creditLimit && card.creditLimit > 0) && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">Limit: {inr(card.creditLimit!)}</div>
                      )}
                    </div>
                    <button
                      onClick={() => removeCreditCard(card.id)}
                      className="size-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 transition shrink-0"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </Screen>

      {openAdd && (
        <AddStructuredLoanSheet
          properties={properties}
          onClose={() => setOpenAdd(false)}
          onSave={async (l) => { await addStructuredLoan(l); setOpenAdd(false); }}
        />
      )}
      {openPersonal && (
        <AddPersonalLoanSheet
          onClose={() => setOpenPersonal(false)}
          onSave={async (l) => { await addLoan(l); setOpenPersonal(false); }}
        />
      )}
      {openAddCard && (
        <AddCreditCardSheet
          onClose={() => setOpenAddCard(false)}
          onSave={async (c) => { await addCreditCard(c); setOpenAddCard(false); }}
        />
      )}
    </>
  );
}

// ===================== STRUCTURED LOAN CARD =====================
function StructuredLoanCard({
  loan, properties, expanded, onToggle, onPayEmi, onRemove
}: {
  loan: StructuredLoan;
  properties: any[];
  expanded: boolean;
  onToggle: () => void;
  onPayEmi: () => void;
  onRemove: () => void;
}) {
  const cfg = loanTypeConfig[loan.loanType];
  const Icon = cfg.icon;
  const outstanding = outstandingPrincipal(loan.principalAmount, loan.interestRatePA, loan.tenureMonths, loan.emisPaid);
  const progress = ((loan.emisPaid / loan.totalEmis) * 100);
  const interestFY = annualInterestPaid(loan.emiAmount, loan.principalAmount, loan.emisPaid, loan.tenureMonths, loan.interestRatePA);
  const linkedProp = properties.find(p => p.id === loan.linkedPropertyId);
  const emisLeft = loan.totalEmis - loan.emisPaid;
  const nextDue = loan.nextEmiDueDate;
  const daysUntilEmi = Math.ceil((new Date(nextDue).getTime() - Date.now()) / 86400000);
  const isUrgent = daysUntilEmi <= 5 && !loan.closed;

  return (
    <div className={`bg-card rounded-2xl border overflow-hidden transition-all ${loan.closed ? "opacity-60 border-border/40" : isUrgent ? "border-amber-400" : "border-border/60"} shadow-sm`}>
      <button onClick={onToggle} className="w-full p-4 flex items-center gap-3 text-left">
        <div className="size-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cfg.color}18` }}>
          <Icon className="size-5" style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-slate-900">{loan.lenderName}</div>
          <div className="text-xs text-muted-foreground">
            {cfg.label}{linkedProp ? ` · ${linkedProp.name}` : ""} · <span className="font-semibold text-slate-700">{loan.interestRatePA}% p.a.</span>
          </div>
        </div>
        <div className="text-right mr-2">
          <div className="font-bold text-sm text-slate-900">{inr(outstanding)}</div>
          <div className="text-[11px] text-muted-foreground">{emisLeft} EMIs left</div>
        </div>
        {expanded ? <ChevronUp className="size-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>{loan.emisPaid} EMIs paid</span>
          <span>{progress.toFixed(0)}% complete</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: cfg.color }} />
        </div>
      </div>

      {/* Next EMI alert */}
      {isUrgent && !loan.closed && (
        <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="size-3.5 text-amber-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-amber-800">EMI of {inr(loan.emiAmount)} due in {daysUntilEmi} day{daysUntilEmi !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
          {/* Amortization summary */}
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="EMI Amount" value={inr(loan.emiAmount)} />
            <StatBox label="Interest Rate" value={`${loan.interestRatePA}% p.a.`} />
            <StatBox label="Principal" value={inr(loan.principalAmount)} />
            <StatBox label="Outstanding" value={inr(outstanding)} color="rose" />
            <StatBox label="Total Interest" value={inr(totalInterest(loan.emiAmount, loan.tenureMonths, loan.principalAmount))} />
            <StatBox label="FY Interest (u/s 24b)" value={inr(interestFY)} color="green" note="ITR deduction" />
          </div>

          {/* Next EMI */}
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3">
            <Calendar className="size-4 text-slate-500" />
            <div>
              <div className="text-xs font-bold text-slate-800">Next EMI Date</div>
              <div className="text-[11px] text-muted-foreground">{nextDue} — {inr(loan.emiAmount)}</div>
            </div>
          </div>

          {/* Builder Milestones */}
          {loan.builderMilestones && loan.builderMilestones.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Builder Milestones</div>
              <div className="space-y-1.5">
                {loan.builderMilestones.map((m, i) => (
                  <div key={i} className={`flex justify-between items-center p-2.5 rounded-xl text-sm ${m.paid ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
                    <span className="font-semibold">{m.stage}</span>
                    <span className="font-bold">{inr(m.amount)} {m.paid ? "✓" : `· ${m.dueDate}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loan.notes && <div className="text-xs text-muted-foreground bg-muted rounded-xl p-2.5">{loan.notes}</div>}

          <div className="flex gap-2 pt-1">
            {!loan.closed && (
              <button
                onClick={onPayEmi}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Check className="size-3.5" /> Mark EMI Paid
              </button>
            )}
            <button onClick={onRemove} className="size-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color, note }: { label: string; value: string; color?: "rose" | "green"; note?: string }) {
  return (
    <div className="bg-muted/60 rounded-xl p-2.5">
      <div className="text-[10px] text-muted-foreground font-semibold">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${color === "rose" ? "text-rose-600" : color === "green" ? "text-emerald-700" : "text-slate-900"}`}>{value}</div>
      {note && <div className="text-[9px] text-emerald-600 font-semibold mt-0.5">{note}</div>}
    </div>
  );
}

// ===================== ADD STRUCTURED LOAN SHEET =====================
function AddStructuredLoanSheet({ onClose, onSave, properties }: {
  onClose: () => void;
  onSave: (l: Omit<StructuredLoan, "id">) => Promise<void>;
  properties: any[];
}) {
  const [loanType, setLoanType] = useState<StructuredLoanType>("home_loan");
  const [lenderName, setLenderName] = useState("");
  const [linkedPropertyId, setLinkedPropertyId] = useState("");
  const [principal, setPrincipal] = useState("");
  const [ratePA, setRatePA] = useState("8.5");
  const [tenureMonths, setTenureMonths] = useState("240");
  const [disbursementDate, setDisbursementDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nextEmiDueDate, setNextEmiDueDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10);
  });
  const [emisPaid, setEmisPaid] = useState("0");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [milestones, setMilestones] = useState<BuilderMilestone[]>([]);

  const p = Number(principal) || 0;
  const r = Number(ratePA) || 0;
  const t = Number(tenureMonths) || 1;
  const emi = p > 0 ? calcEmi(p, r, t) : 0;
  const totalInt = p > 0 ? totalInterest(emi, t, p) : 0;

  const isBuilderOrReg = loanType === "builder_demand" || loanType === "property_registration";

  const submit = async () => {
    if (!lenderName.trim() || !principal || saving) return;
    setSaving(true);
    try {
      await onSave({
        loanType,
        lenderName: lenderName.trim(),
        linkedPropertyId: linkedPropertyId || undefined,
        principalAmount: p,
        outstandingPrincipal: outstandingPrincipal(p, r, t, Number(emisPaid)),
        interestRatePA: r,
        tenureMonths: t,
        emiAmount: emi,
        disbursementDate,
        nextEmiDueDate,
        emisPaid: Number(emisPaid),
        totalEmis: t,
        isRegistrationLoan: loanType === "property_registration",
        builderMilestones: milestones.length > 0 ? milestones : undefined,
        notes: notes ? notes.trim() : undefined,
        closed: false,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-h-[95%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-10 animate-in slide-in-from-bottom duration-200 space-y-4">
        <div className="flex justify-between items-center">
          <div className="font-display text-lg font-bold">Add EMI / Property Loan</div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>

        {/* Loan Type Grid */}
        <div>
          <div className="text-xs text-muted-foreground font-semibold mb-2">Loan Type</div>
          <div className="grid grid-cols-3 gap-2">
            {(Object.entries(loanTypeConfig) as [StructuredLoanType, typeof loanTypeConfig[StructuredLoanType]][]).map(([type, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button
                  key={type}
                  onClick={() => setLoanType(type)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-semibold transition ${loanType === type ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-muted text-muted-foreground"}`}
                >
                  <Icon className="size-4" />
                  {cfg.label.split(" ")[0]}
                </button>
              );
            })}
          </div>
        </div>

        <Label label="Lender / Bank Name">
          <input value={lenderName} onChange={e => setLenderName(e.target.value)} placeholder="e.g. SBI Home Loans" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
        </Label>

        {properties.length > 0 && (
          <Label label="Link to Property (optional)">
            <select value={linkedPropertyId} onChange={e => setLinkedPropertyId(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none">
              <option value="">No property linked</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Label label="Loan Amount (₹)">
            <input inputMode="decimal" value={principal} onChange={e => setPrincipal(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
          </Label>
          <Label label="Interest Rate (% p.a.)">
            <input inputMode="decimal" value={ratePA} onChange={e => setRatePA(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
          </Label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Label label="Tenure (months)">
            <input inputMode="numeric" value={tenureMonths} onChange={e => setTenureMonths(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
          </Label>
          <Label label="EMIs Already Paid">
            <input inputMode="numeric" value={emisPaid} onChange={e => setEmisPaid(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
          </Label>
        </div>

        {/* Auto-calculated EMI */}
        {emi > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
            <div className="text-xs font-bold text-blue-900 mb-1">Auto-Calculated (Standard Amortization)</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-blue-600 font-bold">{inr(emi)}</span><div className="text-[10px] text-blue-700">Monthly EMI</div></div>
              <div><span className="text-rose-600 font-bold">{inr(totalInt)}</span><div className="text-[10px] text-blue-700">Total Interest</div></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Label label="Disbursement Date">
            <input type="date" value={disbursementDate} onChange={e => setDisbursementDate(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
          </Label>
          <Label label="Next EMI Due Date">
            <input type="date" value={nextEmiDueDate} onChange={e => setNextEmiDueDate(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
          </Label>
        </div>

        {/* Builder Milestones */}
        {isBuilderOrReg && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-muted-foreground font-semibold">Builder Demand Milestones</div>
              <button
                onClick={() => setMilestones(prev => [...prev, { stage: "", amount: 0, dueDate: new Date().toISOString().slice(0, 10), paid: false }])}
                className="text-[11px] text-primary font-bold flex items-center gap-1"
              >
                <Plus className="size-3" /> Add Stage
              </button>
            </div>
            {milestones.map((m, i) => (
              <div key={i} className="bg-muted/60 rounded-xl p-3 mb-2 grid grid-cols-3 gap-2">
                <input
                  placeholder="Stage name"
                  value={m.stage}
                  onChange={e => setMilestones(prev => prev.map((x, j) => j === i ? { ...x, stage: e.target.value } : x))}
                  className="col-span-2 bg-background rounded-lg px-2 py-1.5 text-xs outline-none border border-border"
                />
                <input
                  type="number"
                  placeholder="Amount"
                  value={m.amount || ""}
                  onChange={e => setMilestones(prev => prev.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x))}
                  className="bg-background rounded-lg px-2 py-1.5 text-xs outline-none border border-border"
                />
                <input
                  type="date"
                  value={m.dueDate}
                  onChange={e => setMilestones(prev => prev.map((x, j) => j === i ? { ...x, dueDate: e.target.value } : x))}
                  className="col-span-2 bg-background rounded-lg px-2 py-1.5 text-xs outline-none border border-border"
                />
                <button onClick={() => setMilestones(prev => prev.filter((_, j) => j !== i))} className="flex items-center justify-center text-rose-400">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Label label="Notes (optional)">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="e.g. ₹4L taken from HDFC for stamp duty and registration fees" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none" />
        </Label>

        <button onClick={submit} disabled={!lenderName || !principal || saving} className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm disabled:opacity-40 font-bold">
          {saving ? "Saving…" : "Save Loan"}
        </button>
      </div>
    </div>
  );
}

// ===================== PERSONAL LOAN ROW =====================
function PersonalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1 font-semibold">{title}</div>
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
          <div className="text-sm font-bold">{loan.person}</div>
          <div className="text-xs text-muted-foreground">{paymentLabel[loan.mode]} · taken {loan.takenOn}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold">{inr(loan.amount)}</div>
          {loan.settled ? (
            <div className="text-xs text-muted-foreground">Settled</div>
          ) : overdue ? (
            <div className="text-xs text-rose-600 font-semibold">Overdue {-daysLeft}d</div>
          ) : (
            <div className={`text-xs ${soon ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>Due {loan.repayBy}</div>
          )}
        </div>
      </div>
      {loan.notes && <div className="mt-2 text-xs text-muted-foreground">{loan.notes}</div>}
      {!loan.settled && (
        <div className="mt-3 pt-3 border-t border-border/60 flex gap-2">
          {soon || overdue ? (
            <div className="flex-1 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs flex items-center justify-center gap-1 font-semibold">
              <Bell className="size-3" /> Reminder set
            </div>
          ) : (
            <div className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs flex items-center justify-center font-semibold">{daysLeft}d to repay</div>
          )}
          <button onClick={onSettle} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs flex items-center gap-1 font-semibold">
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

function AddPersonalLoanSheet({ onClose, onSave }: { onClose: () => void; onSave: (l: Omit<Loan, "id">) => Promise<void> }) {
  const [direction, setDirection] = useState<"borrowed" | "lent">("borrowed");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [repayBy, setRepayBy] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10); });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!person.trim() || !amount || saving) return;
    setSaving(true);
    try {
      await onSave({ direction, person: person.trim(), amount: Number(amount), mode, takenOn: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit" }), repayBy, notes: notes ? notes.trim() : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200 space-y-3">
        <div className="flex justify-between items-center mb-1">
          <div className="font-display text-lg font-bold">Personal Loan</div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center"><X className="size-4" /></button>
        </div>
        <div className="bg-muted rounded-xl p-1 flex">
          {[{ id: "borrowed", label: "I borrowed", icon: ArrowDownLeft }, { id: "lent", label: "I lent", icon: ArrowUpRight }].map((t) => (
            <button key={t.id} onClick={() => setDirection(t.id as any)} className={`flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5 transition font-semibold ${direction === t.id ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <Label label="Person"><input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="e.g. Rahul" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" /></Label>
        <Label label="Amount (₹)"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" /></Label>
        <Label label="Payment mode">
          <div className="grid grid-cols-5 gap-2">
            {(["cash", "upi", "credit", "debit", "other"] as PaymentMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`py-2 rounded-xl text-[10px] border font-semibold ${mode === m ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-muted text-muted-foreground"}`}>{paymentLabel[m]}</button>
            ))}
          </div>
        </Label>
        <Label label="Repay by"><input type="date" value={repayBy} onChange={(e) => setRepayBy(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" /></Label>
        <Label label="Notes (optional)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="What's it for?" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none" /></Label>
        <button onClick={submit} disabled={!person || !amount || saving} className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-sm disabled:opacity-40 font-bold">
          {saving ? "Saving…" : "Save loan"}
        </button>
      </div>
    </div>
  );
}

function Label({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-0.5">
      <div className="text-xs text-muted-foreground mb-1.5 font-semibold">{label}</div>
      {children}
    </div>
  );
}

// ===================== ADD CREDIT CARD SHEET =====================
const CARD_COLORS = ["#8B5CF6", "#1E40AF", "#10B981", "#EF4444", "#F59E0B", "#0EA5E9", "#EC4899", "#64748B", "#DC2626", "#0D9488"];

function AddCreditCardSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (c: Omit<CreditCardData, "id">) => Promise<void>;
}) {
  const [cardName, setCardName] = useState("");
  const [bankName, setBankName] = useState("");
  const [last4, setLast4] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [statementDate, setStatementDate] = useState("1");
  const [color, setColor] = useState("#8B5CF6");
  const [saving, setSaving] = useState(false);

  const canSave = cardName.trim() && bankName.trim() && last4.trim().length === 4;

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave({
        cardName: cardName.trim(),
        bankName: bankName.trim(),
        last4Digits: last4.trim(),
        creditLimit: Number(creditLimit) || 0,
        statementDate: Number(statementDate) || 1,
        dueDate: 20,
        color,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200 space-y-4">

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <div className="font-display text-lg font-bold">Add Credit Card</div>
            <div className="text-xs text-muted-foreground mt-0.5">Saved once, select when paying</div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center">
            <X className="size-4" />
          </button>
        </div>

        {/* Card Preview */}
        <div
          className="w-full rounded-2xl p-5 flex flex-col gap-2 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${color}ee, ${color}99)` }}
        >
          <div className="flex justify-between items-start">
            <CreditCard className="size-6 text-white/90" />
            <div className="text-white/80 text-xs font-semibold">{bankName || "Bank Name"}</div>
          </div>
          <div className="mt-2 text-white/60 text-sm tracking-widest">•••• •••• •••• {last4 || "0000"}</div>
          <div className="text-white font-bold text-base">{cardName || "Card Name"}</div>
        </div>

        {/* Card Name */}
        <Label label="Card name">
          <input
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            placeholder="e.g. HDFC Regalia, Axis Flipkart"
            className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-300"
          />
        </Label>

        {/* Bank + Last 4 */}
        <div className="grid grid-cols-2 gap-3">
          <Label label="Bank">
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. HDFC, SBI"
              className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
          </Label>
          <Label label="Last 4 digits">
            <input
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="4321"
              inputMode="numeric"
              maxLength={4}
              className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none tracking-widest focus:ring-2 focus:ring-violet-300"
            />
          </Label>
        </div>

        {/* Credit Limit + Statement Date */}
        <div className="grid grid-cols-2 gap-3">
          <Label label="Credit limit (optional)">
            <input
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 200000"
              inputMode="numeric"
              className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
          </Label>
          <Label label="Statement date">
            <input
              value={statementDate}
              onChange={(e) => setStatementDate(e.target.value.replace(/\D/g, "").slice(0, 2))}
              placeholder="1–28"
              inputMode="numeric"
              maxLength={2}
              className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-300"
            />
          </Label>
        </div>

        {/* Color Picker */}
        <Label label="Card colour">
          <div className="flex gap-2.5 flex-wrap">
            {CARD_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`size-8 rounded-full transition border-2 ${color === c ? "border-foreground scale-110 shadow-md" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </Label>

        <button
          onClick={submit}
          disabled={!canSave || saving}
          className="w-full bg-violet-600 text-white rounded-xl py-3.5 text-sm disabled:opacity-40 font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
        >
          {saving ? <span className="animate-pulse">Saving…</span> : "Save card"}
        </button>
      </div>
    </div>
  );
}
