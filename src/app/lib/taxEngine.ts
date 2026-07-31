export type ResidentialStatus = "ROR" | "RNOR" | "NR";
export type ItrForm = "ITR-1" | "ITR-2" | "ITR-3" | "ITR-4";

export interface TaxpayerProfile {
  pan: string;
  age: number;
  daysInIndiaInFY: number; // For residential status determination
  
  // Income Heads
  salaryIncome: number;
  housePropertyIncome: number; // Net house property income or interest loss
  isMultipleHouseProperties: boolean;
  
  // Capital Gains
  stcg111a: number; // Short term capital gains on equity/MF with STT
  ltcg112a: number; // Long term capital gains on equity/MF u/s 112A
  otherCapitalGains: number; // Real estate, debt funds, etc.
  
  // Other Sources
  savingsInterest: number;
  fdInterest: number;
  dividendIncome: number;
  otherIncome: number;
  
  // Exclusions / Triggers
  agriculturalIncome: number;
  hasForeignAssetsOrIncome: boolean;
  isDirectorInCompany: boolean;
  holdsUnlistedShares: boolean;
  hasBusinessOrProfessionalIncome: boolean;
  isPresumptiveBusiness: boolean;
  
  // Deductions Old Regime
  section80c: number; // Max 1.5L
  section80d_self: number; // Health insurance self/family (Max 25k or 50k for senior)
  section80d_parents: number; // Health insurance parents (Max 25k or 50k for senior parents)
  section80ccd1b: number; // NPS additional (Max 50k)
  section80ccd2_employer: number; // NPS employer
  section80e: number; // Education loan interest
  section80g: number; // Donations
  section80gg: number; // Rent paid without HRA
  hraExemption: number;
  homeLoanInterest24b: number; // Max 2L self-occupied
  
  // Taxes Paid / Deducted
  tdsSalary: number;
  tdsOther: number;
  advanceTaxPaid: number;
}

export interface TaxResult {
  totalGrossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  normalTax: number;
  stcgTax: number;
  ltcgTax: number;
  taxBeforeRebate: number;
  rebate87a: number;
  taxAfterRebate: number;
  cess: number;
  totalTaxLiability: number;
  totalTaxCredits: number; // TDS + Advance Tax
  netTaxPayableOrRefund: number; // Negative = Refund, Positive = Payable
}

export interface FormSelectionResult {
  selectedForm: ItrForm;
  residentialStatus: ResidentialStatus;
  isItr1Eligible: boolean;
  exclusionsTriggered: string[];
  reasoning: string;
}

/**
 * Auto-determines Residential Status based on Section 6 of Income Tax Act
 */
export function determineResidentialStatus(daysInIndiaInFY: number, age: number): ResidentialStatus {
  if (daysInIndiaInFY >= 182) {
    return "ROR";
  } else if (daysInIndiaInFY >= 60) {
    return "RNOR";
  } else {
    return "NR";
  }
}

/**
 * Evaluates ITR Form Selection Matrix (Section 7.2 of Blueprint)
 */
export function determineItrForm(profile: TaxpayerProfile): FormSelectionResult {
  const status = determineResidentialStatus(profile.daysInIndiaInFY, profile.age);
  const exclusions: string[] = [];

  // Business income check
  if (profile.hasBusinessOrProfessionalIncome) {
    if (profile.isPresumptiveBusiness) {
      return {
        selectedForm: "ITR-4",
        residentialStatus: status,
        isItr1Eligible: false,
        exclusionsTriggered: ["Business / Presumptive Income u/s 44AD/44ADA"],
        reasoning: "Taxpayer has Presumptive Business/Professional Income (Section 44AD/44ADA). ITR-4 (SUGAM) is required."
      };
    }
    return {
      selectedForm: "ITR-3",
      residentialStatus: status,
      isItr1Eligible: false,
      exclusionsTriggered: ["Business or Professional Income"],
      reasoning: "Taxpayer has Business or Professional Income. ITR-3 is mandatory (Requires Human CA Escalation)."
    };
  }

  // Check ITR-1 Exclusion Conditions
  if (status !== "ROR") {
    exclusions.push(`Residential status is ${status} (Section 6). ITR-1 is ONLY for Resident Individuals.`);
  }

  const grossIncome = profile.salaryIncome + profile.housePropertyIncome + profile.stcg111a + profile.ltcg112a + profile.otherCapitalGains + profile.savingsInterest + profile.fdInterest + profile.dividendIncome + profile.otherIncome;
  if (grossIncome > 5000000) {
    exclusions.push(`Total income (₹${grossIncome.toLocaleString("en-IN")}) exceeds ₹50 Lakh limit.`);
  }

  if (profile.isMultipleHouseProperties) {
    exclusions.push("Multiple House Properties owned (Section 23). ITR-1 supports max 1 House Property.");
  }

  const hasCapitalGains = profile.stcg111a > 0 || profile.otherCapitalGains > 0 || profile.ltcg112a > 125000;
  if (hasCapitalGains) {
    exclusions.push("Capital Gains present (STCG / LTCG > ₹1.25L). ITR-1 does not support capital gains schedules.");
  }

  if (profile.hasForeignAssetsOrIncome) {
    exclusions.push("Foreign Assets / Foreign Income held. Schedule FA is mandatory in ITR-2.");
  }

  if (profile.isDirectorInCompany) {
    exclusions.push("Director in a company. ITR-1 is barred for company directors.");
  }

  if (profile.holdsUnlistedShares) {
    exclusions.push("Holds unlisted equity shares. Schedule AL/Unlisted Shares required in ITR-2.");
  }

  if (profile.agriculturalIncome > 5000) {
    exclusions.push(`Agricultural income (₹${profile.agriculturalIncome.toLocaleString("en-IN")}) exceeds ₹5,000 threshold.`);
  }

  const isEligible = exclusions.length === 0;
  const selectedForm: ItrForm = isEligible ? "ITR-1" : "ITR-2";

  return {
    selectedForm,
    residentialStatus: status,
    isItr1Eligible: isEligible,
    exclusionsTriggered: exclusions,
    reasoning: isEligible 
      ? "Taxpayer meets all eligibility criteria for ITR-1 (SAHAJ): Resident Individual, Income <= ₹50L, Single House Property, No Capital Gains / Foreign Assets."
      : `Switched to ${selectedForm} due to ${exclusions.length} statutory exclusion criteria: ${exclusions.join(" | ")}`
  };
}

/**
 * Computes Tax under Old Regime considering Age Slabs (Normal <60, Senior 60-79, Super Senior 80+)
 */
export function computeTaxOldRegime(taxableIncome: number, age: number): number {
  let basicExemption = 250000;
  if (age >= 80) basicExemption = 500000;
  else if (age >= 60) basicExemption = 300000;

  if (taxableIncome <= basicExemption) return 0;
  let tax = 0;
  let remaining = taxableIncome;

  if (remaining > 1000000) {
    tax += (remaining - 1000000) * 0.30;
    remaining = 1000000;
  }
  if (remaining > 500000) {
    tax += (remaining - 500000) * 0.20;
    remaining = 500000;
  }
  if (remaining > basicExemption) {
    tax += (remaining - basicExemption) * 0.05;
  }

  return tax;
}

/**
 * Computes Tax under New Regime (FY 2025-26 / AY 2026-27 Slabs)
 */
export function computeTaxNewRegime(taxableIncome: number): number {
  if (taxableIncome <= 300000) return 0;
  let tax = 0;
  let remaining = taxableIncome;

  if (remaining > 1500000) {
    tax += (remaining - 1500000) * 0.30;
    remaining = 1500000;
  }
  if (remaining > 1200000) {
    tax += (remaining - 1200000) * 0.20;
    remaining = 1200000;
  }
  if (remaining > 1000000) {
    tax += (remaining - 1000000) * 0.15;
    remaining = 1000000;
  }
  if (remaining > 700000) {
    tax += (remaining - 700000) * 0.10;
    remaining = 700000;
  }
  if (remaining > 300000) {
    tax += (remaining - 300000) * 0.05;
  }

  return tax;
}

/**
 * Main Deterministic Regime Optimization Engine
 */
export function optimizeRegime(profile: TaxpayerProfile) {
  const isSenior = profile.age >= 60;
  
  // Total Gross Income
  const grossIncome = profile.salaryIncome + 
                      profile.housePropertyIncome + 
                      profile.stcg111a + 
                      profile.ltcg112a + 
                      profile.otherCapitalGains + 
                      profile.savingsInterest + 
                      profile.fdInterest + 
                      profile.dividendIncome + 
                      profile.otherIncome;

  // Capital Gains Tax Calculation
  const stcgTax = profile.stcg111a * 0.15;
  const ltcgTaxable = Math.max(0, profile.ltcg112a - 125000);
  const ltcgTax = ltcgTaxable * 0.125;
  const totalCapitalGainsTax = stcgTax + ltcgTax;

  // Total Tax Credits
  const totalCredits = profile.tdsSalary + profile.tdsOther + profile.advanceTaxPaid;

  // --- OLD REGIME ---
  const sec80C_claimed = Math.min(150000, profile.section80c);
  const sec80D_self_cap = isSenior ? 50000 : 25000;
  const sec80D_parents_cap = 50000;
  const sec80D_claimed = Math.min(sec80D_self_cap, profile.section80d_self) + Math.min(sec80D_parents_cap, profile.section80d_parents);
  
  // 80TTA (Normal: max 10k savings interest) vs 80TTB (Senior: max 50k savings + FD interest)
  const secInterestDeduction = isSenior 
    ? Math.min(50000, profile.savingsInterest + profile.fdInterest)
    : Math.min(10000, profile.savingsInterest);

  const sec80CCD1B_claimed = Math.min(50000, profile.section80ccd1b);
  const homeLoanCap = Math.min(200000, profile.homeLoanInterest24b);

  const oldDeductions = sec80C_claimed +
                        sec80D_claimed +
                        secInterestDeduction +
                        sec80CCD1B_claimed +
                        profile.section80ccd2_employer +
                        profile.section80e +
                        profile.section80g +
                        profile.section80gg +
                        profile.hraExemption +
                        homeLoanCap +
                        50000; // Standard deduction Old

  const oldNormalTaxable = Math.max(0, (grossIncome - profile.stcg111a - profile.ltcg112a) - oldDeductions);
  const oldNormalTax = computeTaxOldRegime(oldNormalTaxable, profile.age);
  const oldTaxBeforeRebate = oldNormalTax + totalCapitalGainsTax;
  
  // Rebate 87A Old Regime (if taxable income <= 5L)
  const oldRebate = oldNormalTaxable <= 500000 ? Math.min(12500, oldNormalTax) : 0;
  const oldTaxAfterRebate = oldTaxBeforeRebate - oldRebate;
  const oldCess = oldTaxAfterRebate * 0.04;
  const oldTotalLiability = oldTaxAfterRebate + oldCess;
  const oldNetPayableOrRefund = oldTotalLiability - totalCredits;

  const oldResult: TaxResult = {
    totalGrossIncome: grossIncome,
    totalDeductions: oldDeductions,
    taxableIncome: oldNormalTaxable,
    normalTax: oldNormalTax,
    stcgTax,
    ltcgTax,
    taxBeforeRebate: oldTaxBeforeRebate,
    rebate87a: oldRebate,
    taxAfterRebate: oldTaxAfterRebate,
    cess: oldCess,
    totalTaxLiability: oldTotalLiability,
    totalTaxCredits: totalCredits,
    netTaxPayableOrRefund: oldNetPayableOrRefund
  };

  // --- NEW REGIME ---
  const newDeductions = 75000 + profile.section80ccd2_employer; // Standard deduction 75k + Employer NPS
  const newNormalTaxable = Math.max(0, (grossIncome - profile.stcg111a - profile.ltcg112a) - newDeductions);
  const newNormalTax = computeTaxNewRegime(newNormalTaxable);
  const newTaxBeforeRebate = newNormalTax + totalCapitalGainsTax;
  
  // Rebate 87A New Regime (FY 2025-26: Taxable <= 12L gets rebate up to ₹60k)
  const newRebate = newNormalTaxable <= 1200000 ? Math.min(60000, newNormalTax) : 0;
  const newTaxAfterRebate = newTaxBeforeRebate - newRebate;
  const newCess = newTaxAfterRebate * 0.04;
  const newTotalLiability = newTaxAfterRebate + newCess;
  const newNetPayableOrRefund = newTotalLiability - totalCredits;

  const newResult: TaxResult = {
    totalGrossIncome: grossIncome,
    totalDeductions: newDeductions,
    taxableIncome: newNormalTaxable,
    normalTax: newNormalTax,
    stcgTax,
    ltcgTax,
    taxBeforeRebate: newTaxBeforeRebate,
    rebate87a: newRebate,
    taxAfterRebate: newTaxAfterRebate,
    cess: newCess,
    totalTaxLiability: newTotalLiability,
    totalTaxCredits: totalCredits,
    netTaxPayableOrRefund: newNetPayableOrRefund
  };

  const formSelection = determineItrForm(profile);
  const recommended = oldTotalLiability < newTotalLiability ? "OLD" : "NEW";
  const savings = Math.abs(newTotalLiability - oldTotalLiability);

  return {
    formSelection,
    oldResult,
    newResult,
    recommended,
    savings,
    oldDeductions,
    newDeductions
  };
}
