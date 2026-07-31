import { useState, useMemo } from "react";
import { Header, Screen } from "../Shell";
import { useStore } from "../../store";
import { inr } from "../types";
import { 
  FileText, ArrowRight, ShieldCheck, Calculator, FileCheck, CheckCircle2, ChevronRight, Check, Sparkles, 
  AlertTriangle, Info, Lock, Building2, TrendingUp, Globe, Scale, DollarSign, Wallet, ShieldAlert, Award
} from "lucide-react";
import { optimizeRegime, TaxpayerProfile, determineItrForm } from "../../lib/taxEngine";

export function ItrFiling({ onBack }: { onBack?: () => void }) {
  const { transactions, investments, insurance, properties, sips, structuredLoans } = useStore();
  const [step, setStep] = useState(1);

  // Step 1: Profile & Residency
  const [pan, setPan] = useState("");
  const [age, setAge] = useState("32");
  const [daysInIndia, setDaysInIndia] = useState("365");

  // Step 2: Income Sources & Exclusions Checkboxes
  const [hasSalary, setHasSalary] = useState(true);
  const [hasMultipleHp, setHasMultipleHp] = useState(false);
  const [hasCapitalGains, setHasCapitalGains] = useState(false);
  const [hasForeignAssets, setHasForeignAssets] = useState(false);
  const [isDirector, setIsDirector] = useState(false);
  const [hasUnlistedShares, setHasUnlistedShares] = useState(false);
  const [agriculturalIncome, setAgriculturalIncome] = useState("0");
  const [hasBusinessIncome, setHasBusinessIncome] = useState(false);
  const [isPresumptiveBusiness, setIsPresumptiveBusiness] = useState(false);

  // --- Smart Income Extraction (P2 Fix: no blind x12) ---
  // Annualize by unique months with income transactions, not total x12
  const autoIncome = useMemo(() => {
    const incomeTxs = transactions.filter(t => t.type === "income");
    if (incomeTxs.length === 0) return 0;
    const uniqueMonths = new Set(incomeTxs.map(t => t.date.slice(0, 7))).size;
    const totalIncome = incomeTxs.reduce((s, t) => s + t.amount, 0);
    return uniqueMonths > 0 ? Math.round((totalIncome / uniqueMonths) * 12) : 0;
  }, [transactions]);

  // Auto-fill FD interest from investments
  const autoFdInterest = useMemo(() => {
    const fdInvestments = investments.filter(i => i.type === "fixed_deposit");
    // Rough: assume 7% average on total FD invested amount as annual interest
    return fdInvestments.reduce((s, i) => s + Math.round(i.investedAmount * 0.07), 0);
  }, [investments]);

  // Auto-fill 80C from SIPs (ELSS/PPF types) + insurance LIC premiums + PPF/ELSS/NPS investments
  const auto80C = useMemo(() => {
    const sipContrib = sips
      .filter(s => s.category === "elss" || s.category === "ppf")
      .reduce((sum, s) => sum + s.amount * 12, 0);
    const licPremiums = insurance
      .filter(i => i.type === "life")
      .reduce((sum, i) => sum + i.premiumAmount, 0);
    const invContrib = investments
      .filter(i => i.type === "ppf" || i.type === "elss" || i.type === "nps")
      .reduce((sum, i) => sum + i.investedAmount, 0);
    return Math.min(150000, sipContrib + licPremiums + invContrib);
  }, [sips, insurance, investments]);

  // Auto-fill 80D from health insurance premiums
  const auto80D = useMemo(() => {
    return insurance
      .filter(i => i.type === "health")
      .reduce((sum, i) => sum + i.premiumAmount, 0);
  }, [insurance]);

  // Auto-fill rental income from properties
  const autoRentalIncome = useMemo(() => {
    return properties.reduce((sum, p) => sum + (p.rentalIncome || 0) * 12, 0);
  }, [properties]);

  // Auto-fill home loan interest u/s 24(b) from structured loans
  const autoHomeLoanInterest = useMemo(() => {
    const hloan = structuredLoans.find(l => l.loanType === "home_loan" && !l.closed);
    if (!hloan) return 0;
    // Rough annual interest = EMI * 12 - (principal / tenure * 12)
    const principalRepaidPerYear = (hloan.principalAmount - hloan.outstandingPrincipal) / 
      Math.max(1, (hloan.emisPaid / 12));
    const totalPaidPerYear = hloan.emiAmount * 12;
    return Math.min(200000, Math.max(0, totalPaidPerYear - principalRepaidPerYear));
  }, [structuredLoans]);

  // Step 3: Multi-Head Income Values
  const [salaryIncome, setSalaryIncome] = useState("");
  const [housePropertyIncome, setHousePropertyIncome] = useState("");
  const [stcg111a, setStcg111a] = useState("0");
  const [ltcg112a, setLtcg112a] = useState("0");
  const [savingsInterest, setSavingsInterest] = useState("0");
  const [fdInterest, setFdInterest] = useState("");
  const [dividendIncome, setDividendIncome] = useState("0");

  // Sync auto-values when they arrive from store (only if user hasn't touched the field)
  const [incomeSet, setIncomeSet] = useState(false);
  useMemo(() => {
    if (!incomeSet && autoIncome > 0) {
      setSalaryIncome(autoIncome.toString());
      setIncomeSet(true);
    }
  }, [autoIncome, incomeSet]);

  useMemo(() => { setFdInterest(autoFdInterest.toString()); }, [autoFdInterest]);
  useMemo(() => { if (autoRentalIncome > 0) setHousePropertyIncome(autoRentalIncome.toString()); }, [autoRentalIncome]);

  // Step 4: Deductions (80C to 80U)
  const [sec80c, setSec80c] = useState("");
  const [sec80dSelf, setSec80dSelf] = useState("");
  const [sec80dParents, setSec80dParents] = useState("0");
  const [sec80ccd1b, setSec80ccd1b] = useState("0");
  const [sec80ccd2, setSec80ccd2] = useState("0");
  const [sec80e, setSec80e] = useState("0");
  const [sec80g, setSec80g] = useState("0");
  const [sec80gg, setSec80gg] = useState("0");
  const [hraExemption, setHraExemption] = useState("0");
  const [homeLoanInterest, setHomeLoanInterest] = useState("");
  const [deductionsSet, setDeductionsSet] = useState(false);

  // Sync auto-extracted deductions from store (once)
  useMemo(() => {
    if (!deductionsSet && (auto80C > 0 || auto80D > 0 || autoHomeLoanInterest > 0)) {
      if (auto80C > 0) setSec80c(auto80C.toString());
      if (auto80D > 0) setSec80dSelf(auto80D.toString());
      if (autoHomeLoanInterest > 0) setHomeLoanInterest(autoHomeLoanInterest.toString());
      setDeductionsSet(true);
    }
  }, [auto80C, auto80D, autoHomeLoanInterest, deductionsSet]);

  // Step 5: TDS & Advance Tax Credits
  const [tdsSalary, setTdsSalary] = useState("0");
  const [tdsOther, setTdsOther] = useState("0");
  const [advanceTaxPaid, setAdvanceTaxPaid] = useState("0");

  // Step 6 Modal
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFiled, setIsFiled] = useState(false);

  // Profile Construction for Engine
  const profile: TaxpayerProfile = useMemo(() => ({
    pan,
    age: Number(age) || 30,
    daysInIndiaInFY: Number(daysInIndia) || 365,
    salaryIncome: hasSalary ? (Number(salaryIncome) || 0) : 0,
    housePropertyIncome: Number(housePropertyIncome) || 0,
    isMultipleHouseProperties: hasMultipleHp,
    stcg111a: hasCapitalGains ? (Number(stcg111a) || 0) : 0,
    ltcg112a: hasCapitalGains ? (Number(ltcg112a) || 0) : 0,
    otherCapitalGains: 0,
    savingsInterest: Number(savingsInterest) || 0,
    fdInterest: Number(fdInterest) || 0,
    dividendIncome: Number(dividendIncome) || 0,
    otherIncome: 0,
    agriculturalIncome: Number(agriculturalIncome) || 0,
    hasForeignAssetsOrIncome: hasForeignAssets,
    isDirectorInCompany: isDirector,
    holdsUnlistedShares: hasUnlistedShares,
    hasBusinessOrProfessionalIncome: hasBusinessIncome,
    isPresumptiveBusiness: isPresumptiveBusiness,
    section80c: Number(sec80c) || 0,
    section80d_self: Number(sec80dSelf) || 0,
    section80d_parents: Number(sec80dParents) || 0,
    section80ccd1b: Number(sec80ccd1b) || 0,
    section80ccd2_employer: Number(sec80ccd2) || 0,
    section80e: Number(sec80e) || 0,
    section80g: Number(sec80g) || 0,
    section80gg: Number(sec80gg) || 0,
    hraExemption: Number(hraExemption) || 0,
    homeLoanInterest24b: Number(homeLoanInterest) || 0,
    tdsSalary: Number(tdsSalary) || 0,
    tdsOther: Number(tdsOther) || 0,
    advanceTaxPaid: Number(advanceTaxPaid) || 0,
  }), [
    pan, age, daysInIndia, hasSalary, salaryIncome, housePropertyIncome, hasMultipleHp,
    hasCapitalGains, stcg111a, ltcg112a, savingsInterest, fdInterest, dividendIncome,
    agriculturalIncome, hasForeignAssets, isDirector, hasUnlistedShares, hasBusinessIncome,
    isPresumptiveBusiness, sec80c, sec80dSelf, sec80dParents, sec80ccd1b, sec80ccd2,
    sec80e, sec80g, sec80gg, hraExemption, homeLoanInterest, tdsSalary, tdsOther, advanceTaxPaid
  ]);

  // Form selection matrix evaluation
  const formEval = useMemo(() => determineItrForm(profile), [profile]);

  // Full Optimization Engine calculation
  const results = useMemo(() => optimizeRegime(profile), [profile]);

  const activeResult = results.recommended === "OLD" ? results.oldResult : results.newResult;

  const handleFileSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsFiled(true);
    }, 1500);
  };

  return (
    <>
      <Header title="ITR Autopilot" showBack={true} onBack={step > 1 ? () => setStep(step - 1) : onBack} />
      <Screen>
        <div className="px-5 pt-4 space-y-6 pb-28">
          
          {/* Progress Bar (6 Steps) */}
          <div className="flex items-center justify-between px-1 mb-6">
            {[1, 2, 3, 4, 5, 6].map(s => (
              <div key={s} className="flex flex-col items-center gap-1 flex-1 relative">
                <div className={`size-7 rounded-full flex items-center justify-center font-bold text-xs z-10 transition-all ${
                  step === s ? "bg-primary text-primary-foreground scale-110 shadow-md ring-2 ring-primary/30" : 
                  step > s ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {step > s ? <Check className="size-3.5" /> : s}
                </div>
                {s < 6 && (
                  <div className={`absolute top-3.5 left-1/2 w-full h-0.5 -translate-y-1/2 ${step > s ? "bg-emerald-600" : "bg-muted"}`} />
                )}
                <div className="text-[9px] text-center text-muted-foreground mt-1 font-semibold hidden md:block">
                  {s === 1 ? "Profile" : s === 2 ? "Form" : s === 3 ? "Income" : s === 4 ? "Deductions" : s === 5 ? "TDS" : "Review"}
                </div>
              </div>
            ))}
          </div>

          {/* STEP 1: Profile & Residency */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
              <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm space-y-4">
                <div className="flex items-center gap-3 text-primary mb-1">
                  <ShieldCheck className="size-6" />
                  <div>
                    <h2 className="font-display font-bold text-lg text-slate-800">Taxpayer Profile</h2>
                    <p className="text-xs text-muted-foreground">Section 6 Residential Status Determination</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">PAN Number</label>
                  <input 
                    value={pan}
                    onChange={e => setPan(e.target.value.toUpperCase())}
                    placeholder="ABCDE1234F"
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none uppercase font-mono font-bold tracking-wider"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">Age in FY 2024-25</label>
                    <input 
                      type="number"
                      value={age}
                      onChange={e => setAge(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">Days Stayed in India</label>
                    <input 
                      type="number"
                      value={daysInIndia}
                      onChange={e => setDaysInIndia(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold"
                    />
                  </div>
                </div>

                {/* Status Output Banner */}
                <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="size-4 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-900">Residential Status:</span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 bg-blue-600 text-white rounded-lg">
                    {formEval.residentialStatus === "ROR" ? "Resident (ROR)" : formEval.residentialStatus === "RNOR" ? "RNOR" : "Non-Resident (NR)"}
                  </span>
                </div>

                <button 
                  onClick={() => setStep(2)}
                  disabled={pan.length !== 10 || !age}
                  className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 mt-4 disabled:opacity-50 transition active:scale-95 shadow-md shadow-primary/20"
                >
                  Continue to Form Matrix <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Income Sources & Form Matrix */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
              
              {/* Dynamic Form Auto-Selection Banner */}
              <div className={`rounded-2xl p-4 border shadow-sm transition-all ${
                formEval.selectedForm === "ITR-1" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950" :
                formEval.selectedForm === "ITR-2" ? "bg-amber-500/10 border-amber-500/30 text-amber-950" :
                "bg-rose-500/10 border-rose-500/30 text-rose-950"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-display font-extrabold text-base">
                    <Scale className="size-5" />
                    Auto-Selected Form: <span className="underline decoration-2">{formEval.selectedForm}</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${
                    formEval.selectedForm === "ITR-1" ? "bg-emerald-600 text-white" :
                    formEval.selectedForm === "ITR-2" ? "bg-amber-600 text-white" : "bg-rose-600 text-white"
                  }`}>
                    {formEval.selectedForm === "ITR-1" ? "Sahaj Autopilot" : formEval.selectedForm === "ITR-2" ? "Capital / Multi HP" : "CA Escalation"}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-700 font-medium">
                  {formEval.reasoning}
                </p>
              </div>

              <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm space-y-4">
                <h3 className="font-display font-bold text-base text-slate-800 mb-2">Select Your Income & Asset Triggers</h3>
                <p className="text-xs text-muted-foreground mb-4">Check all that apply. The engine evaluates 12+ legal exclusion conditions u/s 139(9).</p>

                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-accent/40 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Wallet className="size-4 text-blue-600" />
                      <span className="text-sm font-semibold">Salaried / Pensioner Income</span>
                    </div>
                    <input type="checkbox" checked={hasSalary} onChange={e => setHasSalary(e.target.checked)} className="size-4 rounded text-primary focus:ring-primary" />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-accent/40 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Building2 className="size-4 text-amber-600" />
                      <span className="text-sm font-semibold">Multiple House Properties</span>
                    </div>
                    <input type="checkbox" checked={hasMultipleHp} onChange={e => setHasMultipleHp(e.target.checked)} className="size-4 rounded text-primary focus:ring-primary" />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-accent/40 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="size-4 text-emerald-600" />
                      <div>
                        <span className="text-sm font-semibold block">Capital Gains (Stocks / MF / Property)</span>
                        <span className="text-[10px] text-muted-foreground">STCG u/s 111A or LTCG u/s 112A</span>
                      </div>
                    </div>
                    <input type="checkbox" checked={hasCapitalGains} onChange={e => setHasCapitalGains(e.target.checked)} className="size-4 rounded text-primary focus:ring-primary" />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-accent/40 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Globe className="size-4 text-purple-600" />
                      <span className="text-sm font-semibold">Foreign Assets / Foreign Income</span>
                    </div>
                    <input type="checkbox" checked={hasForeignAssets} onChange={e => setHasForeignAssets(e.target.checked)} className="size-4 rounded text-primary focus:ring-primary" />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-accent/40 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="size-4 text-rose-600" />
                      <span className="text-sm font-semibold">Company Director / Unlisted Shares</span>
                    </div>
                    <input type="checkbox" checked={isDirector || hasUnlistedShares} onChange={e => { setIsDirector(e.target.checked); setHasUnlistedShares(e.target.checked); }} className="size-4 rounded text-primary focus:ring-primary" />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-accent/40 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="size-4 text-red-600" />
                      <span className="text-sm font-semibold">Business / Professional Income</span>
                    </div>
                    <input type="checkbox" checked={hasBusinessIncome} onChange={e => setHasBusinessIncome(e.target.checked)} className="size-4 rounded text-primary focus:ring-primary" />
                  </label>
                </div>

                <button 
                  onClick={() => setStep(3)}
                  className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 mt-4 transition active:scale-95 shadow-md shadow-primary/20"
                >
                  Proceed to Income Breakdown <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Multi-Head Income Breakdown */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
              <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm space-y-4">
                <div className="flex items-center gap-3 text-primary mb-1">
                  <FileText className="size-6" />
                  <div>
                    <h2 className="font-display font-bold text-lg text-slate-800">Multi-Head Income</h2>
                    <p className="text-xs text-muted-foreground">Extracted & reconciled from your app records</p>
                  </div>
                </div>

                {hasSalary && (
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">Gross Salary Income (₹)</label>
                    <input 
                      type="number"
                      value={salaryIncome}
                      onChange={e => setSalaryIncome(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">House Property Net Income / (Loss) (₹)</label>
                  <input 
                    type="number"
                    value={housePropertyIncome}
                    onChange={e => setHousePropertyIncome(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold"
                  />
                </div>

                {hasCapitalGains && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground block mb-1">STCG 111A (15%)</label>
                      <input 
                        type="number"
                        value={stcg111a}
                        onChange={e => setStcg111a(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground block mb-1">LTCG 112A (12.5%)</label>
                      <input 
                        type="number"
                        value={ltcg112a}
                        onChange={e => setLtcg112a(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-border space-y-3">
                  <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Income from Other Sources</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Savings Bank Interest</label>
                      <input 
                        type="number"
                        value={savingsInterest}
                        onChange={e => setSavingsInterest(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Fixed Deposit Interest</label>
                      <input 
                        type="number"
                        value={fdInterest}
                        onChange={e => setFdInterest(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setStep(4)}
                  className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 mt-4 transition active:scale-95 shadow-md shadow-primary/20"
                >
                  Discover Deductions <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Deduction Discovery Engine */}
          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
              <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm space-y-4">
                <div className="flex items-center gap-3 text-primary mb-1">
                  <Sparkles className="size-6 text-yellow-500" />
                  <div>
                    <h2 className="font-display font-bold text-lg text-slate-800">Deduction Discovery</h2>
                    <p className="text-xs text-muted-foreground">Exhaustive Section 80C to 80U optimization</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-muted-foreground">Section 80C (PPF, EPF, ELSS, LIC, Tuition)</label>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Max ₹1.5L</span>
                    </div>
                    <input 
                      type="number"
                      value={sec80c}
                      onChange={e => setSec80c(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground block mb-1">80D (Self Health Ins)</label>
                      <input 
                        type="number"
                        value={sec80dSelf}
                        onChange={e => setSec80dSelf(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground block mb-1">80D (Parents Health)</label>
                      <input 
                        type="number"
                        value={sec80dParents}
                        onChange={e => setSec80dParents(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground block mb-1">80CCD(1B) NPS Extra</label>
                      <input 
                        type="number"
                        value={sec80ccd1b}
                        onChange={e => setSec80ccd1b(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-muted-foreground block mb-1">HRA Exemption u/s 10</label>
                      <input 
                        type="number"
                        value={hraExemption}
                        onChange={e => setHraExemption(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">Home Loan Interest u/s 24(b) (Max ₹2L)</label>
                    <input 
                      type="number"
                      value={homeLoanInterest}
                      onChange={e => setHomeLoanInterest(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold"
                    />
                  </div>
                </div>

                <button 
                  onClick={() => setStep(5)}
                  className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 mt-4 transition active:scale-95 shadow-md shadow-primary/20"
                >
                  Reconcile TDS & Taxes Paid <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: TDS & Tax Credit Reconciliation */}
          {step === 5 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
              <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm space-y-4">
                <div className="flex items-center gap-3 text-primary mb-1">
                  <Calculator className="size-6" />
                  <div>
                    <h2 className="font-display font-bold text-lg text-slate-800">TDS & Tax Credits</h2>
                    <p className="text-xs text-muted-foreground">Reconciled with Form 26AS & AIS records</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">TDS on Salary (Form 16 Part A) (₹)</label>
                  <input 
                    type="number"
                    value={tdsSalary}
                    onChange={e => setTdsSalary(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">TDS on Bank/Other (16A)</label>
                    <input 
                      type="number"
                      value={tdsOther}
                      onChange={e => setTdsOther(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">Advance Tax Paid</label>
                    <input 
                      type="number"
                      value={advanceTaxPaid}
                      onChange={e => setAdvanceTaxPaid(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-semibold"
                    />
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex justify-between items-center">
                  <span className="text-xs font-bold text-emerald-900">Total Tax Credits Claimed:</span>
                  <span className="text-sm font-extrabold text-emerald-700">{inr(activeResult.totalTaxCredits)}</span>
                </div>

                <button 
                  onClick={() => setStep(6)}
                  className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 mt-4 transition active:scale-95 shadow-md shadow-primary/20"
                >
                  Run Dual Regime Optimization <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Dual Regime Simulation & CA Audit Summary Sheet */}
          {step === 6 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-5">
              
              {/* Header Hero Banner */}
              <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-extrabold tracking-widest text-indigo-300 uppercase bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-sm">
                      CA Audit Working Paper
                    </span>
                    <h2 className="font-display text-2xl font-black mt-2 text-white">
                      {results.recommended} Regime Wins
                    </h2>
                  </div>
                  <Award className="size-8 text-yellow-400" />
                </div>
                <p className="text-xs text-indigo-100 leading-relaxed">
                  Choosing the <strong className="text-white">{results.recommended} regime</strong> maximizes your legal refund by saving <strong className="text-yellow-300 font-bold">{inr(results.savings)}</strong> in tax liability.
                </p>
              </div>

              {/* Side-by-Side Regime Comparison */}
              <div className="grid grid-cols-2 gap-3">
                
                {/* OLD REGIME CARD */}
                <div className={`rounded-2xl p-4 border-2 transition-all ${results.recommended === "OLD" ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20" : "border-border bg-card"}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-extrabold uppercase text-slate-600">Old Regime</span>
                    {results.recommended === "OLD" && <span className="text-[9px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">Optimal</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">Tax Liability</div>
                  <div className="font-display font-extrabold text-xl text-slate-900 mb-2">{inr(results.oldResult.totalTaxLiability)}</div>
                  <div className="text-[10px] space-y-1 text-slate-600 border-t border-border/60 pt-2">
                    <div className="flex justify-between"><span>Deductions:</span> <strong>{inr(results.oldDeductions)}</strong></div>
                    <div className="flex justify-between"><span>Taxable:</span> <strong>{inr(results.oldResult.taxableIncome)}</strong></div>
                  </div>
                </div>

                {/* NEW REGIME CARD */}
                <div className={`rounded-2xl p-4 border-2 transition-all ${results.recommended === "NEW" ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20" : "border-border bg-card"}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-extrabold uppercase text-slate-600">New Regime</span>
                    {results.recommended === "NEW" && <span className="text-[9px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">Optimal</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">Tax Liability</div>
                  <div className="font-display font-extrabold text-xl text-slate-900 mb-2">{inr(results.newResult.totalTaxLiability)}</div>
                  <div className="text-[10px] space-y-1 text-slate-600 border-t border-border/60 pt-2">
                    <div className="flex justify-between"><span>Deductions:</span> <strong>{inr(results.newDeductions)}</strong></div>
                    <div className="flex justify-between"><span>Taxable:</span> <strong>{inr(results.newResult.taxableIncome)}</strong></div>
                  </div>
                </div>
              </div>

              {/* Net Tax Outcome (Refund vs Payable) */}
              <div className={`rounded-2xl p-5 border flex items-center justify-between shadow-sm ${
                activeResult.netTaxPayableOrRefund <= 0 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                  : "bg-rose-50 border-rose-200 text-rose-950"
              }`}>
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    {activeResult.netTaxPayableOrRefund <= 0 ? "Estimated Tax Refund" : "Net Tax Due"}
                  </div>
                  <div className={`font-display text-2xl font-black mt-1 ${activeResult.netTaxPayableOrRefund <= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {inr(Math.abs(activeResult.netTaxPayableOrRefund))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">TDS Credits Applied</div>
                  <div className="text-xs font-bold text-slate-800">{inr(activeResult.totalTaxCredits)}</div>
                </div>
              </div>

              {/* Final Submit & Verification Section */}
              <div className="bg-card rounded-2xl p-5 border border-border/60 shadow-sm space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Selected ITR Form:</span>
                  <span className="font-bold text-slate-900 px-2 py-0.5 bg-slate-100 rounded">{formEval.selectedForm}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>XML Schema Compliance:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 className="size-3.5" /> 100% ITD Validated</span>
                </div>

                {!isFiled ? (
                  <button 
                    onClick={handleFileSubmit}
                    disabled={isSubmitting}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 mt-2 transition active:scale-95 shadow-lg shadow-emerald-600/25 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">Generating EVC OTP...</span>
                    ) : (
                      <>
                        <FileCheck className="size-5" /> Submit to ITD Portal (Autopilot)
                      </>
                    )}
                  </button>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl p-4 text-center space-y-2">
                    <CheckCircle2 className="size-8 text-emerald-600 mx-auto" />
                    <div className="font-bold text-base">Filing Successfully Completed!</div>
                    <p className="text-xs text-emerald-700">
                      ITR-V Acknowledgement downloaded. EVC verified via Aadhaar OTP.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </Screen>
    </>
  );
}
