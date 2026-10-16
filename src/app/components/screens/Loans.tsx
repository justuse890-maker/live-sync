import { useState, useMemo, useEffect } from "react";
import { api } from "../../lib/api";
import { alreadyRecorded, applyInstallment, buildInstallmentTx, currentInstallment, isPreEmi, preEmiAmount } from "../../lib/loanEngine";
import { todayISO } from "../../lib/dateUtils";
import {
  Plus, ArrowDownLeft, ArrowUpRight, Bell, Check, Trash2, X, Building2, Car,
  GraduationCap, User, Home, CreditCard, ChevronDown, ChevronUp, AlertTriangle,
  Calendar, Palette, TrendingUp, TrendingDown, Clock, History, FileText,
  CheckCircle2, RefreshCw, Landmark, ExternalLink, ShieldCheck, Tag, ArrowRight,
  Receipt, Percent, Sparkles, SlidersHorizontal, Info
} from "lucide-react";
import { Header, Screen } from "../Shell";
import { EmiBurdenCard, EmiOutflow, PrepaymentSimulator } from "../EmiCommand";
import { typicalMonthlyIncome, bnplBurden, BNPL_ALERT_PCT } from "../../lib/emiPlanner";
import { inr } from "../types";
import {
  Loan, PaymentMode, StructuredLoan, StructuredLoanType, BuilderMilestone,
  CreditCard as CreditCardData, EmiRevision, Tx, useStore
} from "../../store";

const paymentLabel: Record<PaymentMode, string> = { cash: "Cash", upi: "UPI", credit: "Credit", debit: "Debit", other: "Other" };

const loanTypeConfig: Record<StructuredLoanType, { label: string; icon: typeof Home; color: string }> = {
  home_loan:             { label: "Home Loan",            icon: Home,           color: "#1E40AF" },
  car_loan:              { label: "Car Loan",              icon: Car,            color: "#0891B2" },
  personal_loan:         { label: "Personal Loan",         icon: User,           color: "#7C3AED" },
  education_loan:        { label: "Education Loan",        icon: GraduationCap,  color: "#059669" },
  property_registration: { label: "Property Registration", icon: Building2,      color: "#D97706" },
  builder_demand:        { label: "Builder Demand",        icon: Building2,      color: "#DC2626" },
  bnpl:                  { label: "BNPL / Pay-later",      icon: CreditCard,     color: "#BE185D" },
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

/** Actuals tracked in transaction ledger for a structured loan */
function getLoanActuals(loan: StructuredLoan, transactions: Tx[]) {
  const loanTxs = transactions
    .filter((t) => t.loanId === loan.id && t.type === "expense")
    .sort((a, b) => b.date.localeCompare(a.date));
  const totalPaid = loanTxs.reduce((s, t) => s + Math.abs(t.amount), 0);
  const prepayTxs = loanTxs.filter((t) => t.loanPaymentType === "prepayment");
  const totalPrepaid = prepayTxs.reduce((s, t) => s + Math.abs(t.amount), 0);
  const emiTxs = loanTxs.filter((t) => t.loanPaymentType !== "prepayment");
  // Pre-EMI repays no principal: what is owed is what the bank has disbursed so far.
  const baseOutstanding = isPreEmi(loan) ? (loan.disbursedAmount ?? loan.outstandingPrincipal) : outstandingPrincipal(loan.principalAmount, loan.interestRatePA, loan.tenureMonths, loan.emisPaid);
  const adjustedOutstanding = Math.max(0, baseOutstanding - totalPrepaid);
  return { loanTxs, totalPaid, prepayTxs, totalPrepaid, emiTxs, adjustedOutstanding };
}

export function Loans({ onBack }: { onBack: () => void }) {
  const {
    loans, addLoan, settleLoan, removeLoan, structuredLoans, addStructuredLoan,
    updateStructuredLoan, removeStructuredLoan, properties, creditCards,
    addCreditCard, removeCreditCard, transactions, addTransaction
  } = useStore();

  const [tab, setTab] = useState<"structured" | "personal" | "cards">("structured");
  const [openAdd, setOpenAdd] = useState(false);
  const [openPersonal, setOpenPersonal] = useState(false);
  const [openAddCard, setOpenAddCard] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal states for loan intelligence
  const [detailLoanId, setDetailLoanId] = useState<string | null>(null);
  const [revisionLoanId, setRevisionLoanId] = useState<string | null>(null);
  const [logEmiLoanId, setLogEmiLoanId] = useState<string | null>(null);

  const activePersonal = loans.filter((l) => !l.settled);
  const settledPersonal = loans.filter((l) => l.settled);
  const owed = activePersonal.filter((l) => l.direction === "borrowed").reduce((s, l) => s + l.amount, 0);
  const owedToYou = activePersonal.filter((l) => l.direction === "lent").reduce((s, l) => s + l.amount, 0);

  const totalOutstanding = structuredLoans.filter(l => !l.closed).reduce((s, l) => {
    const { adjustedOutstanding } = getLoanActuals(l, transactions);
    return s + adjustedOutstanding;
  }, 0);

  const totalEmiMonthly = structuredLoans.filter(l => !l.closed).reduce((s, l) => s + currentInstallment(l).amount, 0);
  const monthlyIncome = useMemo(() => typicalMonthlyIncome(transactions), [transactions]);

  const totalTrackedDebits = useMemo(() => {
    return transactions
      .filter((t) => t.type === "expense" && Boolean(t.loanId))
      .reduce((s, t) => s + Math.abs(t.amount), 0);
  }, [transactions]);

  // Lookup active loan objects
  const activeDetailLoan = structuredLoans.find((l) => l.id === detailLoanId) || null;
  const activeRevisionLoan = structuredLoans.find((l) => l.id === revisionLoanId) || null;
  const activeLogEmiLoan = structuredLoans.find((l) => l.id === logEmiLoanId) || null;

  return (
    <>
      <Header title="Loans & EMI Tracker" subtitle="Expert loan intelligence" showBack onBack={onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-4 pb-24">

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-rose-200 rounded-2xl p-4">
              <div className="text-xs font-semibold text-rose-700">Total Outstanding</div>
              <div className="font-display text-xl font-black mt-1 text-slate-900">{inr(totalOutstanding)}</div>
              <div className="text-[11px] text-slate-500 mt-1">{structuredLoans.filter(l => !l.closed).length} active loans</div>
            </div>
            <div className="bg-card border border-amber-200 rounded-2xl p-4">
              <div className="text-xs font-semibold text-amber-700">Monthly EMI Load</div>
              <div className="font-display text-xl font-black mt-1 text-slate-900">{inr(totalEmiMonthly)}</div>
              <div className="text-[11px] text-slate-500 mt-1">across all loans</div>
            </div>
          </div>

          {structuredLoans.some((l) => !l.closed) && (
            <>
              <EmiBurdenCard monthlyIncome={monthlyIncome} totalEmi={totalEmiMonthly} />
              {(() => {
                const b = bnplBurden(monthlyIncome, structuredLoans);
                if (!b.hasAny) return null;
                return (
                  <div className={`rounded-2xl border p-3.5 text-xs leading-snug ${b.flagged ? "bg-rose-50 border-rose-200 text-rose-900" : "bg-pink-50 border-pink-200 text-pink-900"}`}>
                    <div className="font-bold">Pay-later dues: {inr(b.monthly)} a month{b.ratioPct != null ? ` (${b.ratioPct.toFixed(0)}% of income)` : ""}</div>
                    <div className="mt-1">{b.flagged ? `Above ${BNPL_ALERT_PCT}% of income. Pay-later is borrowing, and a missed due date adds fees and can hurt your credit record. Clear these first.` : "Pay-later counts as debt here, not as spending. Keep it under 10% of income."}</div>
                  </div>
                );
              })()}
              <EmiOutflow loans={structuredLoans} />
            </>
          )}

          {/* Tracked Ledger Outflow Bar */}
          {totalTrackedDebits > 0 && (
            <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-2xl p-3 flex items-center justify-between text-xs text-emerald-950">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-4" />
                </div>
                <div>
                  <div className="font-bold">Total Reconciled Bank Debits</div>
                  <div className="text-[11px] text-emerald-700">Tracked in expense ledger</div>
                </div>
              </div>
              <div className="font-extrabold text-sm text-emerald-900">{inr(totalTrackedDebits)}</div>
            </div>
          )}

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
                {structuredLoans.map((loan) => (
                  <StructuredLoanCard
                    key={loan.id}
                    loan={loan}
                    properties={properties}
                    transactions={transactions}
                    expanded={expandedId === loan.id}
                    onToggle={() => setExpandedId(expandedId === loan.id ? null : loan.id)}
                    onOpenDetail={() => setDetailLoanId(loan.id)}
                    onOpenRevision={() => setRevisionLoanId(loan.id)}
                    onOpenLogEmi={() => setLogEmiLoanId(loan.id)}
                    onPayEmi={async () => {
                      const inst = currentInstallment(loan);
                      const due = { dueDate: loan.nextEmiDueDate, ...inst };
                      // the payment is an expense too — unless the auto-debit already recorded this due date
                      if (!alreadyRecorded(transactions, loan.id, due.dueDate)) {
                        await addTransaction(buildInstallmentTx(loan, due, { auto: false }));
                      }
                      await updateStructuredLoan(applyInstallment(loan, inst.kind));
                    }}
                    onRemove={() => removeStructuredLoan(loan.id)}
                    onUpdate={updateStructuredLoan}
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

      {/* Add New Loan Sheet */}
      {openAdd && (
        <AddStructuredLoanSheet
          properties={properties}
          onClose={() => setOpenAdd(false)}
          onSave={async (l) => { await addStructuredLoan(l); setOpenAdd(false); }}
        />
      )}

      {/* Add Personal Loan Sheet */}
      {openPersonal && (
        <AddPersonalLoanSheet
          onClose={() => setOpenPersonal(false)}
          onSave={async (l) => { await addLoan(l); setOpenPersonal(false); }}
        />
      )}

      {/* Add Credit Card Sheet */}
      {openAddCard && (
        <AddCreditCardSheet
          onClose={() => setOpenAddCard(false)}
          onSave={async (c) => { await addCreditCard(c); setOpenAddCard(false); }}
        />
      )}

      {/* Comprehensive Loan Detail & Payment History Ledger Modal */}
      {activeDetailLoan && (
        <LoanDetailModal
          loan={activeDetailLoan}
          properties={properties}
          transactions={transactions}
          onClose={() => setDetailLoanId(null)}
          onOpenRevision={() => setRevisionLoanId(activeDetailLoan.id)}
          onOpenLogEmi={() => setLogEmiLoanId(activeDetailLoan.id)}
          onRemove={() => {
            removeStructuredLoan(activeDetailLoan.id);
            setDetailLoanId(null);
          }}
        />
      )}

      {/* Floating Rate & EMI Revision Sheet */}
      {activeRevisionLoan && (
        <AddEmiRevisionSheet
          loan={activeRevisionLoan}
          onClose={() => setRevisionLoanId(null)}
          onSave={async (rev, newEmi, newRate) => {
            const history = [...(activeRevisionLoan.emiHistory || []), rev];
            await updateStructuredLoan({
              ...activeRevisionLoan,
              emiAmount: newEmi,
              interestRatePA: newRate,
              emiHistory: history,
            });
            setRevisionLoanId(null);
          }}
        />
      )}

      {/* Log EMI Auto-Debit / Pre-payment Sheet */}
      {activeLogEmiLoan && (
        <LogEmiDebitSheet
          loan={activeLogEmiLoan}
          onClose={() => setLogEmiLoanId(null)}
          onSave={async (txData, isPrepayment, advanceDueDate) => {
            await addTransaction(txData);
            if (!isPrepayment) {
              const kind = currentInstallment(activeLogEmiLoan).kind;
              const next = applyInstallment(activeLogEmiLoan, kind);
              await updateStructuredLoan(advanceDueDate ? next : { ...next, nextEmiDueDate: activeLogEmiLoan.nextEmiDueDate });
            }
            setLogEmiLoanId(null);
          }}
        />
      )}
    </>
  );
}

// ===================== PRE-EMI / AUTO-DEBIT CONTROLS =====================
function LoanPhaseControls({ loan, onUpdate }: { loan: StructuredLoan; onUpdate: (l: StructuredLoan) => void }) {
  const [disbursed, setDisbursed] = useState(String(loan.disbursedAmount ?? ""));
  if (loan.closed) return null;
  const pre = isPreEmi(loan);
  const amt = Math.min(Number(disbursed) || 0, loan.principalAmount);
  return (
    <div className="rounded-2xl border border-border p-3 space-y-3">
      {pre && (
        <div className="space-y-2">
          <div className="text-xs font-bold">Pre-EMI · bank has released {inr(loan.disbursedAmount ?? 0)} of {inr(loan.principalAmount)}</div>
          <div className="flex gap-2">
            <input inputMode="decimal" value={disbursed} onChange={(e) => setDisbursed(e.target.value.replace(/[^0-9.]/g, ""))} className="flex-1 bg-muted/60 rounded-xl px-3 py-2 text-sm outline-none" placeholder="Total disbursed so far" />
            <button
              onClick={() => onUpdate({ ...loan, disbursedAmount: amt, outstandingPrincipal: amt })}
              disabled={!amt || amt === loan.disbursedAmount}
              className="px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40"
            >Update</button>
          </div>
          <div className="text-[11px] text-muted-foreground">New tranche → new Pre-EMI of <b>{inr(preEmiAmount(amt, loan.interestRatePA))}</b>/month from the next due date.</div>
          <button
            onClick={() => onUpdate({ ...loan, phase: "emi", disbursedAmount: undefined, outstandingPrincipal: loan.principalAmount })}
            className="w-full text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl py-2"
          >Fully disbursed — start full EMI ({inr(loan.emiAmount)}/mo)</button>
        </div>
      )}
      <button onClick={() => onUpdate({ ...loan, autoDebit: !loan.autoDebit })} className="w-full flex items-center justify-between gap-3 text-left">
        <div>
          <div className="text-xs font-bold">Auto-debit {loan.autoDebit ? "on" : "off"}</div>
          <div className="text-[11px] text-muted-foreground">{loan.autoDebit ? "Each instalment is recorded as an expense on its due date." : "Turn on to record instalments automatically."}</div>
        </div>
        <span className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 ${loan.autoDebit ? "bg-primary" : "bg-slate-300"}`}>
          <span className={`block size-5 rounded-full bg-white transition-transform ${loan.autoDebit ? "translate-x-4" : ""}`} />
        </span>
      </button>
    </div>
  );
}

// ===================== STRUCTURED LOAN CARD =====================
function StructuredLoanCard({
  loan, properties, transactions, expanded, onToggle, onOpenDetail, onOpenRevision, onOpenLogEmi, onPayEmi, onRemove, onUpdate
}: {
  loan: StructuredLoan;
  onUpdate: (l: StructuredLoan) => void;
  properties: any[];
  transactions: Tx[];
  expanded: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
  onOpenRevision: () => void;
  onOpenLogEmi: () => void;
  onPayEmi: () => void;
  onRemove: () => void;
}) {
  const cfg = loanTypeConfig[loan.loanType];
  const Icon = cfg.icon;
  const linkedProp = properties.find(p => p.id === loan.linkedPropertyId);
  const { loanTxs, totalPaid, adjustedOutstanding } = getLoanActuals(loan, transactions);
  const progress = ((loan.emisPaid / loan.totalEmis) * 100);
  const interestFY = annualInterestPaid(loan.emiAmount, loan.principalAmount, loan.emisPaid, loan.tenureMonths, loan.interestRatePA);
  const emisLeft = loan.totalEmis - loan.emisPaid;
  const preEmi = isPreEmi(loan);
  const inst = currentInstallment(loan);
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
          <div className="font-bold text-sm text-slate-900 truncate">{loan.lenderName}</div>
          <div className="text-xs text-muted-foreground truncate">
            {cfg.label}{linkedProp ? ` · 🏠 ${linkedProp.name}` : ""} · <span className="font-semibold text-slate-700">{loan.interestRatePA}% p.a.</span>
          </div>
          {(preEmi || loan.autoDebit) && (
            <div className="flex flex-wrap gap-1 mt-1">
              {preEmi && <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">PRE-EMI · interest only</span>}
              {loan.autoDebit && <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">Auto-debit on</span>}
            </div>
          )}
          {loanTxs.length > 0 && (
            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 mt-1">
              <CheckCircle2 className="size-3 shrink-0" />
              <span>{loanTxs.length} debits tracked ({inr(totalPaid)})</span>
            </div>
          )}
        </div>
        <div className="text-right mr-1 shrink-0">
          <div className="font-bold text-sm text-slate-900">{inr(adjustedOutstanding)}</div>
          <div className="text-[11px] text-muted-foreground">{preEmi ? "Pre-EMI phase" : `${emisLeft} EMIs left`}</div>
        </div>
        {expanded ? <ChevronUp className="size-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>{preEmi ? `Pre-EMI paid so far: ${inr(loan.preEmiPaidTotal ?? 0)}` : `${loan.emisPaid} of ${loan.totalEmis} EMIs (${loan.tenureMonths} mo)`}</span>
          <span>{preEmi ? `${inr(loan.disbursedAmount ?? 0)} of ${inr(loan.principalAmount)} disbursed` : `${progress.toFixed(0)}% amortized`}</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: cfg.color }} />
        </div>
      </div>

      {/* Next EMI alert */}
      {isUrgent && !loan.closed && (
        <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-3.5 text-amber-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-800">{preEmi ? "Pre-EMI" : "EMI"} {inr(inst.amount)} due in {daysUntilEmi} day{daysUntilEmi !== 1 ? "s" : ""}</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenLogEmi(); }}
            className="text-[11px] bg-amber-600 text-white font-bold px-2 py-0.5 rounded-md hover:bg-amber-700 transition"
          >
            Log Debit
          </button>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
          {/* Amortization summary */}
          <div className="grid grid-cols-2 gap-2">
            <StatBox label={preEmi ? "Pre-EMI (interest)" : "Current EMI"} value={inr(inst.amount)} note={preEmi ? `Full EMI ${inr(loan.emiAmount)} later · due ${nextDue}` : `Due on ${nextDue}`} />
            <StatBox label="Interest Rate" value={`${loan.interestRatePA}% p.a.`} note={loan.emiHistory && loan.emiHistory.length > 1 ? `${loan.emiHistory.length} revisions logged` : undefined} />
            <StatBox label="Principal Sanctioned" value={inr(loan.principalAmount)} />
            <StatBox label="Current Outstanding" value={inr(adjustedOutstanding)} color="rose" />
            <StatBox label="Total Interest" value={inr(totalInterest(loan.emiAmount, loan.tenureMonths, loan.principalAmount))} />
            <StatBox label="Annual Interest (u/s 24b)" value={inr(interestFY)} color="green" note="ITR Eligible" />
          </div>

          <LoanPhaseControls loan={loan} onUpdate={onUpdate} />

          {/* Linked Property Banner if Home Loan */}
          {linkedProp && (
            <div className="flex items-center gap-2.5 bg-blue-50/80 border border-blue-200/60 rounded-xl p-3 text-xs">
              <Home className="size-4 text-blue-700 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-bold text-blue-950">Linked Property: {linkedProp.name}</span>
                <div className="text-[11px] text-blue-700">Valuation: {inr(linkedProp.currentValuation || linkedProp.purchasePrice)}</div>
              </div>
            </div>
          )}

          {/* Quick Action Controls */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={onOpenDetail}
              className="py-2.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
            >
              <FileText className="size-3.5" /> Full Ledger & Revisions
            </button>
            <button
              onClick={onOpenLogEmi}
              className="py-2.5 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
            >
              <Check className="size-3.5" /> Log Auto-Debit
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onOpenRevision}
              className="flex-1 py-2 rounded-xl bg-muted/80 hover:bg-muted text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <RefreshCw className="size-3 text-slate-500" /> Record Rate / EMI Change
            </button>
            <button
              onClick={onRemove}
              className="size-9 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition shrink-0"
              title="Delete loan"
            >
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

// ===================== FULL LOAN DETAIL & LEDGER MODAL =====================
function LoanDetailModal({
  loan, properties, transactions, onClose, onOpenRevision, onOpenLogEmi, onRemove
}: {
  loan: StructuredLoan;
  properties: any[];
  transactions: Tx[];
  onClose: () => void;
  onOpenRevision: () => void;
  onOpenLogEmi: () => void;
  onRemove: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"ledger" | "revisions" | "tax">("ledger");
  const cfg = loanTypeConfig[loan.loanType];
  const Icon = cfg.icon;
  const linkedProp = properties.find((p) => p.id === loan.linkedPropertyId);
  const { loanTxs, totalPaid, prepayTxs, totalPrepaid, adjustedOutstanding } = getLoanActuals(loan, transactions);
  const interestFY = annualInterestPaid(loan.emiAmount, loan.principalAmount, loan.emisPaid, loan.tenureMonths, loan.interestRatePA);
  const principalFY = Math.max(0, Math.min(150000, (loan.emiAmount * 12) - interestFY));
  const emisLeft = loan.totalEmis - loan.emisPaid;
  const progress = ((loan.emisPaid / loan.totalEmis) * 100);

  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-h-[94%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-10 animate-in slide-in-from-bottom duration-200 space-y-4 shadow-2xl"
      >
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${cfg.color}18` }}>
              <Icon className="size-6" style={{ color: cfg.color }} />
            </div>
            <div>
              <div className="font-display text-lg font-bold text-slate-900">{loan.lenderName}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                <span className="font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                {linkedProp && (
                  <>
                    <span>·</span>
                    <span className="font-bold text-slate-700 flex items-center gap-1">
                      <Home className="size-3 text-blue-600" /> {linkedProp.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80">
            <X className="size-4 text-slate-600" />
          </button>
        </div>

        {/* 4 Financial KPI Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3">
            <div className="text-[10px] text-muted-foreground font-semibold">Principal Sanctioned</div>
            <div className="font-display text-base font-black text-slate-900 mt-0.5">{inr(loan.principalAmount)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{loan.tenureMonths} mo tenure</div>
          </div>
          <div className="bg-rose-50 border border-rose-200/60 rounded-2xl p-3">
            <div className="text-[10px] text-rose-700 font-semibold">Current Outstanding</div>
            <div className="font-display text-base font-black text-rose-900 mt-0.5">{inr(adjustedOutstanding)}</div>
            <div className="text-[10px] text-rose-600 mt-0.5">{emisLeft} EMIs remaining</div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200/60 rounded-2xl p-3">
            <div className="text-[10px] text-emerald-700 font-semibold">Tracked Repayments</div>
            <div className="font-display text-base font-black text-emerald-900 mt-0.5">{inr(totalPaid)}</div>
            <div className="text-[10px] text-emerald-600 mt-0.5">{loanTxs.length} debits reconciled</div>
          </div>
          <div className="bg-blue-50 border border-blue-200/60 rounded-2xl p-3">
            <div className="text-[10px] text-blue-700 font-semibold">Active Monthly EMI</div>
            <div className="font-display text-base font-black text-blue-900 mt-0.5">{inr(loan.emiAmount)}</div>
            <div className="text-[10px] text-blue-700 mt-0.5">{loan.interestRatePA}% p.a. floating</div>
          </div>
        </div>

        {/* Amortization Progress */}
        <div className="bg-muted/40 rounded-2xl p-3.5 space-y-2 border border-border/50">
          <div className="flex justify-between text-xs items-center">
            <span className="font-semibold text-slate-800">Repayment Progress</span>
            <span className="font-bold text-primary">{progress.toFixed(0)}% completed</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: cfg.color }} />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
            <span>{loan.emisPaid} EMIs Paid</span>
            <span>Next Due: {loan.nextEmiDueDate}</span>
          </div>
        </div>

        {!loan.closed && !isPreEmi(loan) && <PrepaymentSimulator loan={loan} balance={adjustedOutstanding} />}

        {/* Quick Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onOpenLogEmi}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
          >
            <Check className="size-4" /> Log EMI Auto-Debit
          </button>
          <button
            onClick={onOpenRevision}
            className="py-2.5 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
          >
            <RefreshCw className="size-3.5" /> Rate Revision
          </button>
        </div>

        {/* Segmented View Subtabs */}
        <div className="bg-muted rounded-xl p-1 flex">
          <button
            onClick={() => setActiveTab("ledger")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === "ledger" ? "bg-card text-slate-900 shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Receipt className="size-3.5" /> Payment Ledger ({loanTxs.length})
          </button>
          <button
            onClick={() => setActiveTab("revisions")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === "revisions" ? "bg-card text-slate-900 shadow-sm" : "text-muted-foreground"
            }`}
          >
            <History className="size-3.5" /> Rate History ({loan.emiHistory?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("tax")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === "tax" ? "bg-card text-slate-900 shadow-sm" : "text-muted-foreground"
            }`}
          >
            <ShieldCheck className="size-3.5" /> ITR Tax 80C/24b
          </button>
        </div>

        {/* ── SUBTAB 1: PAYMENT HISTORY LEDGER ── */}
        {activeTab === "ledger" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>All debits linked to this loan</span>
              <span className="font-bold text-slate-700">{inr(totalPaid)} total</span>
            </div>

            {loanTxs.length === 0 ? (
              <div className="text-center py-8 bg-muted/30 border border-dashed border-border rounded-2xl p-4 space-y-2">
                <Receipt className="size-8 mx-auto text-muted-foreground/50" />
                <div className="text-xs font-bold text-slate-700">No bank debits tracked yet</div>
                <div className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  When your monthly EMI auto-debits from your bank account, log it under Category &quot;EMI&quot; or tap below.
                </div>
                <button
                  onClick={onOpenLogEmi}
                  className="mt-2 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-xl transition"
                >
                  Log First EMI Debit
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {loanTxs.map((t) => (
                  <div
                    key={t.id}
                    className="bg-card border border-border/70 rounded-xl p-3 flex items-center justify-between shadow-2xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">{t.merchant || t.title}</span>
                        {t.loanPaymentType === "prepayment" ? (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">PREPAY</span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">EMI</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span>{t.date}</span>
                        <span>·</span>
                        <span className="capitalize">{t.payments?.[0]?.mode || "Bank Debit"}</span>
                        {t.notes && <span className="truncate italic max-w-[120px]">({t.notes})</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-extrabold text-slate-900">-{inr(t.amount)}</div>
                      <div className="text-[9px] font-medium text-emerald-600 flex items-center gap-0.5 justify-end">
                        <Check className="size-2.5" /> Reconciled
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SUBTAB 2: FLOATING RATE & EMI REVISION TIMELINE ── */}
        {activeTab === "revisions" && (
          <div className="space-y-3">
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Info className="size-3.5 text-amber-600" /> Floating Rate Tracking
              </div>
              <div className="text-[11px] text-amber-900/90 leading-relaxed">
                Indian home loans typically have floating interest rates that fluctuate when RBI changes the repo rate. LiveSync tracks every rate revision without distorting your past ledger.
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">Revision History</span>
              <button
                onClick={onOpenRevision}
                className="text-primary font-bold text-[11px] flex items-center gap-1 hover:underline"
              >
                <Plus className="size-3" /> Add Revision
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {loan.emiHistory && loan.emiHistory.length > 0 ? (
                loan.emiHistory.map((rev, idx) => (
                  <div key={rev.id || idx} className="bg-card border border-border/70 rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-primary" />
                        <span className="text-xs font-bold text-slate-900">{inr(rev.emiAmount)} / mo</span>
                        {rev.interestRatePA && (
                          <span className="text-[11px] font-semibold text-slate-600">@ {rev.interestRatePA}% p.a.</span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">{rev.effectiveDate}</span>
                    </div>
                    {rev.reason && (
                      <div className="text-[11px] text-slate-600 pl-4">{rev.reason}</div>
                    )}
                  </div>
                ))
              ) : (
                <div className="bg-muted/40 rounded-xl p-3 text-xs text-muted-foreground text-center">
                  Started at {loan.interestRatePA}% p.a. with {inr(loan.emiAmount)}/mo on {loan.disbursementDate}. No rate revisions recorded yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SUBTAB 3: INDIAN TAX DEDUCTION INTELLIGENCE ── */}
        {activeTab === "tax" && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200/70 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                <ShieldCheck className="size-4 text-indigo-700" />
                <span>Indian Income Tax Act Benefits (FY 2025-26)</span>
              </div>
              <div className="text-[11px] text-indigo-950/80 leading-relaxed">
                As a home borrower, you are eligible for significant income tax savings across Section 24(b) and Section 80C.
              </div>
            </div>

            <div className="space-y-2">
              {/* Section 24b */}
              <div className="bg-card border border-border rounded-xl p-3 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-900">Section 24(b) · Interest Deduction</span>
                  <span className="text-emerald-700 font-extrabold">{inr(Math.min(200000, interestFY))}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Up to ₹2,00,000 deduction on annual home loan interest paid for self-occupied properties. Estimated FY interest: {inr(interestFY)}.
                </div>
              </div>

              {/* Section 80C */}
              <div className="bg-card border border-border rounded-xl p-3 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-900">Section 80C · Principal Repayment</span>
                  <span className="text-emerald-700 font-extrabold">{inr(principalFY)}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Up to ₹1,50,000 deduction on principal repayment under the overall Section 80C basket.
                </div>
              </div>

              {/* Potential tax savings calculation */}
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-emerald-950">Estimated Annual Tax Savings</div>
                  <div className="text-[10px] text-emerald-700">Calculated at 30% tax bracket</div>
                </div>
                <div className="text-sm font-black text-emerald-900">
                  ~{inr(Math.round((Math.min(200000, interestFY) + principalFY) * 0.312))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer info & delete button */}
        <div className="flex justify-between items-center pt-2 text-xs border-t border-border/50">
          <span className="text-muted-foreground text-[11px]">Disbursed on {loan.disbursementDate}</span>
          <button
            onClick={onRemove}
            className="text-rose-600 hover:text-rose-700 font-bold text-xs flex items-center gap-1"
          >
            <Trash2 className="size-3.5" /> Remove Loan
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== ADD EMI REVISION SHEET =====================
function AddEmiRevisionSheet({
  loan, onClose, onSave
}: {
  loan: StructuredLoan;
  onClose: () => void;
  onSave: (rev: EmiRevision, newEmi: number, newRate: number) => Promise<void>;
}) {
  const [emiAmount, setEmiAmount] = useState(String(loan.emiAmount));
  const [interestRatePA, setInterestRatePA] = useState(String(loan.interestRatePA));
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const REASONS = [
    "RBI Repo Rate Hike (+25 bps)",
    "RBI Repo Rate Cut (-25 bps)",
    "Tenure Adjustment",
    "Pre-payment EMI Reset",
    "Bank MCLR Spread Update",
  ];

  const submit = async () => {
    const e = Number(emiAmount);
    const r = Number(interestRatePA);
    if (!e || saving) return;
    setSaving(true);
    try {
      const revision: EmiRevision = {
        id: crypto.randomUUID(),
        effectiveDate,
        emiAmount: e,
        interestRatePA: r,
        reason: reason.trim() || "Rate revision",
        createdAt: new Date().toISOString(),
      };
      await onSave(revision, e, r);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200 space-y-4"
      >
        <div className="flex justify-between items-center">
          <div>
            <div className="font-display text-lg font-bold">Record Rate / EMI Revision</div>
            <div className="text-xs text-muted-foreground">{loan.lenderName} floating rate adjustment</div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Label label="New Monthly EMI (₹)">
            <input
              inputMode="decimal"
              value={emiAmount}
              onChange={(e) => setEmiAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none font-bold"
            />
          </Label>
          <Label label="New Interest Rate (% p.a.)">
            <input
              inputMode="decimal"
              value={interestRatePA}
              onChange={(e) => setInterestRatePA(e.target.value)}
              className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none font-bold"
            />
          </Label>
        </div>

        <Label label="Effective Date">
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none"
          />
        </Label>

        <div>
          <div className="text-xs text-muted-foreground font-semibold mb-1.5">Quick Reasons</div>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                  reason === r ? "bg-primary text-white border-primary" : "bg-muted text-slate-700 border-border"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <Label label="Custom Note / Reason">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Repo rate increased by 25 bps by RBI"
            className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none"
          />
        </Label>

        <button
          onClick={submit}
          disabled={!emiAmount || saving}
          className="w-full bg-primary text-primary-foreground font-bold rounded-xl py-3.5 text-sm shadow-sm active:scale-[0.98] transition disabled:opacity-50"
        >
          {saving ? "Saving Revision…" : "Save Rate Revision"}
        </button>
      </div>
    </div>
  );
}

// ===================== LOG EMI DEBIT SHEET =====================
function LogEmiDebitSheet({
  loan, onClose, onSave
}: {
  loan: StructuredLoan;
  onClose: () => void;
  onSave: (tx: Omit<Tx, "id">, isPrepayment: boolean, advanceDueDate: boolean) => Promise<void>;
}) {
  const [paymentType, setPaymentType] = useState<"emi" | "prepayment">("emi");
  const inst = currentInstallment(loan);
  const [amount, setAmount] = useState(String(inst.amount));
  const [date, setDate] = useState(() => todayISO());
  const [mode, setMode] = useState<PaymentMode>("debit");
  const [advanceDueDate, setAdvanceDueDate] = useState(true);
  const [notes, setNotes] = useState(`Auto-debited for ${loan.lenderName}`);
  const [saving, setSaving] = useState(false);

  const isPrepay = paymentType === "prepayment";

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || saving) return;
    setSaving(true);
    try {
      await onSave(
        {
          date,
          title: `${loan.lenderName} ${isPrepay ? "Pre-payment" : inst.kind === "pre_emi" ? "Pre-EMI (interest only)" : "EMI"}`,
          merchant: loan.lenderName,
          amount: -Math.abs(amt),
          type: "expense",
          category: "EMI",
          payments: [{ mode, amount: Math.abs(amt) }],
          notes: notes ? notes.trim() : undefined,
          loanId: loan.id,
          loanPaymentType: isPrepay ? "prepayment" : inst.kind,
          accountId: loan.autoDebitBankAccountId || undefined,
        },
        isPrepay,
        advanceDueDate
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-h-[92%] overflow-y-auto bg-card rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-200 space-y-4"
      >
        <div className="flex justify-between items-center">
          <div>
            <div className="font-display text-lg font-bold">Log Loan Bank Debit</div>
            <div className="text-xs text-muted-foreground">{loan.lenderName}</div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full bg-muted flex items-center justify-center">
            <X className="size-4" />
          </button>
        </div>

        {/* Payment Type toggle */}
        <div className="bg-muted rounded-xl p-1 flex">
          <button
            onClick={() => {
              setPaymentType("emi");
              setAmount(String(inst.amount));
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
              paymentType === "emi" ? "bg-card shadow-sm text-slate-900" : "text-muted-foreground"
            }`}
          >
            {inst.kind === "pre_emi" ? "Pre-EMI" : "Regular EMI"} ({inr(inst.amount)})
          </button>
          <button
            onClick={() => {
              setPaymentType("prepayment");
              setAmount("");
            }}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
              paymentType === "prepayment" ? "bg-card shadow-sm text-slate-900" : "text-muted-foreground"
            }`}
          >
            Part Pre-payment
          </button>
        </div>

        <Label label="Debit Amount (₹)">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={isPrepay ? "Enter lump-sum amount (e.g. 100000)" : String(inst.amount)}
            className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none font-bold"
          />
        </Label>

        <div className="grid grid-cols-2 gap-3">
          <Label label="Debit Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none"
            />
          </Label>
          <Label label="Payment Mode">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as PaymentMode)}
              className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none"
            >
              <option value="debit">NetBanking / Auto-Debit</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </Label>
        </div>

        {!isPrepay && (
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 bg-muted/40 p-2.5 rounded-xl border border-border/50">
            <input
              type="checkbox"
              checked={advanceDueDate}
              onChange={(e) => setAdvanceDueDate(e.target.checked)}
              className="rounded text-primary"
            />
            <span>Advance next EMI due date by 1 month and increment paid count</span>
          </label>
        )}

        <Label label="Notes (optional)">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Auto-debited from HDFC Salary A/c"
            className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none"
          />
        </Label>

        <button
          onClick={submit}
          disabled={!amount || saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl py-3.5 text-sm shadow-sm active:scale-[0.98] transition disabled:opacity-50"
        >
          {saving ? "Logging Debit…" : isPrepay ? "Log Part Pre-payment" : `Log ${inst.kind === "pre_emi" ? "Pre-EMI" : "EMI"} Debit (${inr(Number(amount) || inst.amount)})`}
        </button>
      </div>
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
  const [underConstruction, setUnderConstruction] = useState(false);
  const [disbursed, setDisbursed] = useState("");
  const [fullEmiStart, setFullEmiStart] = useState("");
  const [autoDebit, setAutoDebit] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<Array<{ id: string; bank: string; maskedNumber?: string; accountType?: string }>>([]);
  useEffect(() => { api.list<any>("accounts").then((a) => setAccounts(a.filter((x) => x.accountType !== "Credit Card"))).catch(() => {}); }, []);

  const p = Number(principal) || 0;
  const r = Number(ratePA) || 0;
  const t = Number(tenureMonths) || 1;
  const emi = p > 0 ? calcEmi(p, r, t) : 0;
  const totalInt = p > 0 ? totalInterest(emi, t, p) : 0;

  const isBuilderOrReg = loanType === "builder_demand" || loanType === "property_registration";
  const canPreEmi = loanType === "home_loan" || loanType === "builder_demand";
  const preEmiOn = canPreEmi && underConstruction;
  const disbursedAmt = Math.min(Number(disbursed) || 0, p);
  const preEmiMonthly = preEmiAmount(disbursedAmt, r);

  const submit = async () => {
    if (!lenderName.trim() || !principal || saving) return;
    setSaving(true);
    try {
      await onSave({
        loanType,
        lenderName: lenderName.trim(),
        linkedPropertyId: linkedPropertyId || undefined,
        principalAmount: p,
        outstandingPrincipal: preEmiOn ? disbursedAmt : outstandingPrincipal(p, r, t, Number(emisPaid)),
        interestRatePA: r,
        tenureMonths: t,
        emiAmount: emi,
        disbursementDate,
        nextEmiDueDate,
        emisPaid: preEmiOn ? 0 : Number(emisPaid),
        totalEmis: t,
        phase: preEmiOn ? "pre_emi" : "emi",
        disbursedAmount: preEmiOn ? disbursedAmt : undefined,
        fullEmiStartDate: preEmiOn && fullEmiStart ? fullEmiStart : undefined,
        preEmiPaidTotal: preEmiOn ? 0 : undefined,
        emiDay: Number(nextEmiDueDate.slice(8, 10)) || undefined,
        autoDebit,
        autoDebitBankAccountId: autoDebit && accountId ? accountId : undefined,
        isRegistrationLoan: loanType === "property_registration",
        builderMilestones: milestones.length > 0 ? milestones : undefined,
        emiHistory: [
          {
            id: crypto.randomUUID(),
            effectiveDate: disbursementDate,
            emiAmount: emi,
            interestRatePA: r,
            reason: "Initial loan disbursement",
            createdAt: new Date().toISOString(),
          },
        ],
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

        {/* Pre-EMI: under-construction homes pay interest only on what the bank has released so far */}
        {canPreEmi && (
          <div className="rounded-2xl border border-border p-3.5 space-y-3">
            <button type="button" onClick={() => setUnderConstruction(v => !v)} className="w-full flex items-center justify-between gap-3 text-left">
              <div>
                <div className="text-sm font-bold">Under construction? (Pre-EMI)</div>
                <div className="text-[11px] text-muted-foreground">Bank is releasing the loan in stages — you pay interest only until the full EMI starts.</div>
              </div>
              <span className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${underConstruction ? "bg-primary" : "bg-slate-300"}`}>
                <span className={`block size-5 rounded-full bg-white transition-transform ${underConstruction ? "translate-x-5" : ""}`} />
              </span>
            </button>
            {underConstruction && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Label label="Disbursed so far (₹)">
                    <input inputMode="decimal" value={disbursed} onChange={e => setDisbursed(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="e.g. 1000000" className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
                  </Label>
                  <Label label="Full EMI starts (approx.)">
                    <input type="date" value={fullEmiStart} onChange={e => setFullEmiStart(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none" />
                  </Label>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                  <div><b>Pre-EMI now: {inr(preEmiMonthly)}/month</b> = ₹{inr(disbursedAmt).replace("₹", "")} × {r}% ÷ 12</div>
                  <div>Interest only — your loan balance and "EMIs paid" do not change. Full EMI later: <b>{inr(emi)}</b>/month. Update "Disbursed so far" whenever the bank releases the next tranche.</div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Auto-debit */}
        <div className="rounded-2xl border border-border p-3.5 space-y-3">
          <button type="button" onClick={() => setAutoDebit(v => !v)} className="w-full flex items-center justify-between gap-3 text-left">
            <div>
              <div className="text-sm font-bold">Auto-debit from my bank</div>
              <div className="text-[11px] text-muted-foreground">Your bank pulls the instalment on the due date. LiveSync records it automatically as an expense so your spending stays accurate.</div>
            </div>
            <span className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${autoDebit ? "bg-primary" : "bg-slate-300"}`}>
              <span className={`block size-5 rounded-full bg-white transition-transform ${autoDebit ? "translate-x-5" : ""}`} />
            </span>
          </button>
          {autoDebit && (
            <Label label="Debited from account">
              <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full bg-muted/60 rounded-xl px-3.5 py-2.5 text-sm outline-none">
                <option value="">{accounts.length ? "Select account (optional)" : "No accounts added yet — recorded without an account"}</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.bank}{a.maskedNumber ? ` ${a.maskedNumber}` : ""}</option>)}
              </select>
            </Label>
          )}
          {autoDebit && <p className="text-[11px] text-muted-foreground">Make sure the mandate (NACH/e-mandate) is active with your bank — the app records the debit, it cannot move money itself.</p>}
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
      await onSave({ direction, person: person.trim(), amount: Number(amount), mode, takenOn: todayISO(), repayBy, notes: notes ? notes.trim() : undefined });
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
